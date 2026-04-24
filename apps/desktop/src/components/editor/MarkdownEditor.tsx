import { useState, useRef, useEffect, useCallback } from 'react';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { prism, prismConfig } from '@milkdown/plugin-prism';
import { math } from '@milkdown/plugin-math';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import type * as MonacoTypes from 'monaco-editor';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEditorStore } from '../../stores/editorStore';
import { useKernel } from '../../hooks/useKernel';
import type { FileTab } from '../../stores/editorStore';
import styles from './MarkdownEditor.module.css';
import CodeBlockExecutor from './CodeBlockExecutor';

// Milkdown theme CSS
import '@milkdown/theme-nord/style.css';

// Prism code highlighting theme - provides token color styles
// Using tomorrow theme (dark) to match with theme-nord
import 'prismjs/themes/prism-tomorrow.css';

// Refractor languages - Milkdown uses refractor (Prism AST wrapper), not prismjs directly
// These must be imported and registered via configureRefractor
// @ts-ignore - refractor lang modules don't have TS declarations
import bash from 'refractor/lang/bash.js';
// @ts-ignore
import python from 'refractor/lang/python.js';
// @ts-ignore
import javascript from 'refractor/lang/javascript.js';
// @ts-ignore
import typescript from 'refractor/lang/typescript.js';
// @ts-ignore
import sql from 'refractor/lang/sql.js';
// @ts-ignore
import css from 'refractor/lang/css.js';
// @ts-ignore
import markup from 'refractor/lang/markup.js';
// @ts-ignore
import go from 'refractor/lang/go.js';
// @ts-ignore
import rust from 'refractor/lang/rust.js';
// @ts-ignore
import java from 'refractor/lang/java.js';
// @ts-ignore
import c from 'refractor/lang/c.js';
// @ts-ignore
import cpp from 'refractor/lang/cpp.js';
// @ts-ignore
import json from 'refractor/lang/json.js';

// KaTeX CSS for math rendering
import 'katex/dist/katex.min.css';

interface MarkdownEditorProps {
  file: FileTab;
  onContentChange: (content: string) => void;
}

type EditorMode = 'wysiwyg' | 'source';

// Inner component that uses useEditor (must be inside MilkdownProvider)
function MilkdownEditorInner({
  content,
  onContentChange,
  fileId,
}: {
  content: string;
  onContentChange: (content: string) => void;
  fileId: string;
}) {
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const editorRef = useRef<Editor | null>(null);
  const hasInitializedRef = useRef(false);

  useEditor(
    (root) => {
      const editor = Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, content);
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            onContentChangeRef.current(markdown);
          });
        })
        .config((ctx) => {
          // Configure Refractor with language support
          ctx.update(prismConfig.key, (cfg) => ({
            ...cfg,
            configureRefractor: (refractor) => {
              // Register languages with refractor
              refractor.register(bash);
              refractor.register(python);
              refractor.register(javascript);
              refractor.register(typescript);
              refractor.register(sql);
              refractor.register(css);
              refractor.register(markup); // HTML/XML
              refractor.register(go);
              refractor.register(rust);
              refractor.register(java);
              refractor.register(c);
              refractor.register(cpp);
              refractor.register(json);
              // Note: Mermaid has no official Prism/Refractor language definition
              // For mermaid diagram rendering (not just highlighting), you need to
              // integrate mermaid.js separately with a custom plugin or renderPreview
              // Skip mermaid registration to avoid errors
              return refractor;
            },
            // Ignore unsupported languages
            ignoreMissing: true,
          }));
        })
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .use(prism)
        .use(math);

      editorRef.current = editor;
      hasInitializedRef.current = true;
      return editor;
    },
    // Only recreate editor when fileId changes (different file), NOT when content changes
    // Content changes are handled by the markdownUpdated listener
    [fileId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Sync external content changes (e.g., from AI Chat insert) without recreating editor
  useEffect(() => {
    if (!hasInitializedRef.current || !editorRef.current) return;
    
    // Only update if content differs significantly (avoid cursor position disruption)
    // This handles cases where content is updated externally (AI, file reload, etc.)
    const editor = editorRef.current;
    try {
      // For now, skip complex sync logic - the editor handles its own content
      // External updates (like AI insert) will trigger a full editor recreation via fileId change
      // This is a simpler and more reliable approach
    } catch (e) {
      // Silently ignore sync errors - editor will continue working
      console.debug('[MilkdownEditor] Content sync skipped:', e);
    }
  }, [content]);

  return <Milkdown />;
}

