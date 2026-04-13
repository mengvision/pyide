import type { VariableInfo } from '@pyide/protocol/kernel';

interface KernelStateSnapshot {
  variables: VariableInfo[];
  connectionStatus: string;
}

export function buildSystemPrompt(kernelState: KernelStateSnapshot): string {
  const variableLines =
    kernelState.variables.length > 0
      ? kernelState.variables
          .map((v) => {
            const shape = (v as any).shape ? ` (shape: ${(v as any).shape})` : '';
            return `- ${v.name}: ${v.type}${shape}`;
          })
          .join('\n')
      : '(no variables defined yet)';

  const kernelSection =
    kernelState.connectionStatus === 'connected'
      ? `Kernel is running. Current variables:\n${variableLines}`
      : 'Kernel is not connected.';

  return `You are an AI assistant integrated into PyIDE, an AI-native Python IDE for data science and machine learning.

## Current Kernel State
${kernelSection}

## Instructions
- When suggesting code, put it in Python code blocks (\`\`\`python)
- The user can execute code blocks directly from the chat
- Be concise and practical
- Focus on data science, ML, and Python development tasks
- When the user shares an error, analyze it and provide a fix`;
}
