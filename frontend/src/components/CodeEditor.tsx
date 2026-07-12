import Editor, { type OnMount } from '@monaco-editor/react';
import { cn } from '@/lib/cn';

type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  height?: number | string;
  readOnly?: boolean;
  className?: string;
  path?: string;
};

export function CodeEditor({
  value,
  onChange,
  language = 'javascript',
  height = 420,
  readOnly = false,
  className,
  path,
}: CodeEditorProps) {
  const handleMount: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme('mockhub-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#18181B',
        'editor.lineHighlightBackground': '#27272A',
        'editorLineNumber.foreground': '#52525B',
        'editorLineNumber.activeForeground': '#A1A1AA',
      },
    });
    monaco.editor.setTheme('mockhub-dark');
    editor.updateOptions({
      fontSize: 12.5,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      lineHeight: 22,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 2,
      automaticLayout: true,
      padding: { top: 12, bottom: 12 },
      renderLineHighlight: 'line',
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
    });
  };

  return (
    <div className={cn('overflow-hidden rounded-md border border-[#27272A] bg-[#18181B]', className)}>
      <Editor
        height={height}
        language={language}
        path={path}
        value={value}
        onChange={(v) => onChange?.(v ?? '')}
        onMount={handleMount}
        theme="vs-dark"
        options={{
          readOnly,
          domReadOnly: readOnly,
          contextmenu: !readOnly,
        }}
        loading={
          <div className="flex h-full items-center justify-center bg-[#18181B] text-[12px] text-zinc-500">
            编辑器加载中…
          </div>
        }
      />
    </div>
  );
}