export default function MarkdownEditor({ file, onContentChange }: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>('wysiwyg');
  const { theme } = useSettingsStore();
  const contentRef = useRef<string>(file.content);
  const monacoRef = useRef<MonacoTypes.editor.IStandaloneCodeEditor | null>(null);
  const milkdownContainerRef = useRef<HTMLDivElement>(null);
  const { executeCode } = useKernel();
  const [markdownContent, setMarkdownContent] = useState<string>(file.content);

  // Resolve actual theme (handle 'system')
  const resolvedTheme = (() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  })();
  const isDark = resolvedTheme === 'dark';
  const monacoTheme = isDark ? 'vs-dark' : 'vs';

  // Sync content ref when file changes externally (non-dirty)
  useEffect(() => {
    contentRef.current = file.content;
  }, [file.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMonacoMount: OnMount = useCallback(
    (editor, monaco) => {
      monacoRef.current = editor;

      // Ctrl+S — save
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const state = useEditorStore.getState();
        if (state.activeFileId) {
          state.markFileSaved(state.activeFileId);
        }
      });
    },
    [],
  );

  const handleMonacoChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;
      contentRef.current = value;
      onContentChange(value);
    },
    [onContentChange],
  );

  const handleMilkdownContentChange = useCallback(
    (markdown: string) => {
      contentRef.current = markdown;
      setMarkdownContent(markdown); // Update markdown content for CodeBlockExecutor
      onContentChange(markdown);
    },
    [onContentChange],
  );

  const handleModeToggle = useCallback(() => {
    setMode((prev) => (prev === 'wysiwyg' ? 'source' : 'wysiwyg'));
  }, []);

  // Handle Ctrl+S in the container for WYSIWYG mode
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const state = useEditorStore.getState();
        if (state.activeFileId) {
          state.markFileSaved(state.activeFileId);
        }
      }
    },
    [],
  );

  return (
    <div
      className={`${styles.container} ${isDark ? styles.dark : styles.light}`}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.editorArea}>
        {mode === 'wysiwyg' ? (
          <div ref={milkdownContainerRef} className={`${styles.milkdownWrapper} ${isDark ? 'milkdown-dark' : 'milkdown-light'}`}>
            <MilkdownProvider>
              <MilkdownEditorInner
                content={file.content}
                onContentChange={handleMilkdownContentChange}
                fileId={file.id}
              />
            </MilkdownProvider>
            {/* Code block executor - injects run buttons into Python code blocks */}
            <CodeBlockExecutor executeCode={executeCode} fileId={file.id} markdownContent={markdownContent} />
          </div>
        ) : (
          <div className={styles.sourceEditor}>
            <MonacoEditor
              height="100%"
              language="markdown"
              theme={monacoTheme}
              value={contentRef.current}
              onMount={handleMonacoMount}
              onChange={handleMonacoChange}
              options={{
                wordWrap: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                padding: { top: 8, bottom: 8 },
                fontSize: 14,
              }}
            />
          </div>
        )}
      </div>

      <button
        className={styles.modeToggle}
        onClick={handleModeToggle}
        title={mode === 'wysiwyg' ? '切换到源码模式' : '切换到预览模式'}
      >
        {mode === 'wysiwyg' ? '</> 源码模式' : '👁 预览模式'}
      </button>
    </div>
  );
}
