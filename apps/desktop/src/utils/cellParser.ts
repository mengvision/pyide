export interface CellInfo {
  index: number;
  title: string;
  startLine: number; // 0-based line number
  endLine: number;   // 0-based, inclusive
  code: string;
}

const CELL_DELIMITER = /^#\s*%%(.*)$/;

export function parseCells(content: string): CellInfo[] {
  if (!content || content.trim() === '') {
    return [
      {
        index: 0,
        title: 'Cell 1',
        startLine: 0,
        endLine: 0,
        code: '',
      },
    ];
  }

  const lines = content.split('\n');
  const delimiterLines: Array<{ lineIndex: number; title: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(CELL_DELIMITER);
    if (match) {
      const rawTitle = match[1].trim();
      // Strip [markdown] style tags like "# %% [markdown]"
      const title = rawTitle.replace(/^\[.*?\]\s*/, '').trim() || `Cell ${delimiterLines.length + 1}`;
      delimiterLines.push({ lineIndex: i, title });
    }
  }

  if (delimiterLines.length === 0) {
    // No cell delimiters — treat entire file as one cell
    return [
      {
        index: 0,
        title: 'Cell 1',
        startLine: 0,
        endLine: lines.length - 1,
        code: content,
      },
    ];
  }

  const cells: CellInfo[] = [];

  for (let i = 0; i < delimiterLines.length; i++) {
    const startLine = delimiterLines[i].lineIndex;
    const endLine =
      i + 1 < delimiterLines.length
        ? delimiterLines[i + 1].lineIndex - 1
        : lines.length - 1;

    const cellLines = lines.slice(startLine, endLine + 1);
    const code = cellLines.join('\n');

    cells.push({
      index: i,
      title: delimiterLines[i].title,
      startLine,
      endLine,
      code,
    });
  }

  return cells;
}
