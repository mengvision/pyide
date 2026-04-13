import { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useKernelContext } from '../../contexts/KernelContext';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { ChatMessage as ChatMessageType } from '../../stores/chatStore';
import styles from './ChatMessage.module.css';

interface ChatMessageProps {
  message: ChatMessageType;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const { executeCode } = useKernelContext();
  const { files, activeFileId, updateFileContent } = useEditorStore();
  const theme = useSettingsStore((s) => s.theme);

  const isDark = theme === 'dark' || theme === 'system';

  const handleExecute = useCallback(() => {
    executeCode(code, `chat-${Date.now()}`).catch(console.error);
  }, [executeCode, code]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
  }, [code]);

  const handleInsert = useCallback(() => {
    if (!activeFileId) return;
    const activeFile = files.find((f) => f.id === activeFileId);
    if (!activeFile) return;
    const separator = activeFile.content.endsWith('\n') ? '' : '\n';
    updateFileContent(activeFileId, `${activeFile.content}${separator}\n# --- Inserted from AI Chat ---\n${code}\n`);
  }, [activeFileId, files, updateFileContent, code]);

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{language || 'code'}</span>
        <div className={styles.codeActions}>
          <button className={styles.codeBtn} onClick={handleExecute} title="Execute in kernel">
            ▶ Run
          </button>
          <button className={styles.codeBtn} onClick={handleCopy} title="Copy to clipboard">
            📋 Copy
          </button>
          <button className={styles.codeBtn} onClick={handleInsert} title="Insert into editor">
            📝 Insert
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 6px 6px',
          fontSize: '12px',
          background: undefined,
        }}
        PreTag="div"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className={`${styles.message} ${styles.userMessage}`}>
        <div className={styles.bubble}>{message.content}</div>
        <div className={styles.timestamp}>{formatTimestamp(message.timestamp)}</div>
      </div>
    );
  }

  return (
    <div className={`${styles.message} ${styles.assistantMessage}`}>
      <div className={styles.mdContent}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className ?? '');
              const codeStr = String(children).replace(/\n$/, '');
              const isBlock = codeStr.includes('\n') || !!match;

              if (isBlock) {
                return <CodeBlock language={match?.[1] ?? ''} code={codeStr} />;
              }

              return (
                <code className={styles.inlineCode} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      <div className={styles.timestamp}>{formatTimestamp(message.timestamp)}</div>
    </div>
  );
}
