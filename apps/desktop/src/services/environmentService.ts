/**
 * Environment template service for remote kernel mode.
 * 
 * Manages interaction with the server's environment template API,
 * allowing users to list and select Python environment templates.
 * 
 * All requests include automatic 401 retry: if the initial request fails
 * with HTTP 401, the token is refreshed and the request is retried once.
 */

import type { PlatformService } from '@pyide/platform';
import { refreshToken } from '../utils/authApi';

export interface EnvironmentTemplate {
  id: number;
  name: string;
  display_name: string;
  python_version: string;
  packages: string[];
  description?: string;
  is_active: boolean;
}

/**
 * Internal helper: make a fetch request with Bearer token.
 * If the server responds with 401, attempt to refresh the token and retry once.
 */
async function authFetchWithRetry(
  platform: PlatformService,
  serverUrl: string,
  url: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const doFetch = (t: string) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${t}`,
        ...(options.headers ?? {}),
      },
    });

  const response = await doFetch(token);

  if (response.status === 401) {
    // Token may be expired — try refreshing
    console.warn('[environmentService] Got 401, attempting token refresh…');
    const newToken = await refreshToken(platform, serverUrl);
    if (newToken) {
      return doFetch(newToken);
    }
  }

  return response;
}

/**
 * Fetch all active environment templates from the server.
 * 
 * @param serverUrl - Base URL of the PyIDE server (e.g., 'http://localhost:8000')
 * @param token - JWT authentication token
 * @returns Array of environment templates
 */
export async function listEnvironmentTemplates(
  serverUrl: string,
  token: string,
  platform?: PlatformService,
): Promise<EnvironmentTemplate[]> {
  const baseUrl = serverUrl.replace(/\/$/, '');
  const url = `${baseUrl}/api/v1/environments/templates`;

  let response: Response;
  if (platform) {
    response = await authFetchWithRetry(platform, serverUrl, url, token);
  } else {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch environment templates: ${response.status}`);
  }

  return response.json();
}

/**
 * Start a remote kernel with a specific environment template.
 * 
 * @param serverUrl - Base URL of the PyIDE server
 * @param token - JWT authentication token
 * @param envTemplateId - Optional environment template ID (null for system Python)
 * @returns Kernel information including port and WebSocket URL
 */
export async function startKernelWithTemplate(
  serverUrl: string,
  token: string,
  envTemplateId: number | null = null,
  platform?: PlatformService,
): Promise<{
  user_id: number;
  username: string;
  port: number;
  ws_url: string;
  alive: boolean;
}> {
  const baseUrl = serverUrl.replace(/\/$/, '');
  const url = `${baseUrl}/api/v1/kernels/create`;
  const fetchOptions: RequestInit = {
    method: 'POST',
    body: JSON.stringify({
      env_template_id: envTemplateId,
    }),
  };

  let response: Response;
  if (platform) {
    response = await authFetchWithRetry(platform, serverUrl, url, token, fetchOptions);
  } else {
    response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to start kernel: ${response.status} - ${error}`);
  }

  return response.json();
}
