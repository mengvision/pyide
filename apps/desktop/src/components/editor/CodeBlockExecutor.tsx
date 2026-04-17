import { useState, useEffect, useRef } from 'react';

interface CodeBlockExecutorProps {
  executeCode?: (code: string, cellId?: string) => Promise<any>;
  fileId: string;
  markdownContent?: string;
}

const EXECUTABLE_LANGUAGES = ['python', 'python3', 'py'];

/**
 * CodeBlockExecutor - Injects run buttons into Python code blocks in Milkdown editor
 */
export default function CodeBlockExecutor({ executeCode, fileId, markdownContent }: CodeBlockExecutorProps) {
  const observerRef = useRef<MutationObserver | null>(null);
  const milkdownContainerRef = useRef<Element | null>(null);

  // Inject run buttons into Python code blocks
  useEffect(() => {
    if (!executeCode || !markdownContent) return;

    let isInjecting = false;

    const injectButtons = () => {
      if (isInjecting) return;
      isInjecting = true;

      if (observerRef.current) observerRef.current.disconnect();

      try {
        const codeBlocks = document.querySelectorAll('.milkdown pre');
        if (codeBlocks.length === 0) return;

        // Check if already injected
        const hasButtons = Array.from(codeBlocks).some(
          pre => pre.querySelector('.code-executor-btn')
        );
        if (hasButtons) return;

        console.log('[CodeBlockExecutor] Found', codeBlocks.length, 'code blocks');

        let pythonBlockIndex = 0;

        codeBlocks.forEach((preElement) => {
          const codeElement = preElement.querySelector('code');
          if (!codeElement) return;

          const code = codeElement.textContent || '';
          const isPython = /\b(print|def |class |import |from .* import|if __name__|for .+ in|while |try:|except|return )\b/.test(code);
          if (!isPython) return;

          const cellId = `md-cell-${fileId}-${pythonBlockIndex}`;
          pythonBlockIndex++;

          // Make pre position relative
          (preElement as HTMLElement).style.position = 'relative';

          // Create button
          const runBtn = document.createElement('button');
          runBtn.className = 'code-executor-btn';
          runBtn.textContent = '▶ Run';
          runBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            padding: 8px 16px;
            background: #4caf50;
            color: white;
            border: 2px solid #fff;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          `;

          runBtn.onmouseenter = () => { runBtn.style.background = '#45a049'; };
          runBtn.onmouseleave = () => { runBtn.style.background = '#4caf50'; };

          // Append to pre
          preElement.appendChild(runBtn);

          // Click handler
          runBtn.onclick = async () => {
            const code = codeElement.textContent || '';
            runBtn.disabled = true;
            runBtn.textContent = '⏳ Running...';
            runBtn.style.background = '#ccc';

            const existingResult = preElement.querySelector('.execution-result');
            if (existingResult) existingResult.remove();

            try {
              (window as any).__executingCellId = cellId;
              const result = await executeCode(code, cellId);
              await new Promise(resolve => setTimeout(resolve, 200));

              const resultDiv = document.createElement('div');
              resultDiv.className = 'execution-result';
              resultDiv.style.cssText = `
                margin-top: 8px;
                padding: 8px 12px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 13px;
                white-space: pre-wrap;
                word-break: break-word;
              `;

              if (result?.status === 'error') {
                resultDiv.style.cssText += `
                  background: #ffebee;
                  border-left: 3px solid #f44336;
                  color: #c62828;
                `;
                resultDiv.textContent = result.error?.data?.traceback?.join('\n') 
                  ?? result.error?.message 
                  ?? 'Unknown error';
              } else {
                const outputs = (window as any).__cellOutputs?.[cellId];
                const textOutput = outputs?.filter((o: any) => o.type === 'text')
                  .map((o: any) => o.data?.text).join('\n');

                if (textOutput) {
                  resultDiv.style.cssText += `
                    background: #e8f5e9;
                    border-left: 3px solid #4caf50;
                    color: #2e7d32;
                  `;
                  resultDiv.textContent = textOutput;
                } else {
                  resultDiv.style.cssText += `
                    background: #f5f5f5;
                    border-left: 3px solid #9e9e9e;
                    color: #757575;
                    font-style: italic;
                  `;
                  resultDiv.textContent = '(No output)';
                }
              }

              preElement.parentNode?.insertBefore(resultDiv, preElement.nextSibling);
            } catch (err: any) {
              const errorDiv = document.createElement('div');
              errorDiv.className = 'execution-result';
              errorDiv.style.cssText = `
                margin-top: 8px;
                padding: 8px 12px;
                background: #ffebee;
                border-left: 3px solid #f44336;
                color: #c62828;
                font-family: monospace;
                font-size: 13px;
                white-space: pre-wrap;
              `;
              errorDiv.textContent = err?.message ?? String(err);
              preElement.parentNode?.insertBefore(errorDiv, preElement.nextSibling);
            } finally {
              runBtn.disabled = false;
              runBtn.textContent = '▶ Run';
              runBtn.style.background = '#4caf50';
              (window as any).__executingCellId = undefined;
            }
          };
        });

        if (pythonBlockIndex > 0) {
          console.log(`[CodeBlockExecutor] Injected ${pythonBlockIndex} buttons`);
        }
      } finally {
        isInjecting = false;
        setTimeout(() => {
          if (observerRef.current && milkdownContainerRef.current) {
            observerRef.current.observe(milkdownContainerRef.current, {
              childList: true,
              subtree: true,
            });
          }
        }, 3000);
      }
    };

    // Initial injection with retry
    let retryCount = 0;
    const tryInject = () => {
      const codeBlocks = document.querySelectorAll('.milkdown pre');
      if (codeBlocks.length === 0 && retryCount < 10) {
        retryCount++;
        setTimeout(tryInject, 500);
      } else {
        injectButtons();
      }
    };
    setTimeout(tryInject, 300);

    // Setup MutationObserver
    milkdownContainerRef.current = document.querySelector('.milkdown');
    if (milkdownContainerRef.current) {
      observerRef.current = new MutationObserver(() => {
        setTimeout(injectButtons, 500);
      });
      observerRef.current.observe(milkdownContainerRef.current, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [executeCode, fileId]);

  return null;
}
