import { create } from 'zustand';
import type { AgentInstance, AgentUsage } from '../services/AgentManager';

const CHAT_HISTORY_KEY = 'pyide-chat-history';
const MAX_HISTORY = 100;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export type ChatMode = 'chat' | 'assist' | 'agent';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  sessionCost: number;
  chatMode: ChatMode;

  // Agent management
  agents: AgentInstance[];
  activeAgentId: string;
  totalTokenUsage: AgentUsage;

  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateLastAssistantMessage: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
  addCost: (cost: number) => void;
  clearChat: () => void;
  clearHistory: () => void;
  setChatMode: (mode: ChatMode) => void;

  // Agent actions
  setActiveAgent: (id: string) => void;
  updateAgents: (agents: AgentInstance[]) => void;
  updateTokenUsage: (usage: AgentUsage) => void;
}

function loadPersistedMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ChatMessage[];
  } catch {
    // ignore parse errors
  }
  return [];
}

function persistMessages(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  } catch {
    // ignore storage errors
  }
}

export const useChatStore = create<ChatState>((set) => ({
  messages: loadPersistedMessages(),
  isStreaming: false,
  sessionCost: 0,
  chatMode: 'chat' as ChatMode,

  // Agent state — seeded by AgentManager singleton updates
  agents: [],
  activeAgentId: 'main',
  totalTokenUsage: { input: 0, output: 0, cost: 0 },

  addMessage: (msg) =>
    set((state) => {
      const messages = [
        ...state.messages,
        {
          ...msg,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        },
      ];
      persistMessages(messages);
      return { messages };
    }),

  updateLastAssistantMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      // Find last assistant message index
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          messages[i] = { ...messages[i], content };
          break;
        }
      }
      persistMessages(messages);
      return { messages };
    }),

  setStreaming: (streaming) => set(() => ({ isStreaming: streaming })),

  addCost: (cost) =>
    set((state) => ({ sessionCost: state.sessionCost + cost })),

  clearChat: () => {
    persistMessages([]);
    set(() => ({ messages: [], isStreaming: false }));
  },

  clearHistory: () => {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    set(() => ({ messages: [], isStreaming: false }));
  },

  setChatMode: (mode) => set(() => ({ chatMode: mode })),

  setActiveAgent: (id) => set(() => ({ activeAgentId: id })),

  updateAgents: (agents) => set(() => ({ agents })),

  updateTokenUsage: (usage) => set(() => ({ totalTokenUsage: usage })),
}));
