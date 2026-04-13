export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatEngineConfig {
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

export interface ChatContext {
  activeSkills?: string;  // Active skill instructions
  memories?: string;      // Relevant memory context
  mcpTools?: string;      // Available MCP tools
  kernelState?: string;   // Current kernel state
}

export class ChatEngine {
  private config: ChatEngineConfig;
  private context: ChatContext = {};

  constructor(config: ChatEngineConfig) {
    this.config = config;
  }

  updateConfig(config: ChatEngineConfig) {
    this.config = config;
  }

  /**
   * Set chat context (skills, memories, kernel state)
   */
  setContext(context: ChatContext) {
    this.context = context;
  }

  /**
   * Build system prompt with skills and memory context
   */
  private buildSystemPrompt(basePrompt?: string): string {
    const parts: string[] = [];
    
    // Base system prompt
    if (basePrompt) {
      parts.push(basePrompt);
    }
    
    // Add active skills context
    if (this.context.activeSkills) {
      parts.push('\n\n=== ACTIVE SKILLS ===');
      parts.push(this.context.activeSkills);
      parts.push('\nFollow the instructions from active skills when applicable.');
    }
    
    // Add memory context
    if (this.context.memories) {
      parts.push('\n\n=== RELEVANT MEMORIES ===');
      parts.push(this.context.memories);
      parts.push('\nUse these memories to inform your responses.');
    }
    
    // Add MCP tools
    if (this.context.mcpTools) {
      parts.push(this.context.mcpTools);
    }
    
    // Add kernel state
    if (this.context.kernelState) {
      parts.push('\n\n=== KERNEL STATE ===');
      parts.push(this.context.kernelState);
    }
    
    return parts.join('\n');
  }

  async sendMessage(
    messages: ChatCompletionMessage[],
    onToken: (token: string) => void,
    onComplete: (fullContent: string) => void,
    onError: (error: Error) => void,
    signal?: AbortSignal,
    baseSystemPrompt?: string,  // Optional base system prompt
  ): Promise<void> {
    const { baseUrl, apiKey, modelId } = this.config;
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    // Build enhanced messages with system prompt
    const enhancedMessages: ChatCompletionMessage[] = [];
    
    // Add system message with context
    const systemPrompt = this.buildSystemPrompt(baseSystemPrompt);
    if (systemPrompt) {
      enhancedMessages.push({ role: 'system', content: systemPrompt });
    }
    
    // Add conversation messages
    enhancedMessages.push(...messages);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: enhancedMessages,
          stream: true,
        }),
        signal,
      });
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    if (!response.ok) {
      let errorText = `HTTP ${response.status}`;
      try {
        const body = await response.text();
        errorText += `: ${body}`;
      } catch {
        // ignore
      }
      onError(new Error(errorText));
      return;
    }

    if (!response.body) {
      onError(new Error('No response body'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        // Keep last (possibly incomplete) line in buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice('data: '.length).trim();
          if (data === '[DONE]') {
            onComplete(fullContent);
            return;
          }

          try {
            const chunk = JSON.parse(data) as {
              choices: Array<{ delta: { content?: string } }>;
            };
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              onToken(delta);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
      return;
    } finally {
      reader.releaseLock();
    }

    // Stream ended without [DONE]
    onComplete(fullContent);
  }

  /** Approximate token count (chars / 4) */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /** Rough cost: $0.01/1K input tokens, $0.03/1K output tokens */
  estimateCost(inputTokens: number, outputTokens: number): number {
    return inputTokens * 0.00001 + outputTokens * 0.00003;
  }
}
