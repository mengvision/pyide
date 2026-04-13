/**
 * Environment template service for remote kernel mode.
 * 
 * Manages interaction with the server's environment template API,
 * allowing users to list and select Python environment templates.
 */

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
 * Fetch all active environment templates from the server.
 * 
 * @param serverUrl - Base URL of the PyIDE server (e.g., 'http://localhost:8000')
 * @param token - JWT authentication token
 * @returns Array of environment templates
 */
export async function listEnvironmentTemplates(
  serverUrl: string,
  token: string,
): Promise<EnvironmentTemplate[]> {
  const baseUrl = serverUrl.replace(/\/$/, '');
  
  const response = await fetch(`${baseUrl}/api/v1/environments/templates`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

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
): Promise<{
  user_id: number;
  username: string;
  port: number;
  ws_url: string;
  alive: boolean;
}> {
  const baseUrl = serverUrl.replace(/\/$/, '');
  
  const response = await fetch(`${baseUrl}/api/v1/kernels/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      env_template_id: envTemplateId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to start kernel: ${response.status} - ${error}`);
  }

  return response.json();
}
