import type { PlatformService } from '@pyide/platform';

/**
 * Helper to make authenticated API calls.
 * Automatically attaches the Bearer token from platform auth storage.
 */
export async function authFetch(
  platform: PlatformService,
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  let token: string | null = null;
  try {
    token = await platform.auth.loadToken();
  } catch {
    // If token cannot be loaded, proceed without auth header
  }

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/**
 * Attempt to refresh the access token using the HTTP-only refresh cookie.
 * Saves the new token to platform auth storage and returns it, or null on failure.
 */
export async function refreshToken(
  platform: PlatformService,
  serverUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(`${serverUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // include HTTP-only refresh cookie
    });
    if (response.ok) {
      const data = await response.json();
      const newToken: string = data.access_token;
      await platform.auth.saveToken(newToken);
      return newToken;
    }
  } catch (e) {
    console.error('Token refresh failed:', e);
  }
  return null;
}
