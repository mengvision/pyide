/**
 * Chat API Service
 *
 * Routes AI chat through the Phase 3 server (server manages API keys).
 * The browser never talks to the LLM provider directly.
 */

import type { ChatCompletionMessage } from '@desktop/services/ChatEngine';

export type { ChatCompletionMessage };

export interface ChatCompletionSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatSession {
  id: string;
  messages: ChatCompletionMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface StreamChunk {
  type: 'token' | 'done' | 'error';
  content?: string;
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// ── Chat completions ──────────────────────────────────────────────────────────

/**
 * Send a chat completion request to the server with SSE streaming.
 *
 * The `onToken` callback is invoked for each delta chunk.
 * `onComplete` is called with the full accumulated content when the stream ends.
 * `onError` is called on network or server errors.
 */
export async function sendMessage(
  serverUrl: string,
  token: string,
  messages: ChatCompletionMessage[],
  onToken: (delta: string) => void,
  onComplete: (fullContent: string) => void,
  onError: (error: Error) => void,
  signal?: AbortSignal,
  settings?: ChatCompletionSettings,
): Promise<void> {
  const url = `${serverUrl.replace(/\/$/, '')}/api/chat/completions`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        messages,
        stream: true,
        ...(settings?.model ? { model: settings.model } : {}),
        ...(settings?.temperature !== undefined ? { temperature: settings.temperature } : {}),
        ...(settings?.maxTokens !== undefined ? { max_tokens: settings.maxTokens } : {}),
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

      const lines = buffer.split('\n');
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
          // Skip malformed SSE chunks
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

  // Stream ended without explicit [DONE] marker
  onComplete(fullContent);
}

// ── Chat history ──────────────────────────────────────────────────────────────

/**
 * Fetch stored chat sessions for the authenticated user.
 */
export async function getChatHistory(
  serverUrl: string,
  token: string,
): Promise<ChatSession[]> {
  const url = `${serverUrl.replace(/\/$/, '')}/api/chat/history`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`getChatHistory failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<ChatSession[]>;
}

/**
 * Persist a chat session on the server.
 */
export async function saveChatSession(
  serverUrl: string,
  token: string,
  session: Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ChatSession> {
  const url = `${serverUrl.replace(/\/$/, '')}/api/chat/history`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(session),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`saveChatSession failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<ChatSession>;
}
