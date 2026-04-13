/**
 * AgentManager Service
 *
 * Manages the lifecycle of AI agents: main, worker, and background.
 * Tracks token usage and cost per agent across the session.
 */

export type AgentRole = 'main' | 'worker' | 'background';
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

export interface AgentInstance {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  messages: Array<{ role: string; content: string }>;
  tokenUsage: { input: number; output: number };
  allowedTools: string[];
  deniedTools: string[];
  createdAt: number;
}

export interface AgentUsage {
  input: number;
  output: number;
  cost: number;
}

/** Cost per token (rough estimates, configurable) */
const COST_PER_INPUT_TOKEN = 0.000003;   // $3 / 1M tokens
const COST_PER_OUTPUT_TOKEN = 0.000015;  // $15 / 1M tokens

export class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  private mainAgent: AgentInstance;

  private listeners: Array<() => void> = [];

  constructor() {
    this.mainAgent = this.createAgent('main', 'Main Assistant', 'main');
  }

  // ── Subscription ─────────────────────────────────────────────────────────

  /** Subscribe to any agent list / usage changes. Returns unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  // ── Agent CRUD ────────────────────────────────────────────────────────────

  createAgent(
    id: string,
    name: string,
    role: AgentRole,
    config?: { allowedTools?: string[]; deniedTools?: string[] },
  ): AgentInstance {
    const agent: AgentInstance = {
      id,
      name,
      role,
      status: 'idle',
      messages: [],
      tokenUsage: { input: 0, output: 0 },
      allowedTools: config?.allowedTools ?? [],
      deniedTools: config?.deniedTools ?? [],
      createdAt: Date.now(),
    };
    this.agents.set(id, agent);
    this.notify();
    return agent;
  }

  /**
   * Spawn a worker agent with a restricted tool list.
   * Workers cannot spawn further agents.
   */
  spawnWorker(name: string, task: string, allowedTools: string[]): AgentInstance {
    const id = `worker_${Date.now()}`;
    const worker = this.createAgent(id, name, 'worker', { allowedTools });
    worker.messages.push({
      role: 'system',
      content: `You are a worker agent. Your task: ${task}`,
    });
    this.notify();
    return worker;
  }

  /**
   * Register a background agent (e.g. Memory Extractor).
   * Background agents run outside the normal chat loop.
   */
  registerBackground(id: string, name: string): AgentInstance {
    if (this.agents.has(id)) return this.agents.get(id)!;
    return this.createAgent(id, name, 'background');
  }

  getAgent(id: string): AgentInstance | undefined {
    return this.agents.get(id);
  }

  getMainAgent(): AgentInstance {
    return this.mainAgent;
  }

  getAllAgents(): AgentInstance[] {
    return Array.from(this.agents.values());
  }

  getRunningAgents(): AgentInstance[] {
    return this.getAllAgents().filter((a) => a.status === 'running');
  }

  // ── Status ────────────────────────────────────────────────────────────────

  setStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      this.notify();
    }
  }

  // ── Token / Cost Tracking ─────────────────────────────────────────────────

  /**
   * Record token usage for an agent.
   * Call this after each AI completion round.
   */
  trackUsage(agentId: string, inputTokens: number, outputTokens: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.tokenUsage.input += inputTokens;
      agent.tokenUsage.output += outputTokens;
      this.notify();
    }
  }

  /** Aggregate token usage across all agents. */
  getTotalUsage(): AgentUsage {
    let input = 0;
    let output = 0;
    for (const agent of this.agents.values()) {
      input += agent.tokenUsage.input;
      output += agent.tokenUsage.output;
    }
    const cost = input * COST_PER_INPUT_TOKEN + output * COST_PER_OUTPUT_TOKEN;
    return { input, output, cost };
  }

  /** Usage for a single agent. */
  getAgentUsage(agentId: string): AgentUsage {
    const agent = this.agents.get(agentId);
    if (!agent) return { input: 0, output: 0, cost: 0 };
    const { input, output } = agent.tokenUsage;
    const cost = input * COST_PER_INPUT_TOKEN + output * COST_PER_OUTPUT_TOKEN;
    return { input, output, cost };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  /** Remove finished worker agents from memory. */
  cleanup(): void {
    let changed = false;
    for (const [id, agent] of this.agents) {
      if (
        agent.role === 'worker' &&
        (agent.status === 'completed' || agent.status === 'error')
      ) {
        this.agents.delete(id);
        changed = true;
      }
    }
    if (changed) this.notify();
  }
}

/** Singleton shared across the app. */
export const agentManager = new AgentManager();
