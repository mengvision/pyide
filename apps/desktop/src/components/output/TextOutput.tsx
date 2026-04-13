import { useCallback } from 'react';
import styles from './TextOutput.module.css';

interface TextOutputProps {
  data: { text: string };
}

interface AnsiSpan {
  text: string;
  bold?: boolean;
  color?: string;
}

const ANSI_COLOR_MAP: Record<string, string> = {
  '31': 'var(--status-error)',
  '32': 'var(--status-success)',
  '33': 'var(--status-warning)',
  '34': '#3b82f6',
  '35': '#a855f7',
  '36': '#06b6d4',
};

function parseAnsi(text: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  // Regex to match ANSI escape codes
  const ansiRegex = /\x1b\[(\d+)m/g;

  let lastIndex = 0;
  let currentBold = false;
  let currentColor: string | undefined;

  let match: RegExpExecArray | null;
  while ((match = ansiRegex.exec(text)) !== null) {
    // Push text before this escape code
    if (match.index > lastIndex) {
      spans.push({
        text: text.slice(lastIndex, match.index),
        bold: currentBold,
        color: currentColor,
      });
    }

    const code = match[1];
    if (code === '0') {
      currentBold = false;
      currentColor = undefined;
    } else if (code === '1') {
      currentBold = true;
    } else if (ANSI_COLOR_MAP[code]) {
      currentColor = ANSI_COLOR_MAP[code];
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    spans.push({
      text: text.slice(lastIndex),
      bold: currentBold,
      color: currentColor,
    });
  }

  // If no ANSI codes were found, return single span
  if (spans.length === 0) {
    spans.push({ text });
  }

  return spans;
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[\d+m/g, '');
}

export function TextOutput({ data }: TextOutputProps) {
  const text = data.text ?? '';
  const spans = parseAnsi(text);

  const handleCopy = useCallback(() => {
    const plain = stripAnsi(text);
    navigator.clipboard.writeText(plain).catch(() => {});
  }, [text]);

  return (
    <div className={styles.container}>
      <button className={styles.copyBtn} onClick={handleCopy} title="Copy text">
        📋
      </button>
      <pre className={styles.pre}>
        {spans.map((span, i) => (
          <span
            key={i}
            style={{
              fontWeight: span.bold ? 'bold' : undefined,
              color: span.color,
            }}
          >
            {span.text}
          </span>
        ))}
      </pre>
    </div>
  );
}
