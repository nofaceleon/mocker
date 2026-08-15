import Editor, { type OnMount } from '@monaco-editor/react';
import { forwardRef, useId, useImperativeHandle, useRef } from 'react';
import { IndentIncrease } from 'lucide-react';
import { toast } from 'sonner';
import type { editor as MonacoEditor } from 'monaco-editor';
import { cn } from '@/lib/cn';

const LINE_HEIGHT = 22;
const PADDING_Y = 24;

export type CodeEditorHandle = {
  focus: () => void;
  getElement: () => HTMLDivElement | null;
};

type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  language?: string;
  /** 固定高度；不传时按 rows 估算，默认 200 */
  height?: number | string;
  /** 按行数估算高度（约 22px/行 + 上下内边距） */
  rows?: number;
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  /** Monaco model path，用于区分多实例；不传则自动生成 */
  path?: string;
};

let themeDefined = false;

function ensureTheme(monaco: Parameters<OnMount>[1]) {
  if (themeDefined) return;
  monaco.editor.defineTheme('mockhub-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#18181B',
      'editor.lineHighlightBackground': '#27272A',
      'editorLineNumber.foreground': '#52525B',
      'editorLineNumber.activeForeground': '#A1A1AA',
      'editor.selectionBackground': '#4A4A6A80',
      'editorCursor.foreground': '#E4E4E7',
    },
  });
  themeDefined = true;
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  {
    value,
    onChange,
    onBlur,
    language = 'javascript',
    height,
    rows,
    readOnly = false,
    disabled = false,
    invalid = false,
    className,
    path,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;
  const autoId = useId();
  const isReadOnly = readOnly || disabled;
  const resolvedHeight = height ?? (rows != null ? rows * LINE_HEIGHT + PADDING_Y : 200);
  const modelPath = path ?? `inmemory://mockhub/${language}/${autoId.replace(/:/g, '')}`;

  useImperativeHandle(ref, () => ({
    focus: () => {
      editorRef.current?.focus();
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    getElement: () => containerRef.current,
  }));

  const isFormattable = !isReadOnly && (language === 'javascript' || language === 'json');

  const formatDocument = async () => {
    const ed = editorRef.current;
    if (!ed) return;
    if (language === 'json') {
      // JSON：本地确定性格式化，不依赖 monaco worker
      const raw = ed.getValue();
      if (!raw.trim()) return;
      try {
        const parsed = JSON.parse(raw);
        const model = ed.getModel();
        if (!model) return;
        ed.executeEdits('format', [
          { range: model.getFullModelRange(), text: JSON.stringify(parsed, null, 2) },
        ]);
      } catch (e) {
        toast.error('JSON 格式化失败：' + (e instanceof Error ? e.message : '语法错误'));
      }
      return;
    }
    // JavaScript：monaco 内置格式化（TypeScript 语言服务）
    const action = ed.getAction('editor.action.formatDocument');
    if (action) {
      await action.run();
    } else {
      toast.error('当前编辑器暂不支持格式化');
    }
  };

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    ensureTheme(monaco);
    monaco.editor.setTheme('mockhub-dark');
    ed.updateOptions({
      fontSize: 12.5,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      lineHeight: LINE_HEIGHT,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 2,
      automaticLayout: true,
      padding: { top: 12, bottom: 12 },
      renderLineHighlight: isReadOnly ? 'none' : 'line',
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      folding: language === 'json' || language === 'javascript' || language === 'markdown',
      lineNumbersMinChars: 3,
      glyphMargin: false,
      renderValidationDecorations: 'on',
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
    });
    ed.onDidBlurEditorWidget(() => {
      onBlurRef.current?.();
    });
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className={cn(
        'group relative overflow-hidden rounded-md border bg-[#18181B] outline-none',
        invalid ? 'border-danger' : 'border-[#27272A]',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      {isFormattable && (
        <button
          type="button"
          onClick={formatDocument}
          title="格式化代码（Shift+Alt+F）"
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-[#27272A] bg-[#1f1f23] px-1.5 py-1 text-[11px] text-[#A1A1AA] opacity-0 transition-opacity hover:border-[#3F3F46] hover:text-[#E4E4E7] focus-visible:opacity-100 group-hover:opacity-100"
        >
          <IndentIncrease className="h-3 w-3" />
          格式化
        </button>
      )}
      <Editor
        height={resolvedHeight}
        language={language}
        path={modelPath}
        value={value}
        onChange={(v) => onChange?.(v ?? '')}
        onMount={handleMount}
        theme="mockhub-dark"
        options={{
          readOnly: isReadOnly,
          domReadOnly: isReadOnly,
          contextmenu: !isReadOnly,
        }}
        loading={
          <div
            className="flex items-center justify-center bg-[#18181B] text-[12px] text-zinc-500"
            style={{ height: typeof resolvedHeight === 'number' ? resolvedHeight : undefined }}
          >
            编辑器加载中…
          </div>
        }
      />
    </div>
  );
});
