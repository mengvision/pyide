/**
 * MemoryExtractor Service
 * Automatically extracts meaningful memories from chat conversations
 */

import { v4 as uuidv4 } from 'uuid';
import type { MemoryEntry, MemoryType } from '../../types/memory';
import { MemoryStorage } from './storage';
import type { PlatformService } from '@pyide/platform';

export interface ExtractionPrompt {
  conversation: string;
  projectId?: string;
}

export interface ExtractedMemory {
  content: string;
  type: MemoryType;
  confidence: number;  // 0-1 confidence score
  context?: string;
}

export class MemoryExtractor {
  private storage: MemoryStorage;

  constructor(platform: PlatformService) {
    this.storage = new MemoryStorage(platform);
  }

  /**
   * Extract memories from a conversation using AI
   */
  async extractFromConversation(
    prompt: ExtractionPrompt,
    apiKey: string,
    modelId: string = 'gpt-4',
    baseUrl: string = 'https://api.openai.com/v1'
  ): Promise<ExtractedMemory[]> {
    const systemPrompt = `You are a memory extraction assistant. Your task is to identify and extract meaningful information from conversations that should be remembered for future interactions.

Extract memories in these categories:

1. **user** (User Preferences): Coding style preferences, favorite libraries, workflow habits, personal opinions
   Example: "User prefers Plotly over Matplotlib for visualizations"

2. **feedback** (Feedback/Corrections): Corrections to previous statements, feedback on suggestions, things that didn't work
   Example: "The suggested approach using pandas.merge() caused performance issues with large datasets"

3. **project** (Project-Specific Knowledge): Project structure, data sources, important patterns, project-specific decisions
   Example: "This project uses a microservices architecture with FastAPI backend"

4. **reference** (Technical References): Code snippets, API patterns, useful commands, documentation links
   Example: "To connect to PostgreSQL: psycopg2.connect(host='localhost', database='mydb')"

Guidelines:
- Only extract information that is genuinely useful for future reference
- Be concise but specific
- Include enough context to understand the memory later
- Don't extract trivial or obvious information
- Focus on actionable insights

Return a JSON array of extracted memories with fields:
- content: The memory content (string)
- type: One of 'user', 'feedback', 'project', 'reference'
- confidence: Confidence score 0-1 (only include if > 0.7)
- context: Optional additional context

Example output:
[
  {
    "content": "User prefers using seaborn for statistical visualizations and matplotlib for custom plots",
    "type": "user",
    "confidence": 0.95,
    "context": "Mentioned when discussing visualization options for the EDA task"
  },
  {
    "content": "Project uses SQLite database located at ./data/app.db with SQLAlchemy ORM",
    "type": "project",
    "confidence": 0.9,
    "context": "Discussed during database connection troubleshooting"
  }
]`;

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt.conversation },
          ],
          temperature: 0.3,  // Low temperature for consistent extraction
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Extraction API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return [];
      }

      // Parse JSON response
      const memories = JSON.parse(content) as ExtractedMemory[];

      // Filter by confidence threshold
      const highConfidence = memories.filter(m => m.confidence >= 0.7);

      return highConfidence;
    } catch (error) {
      console.error('Failed to extract memories:', error);
      return [];
    }
  }

  /**
   * Save extracted memories to appropriate storage layer
   */
  async saveMemories(
    memories: ExtractedMemory[],
    projectId?: string,
    sessionId?: string
  ): Promise<MemoryEntry[]> {
    const saved: MemoryEntry[] = [];

    for (const memory of memories) {
      const entry: MemoryEntry = {
        id: uuidv4(),
        type: memory.type,
        content: memory.content,
        context: memory.context,
        timestamp: new Date().toISOString(),
        sessionId,
        projectId,
        isPinned: false,
      };

      // Determine storage layer based on type
      if (memory.type === 'user') {
        // User preferences go to user layer
        const existing = await this.storage.loadUserMemory();
        await this.storage.saveUserMemory([...existing, entry]);
      } else if (memory.type === 'project' && projectId) {
        // Project knowledge goes to project layer
        const existing = await this.storage.loadProjectMemory(projectId);
        await this.storage.promoteToProjectMemory(projectId, [entry]);
      } else {
        // Feedback and references go to session layer initially
        // They can be promoted later via Dream Mode
        await this.storage.saveSessionMemory(sessionId || 'default', [entry]);
      }

      saved.push(entry);
    }

    return saved;
  }

  /**
   * Process conversation and auto-save memories
   */
  async processAndSave(
    prompt: ExtractionPrompt,
    apiKey: string,
    modelId?: string,
    baseUrl?: string
  ): Promise<MemoryEntry[]> {
    const extracted = await this.extractFromConversation(
      prompt,
      apiKey,
      modelId,
      baseUrl
    );

    if (extracted.length === 0) {
      console.log('No high-confidence memories extracted');
      return [];
    }

    const saved = await this.saveMemories(
      extracted,
      prompt.projectId
    );

    console.log(`Extracted and saved ${saved.length} memories`);
    return saved;
  }

  /**
   * Manual memory creation (for UI input)
   */
  async createManualMemory(
    content: string,
    type: MemoryType,
    projectId?: string,
    context?: string
  ): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: uuidv4(),
      type,
      content,
      context,
      timestamp: new Date().toISOString(),
      projectId,
      isPinned: false,
    };

    if (type === 'user') {
      const existing = await this.storage.loadUserMemory();
      await this.storage.saveUserMemory([...existing, entry]);
    } else if (type === 'project' && projectId) {
      await this.storage.promoteToProjectMemory(projectId, [entry]);
    } else {
      await this.storage.saveSessionMemory('manual', [entry]);
    }

    return entry;
  }
}
