import { useRef, useState } from 'react';
import { UploadCloud, FileText, X, AlertTriangle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { CodeEditor } from '@/components/CodeEditor';

type JsonImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImport: (raw: string) => void;
};

export function JsonImportModal({ open, onClose, onImport }: JsonImportModalProps) {
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setContent('');
    setFileName('');
    setError(null);
    setIsDragging(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const readFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError(`文件过大（${(file.size / 1024 / 1024).toFixed(2)} MB），最大支持 5MB`);
      return;
    }
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = typeof e.target?.result === 'string' ? e.target.result : '';
      setContent(text);
    };
    reader.onerror = () => {
      setError('文件读取失败');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const handleImport = () => {
    if (!content.trim()) {
      setError('请先选择文件或粘贴文本');
      return;
    }
    setError(null);
    try {
      JSON.parse(content);
    } catch {
      setError('JSON 格式不正确，请检查后重试');
      return;
    }
    onImport(content);
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="导入 JSON"
      width="xl"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            取消
          </Button>
          <Button variant="primary" onClick={handleImport} disabled={!content.trim()}>
            导入
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          className={[
            'rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
            isDragging
              ? 'border-ink bg-canvas-subtle'
              : 'border-line bg-canvas-subtle/30 hover:border-ink-tertiary',
          ].join(' ')}
        >
          <UploadCloud className="mx-auto mb-3 h-8 w-8 text-ink-tertiary" />
          {fileName ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border border-line bg-canvas-elevated px-3 py-1.5 text-[12.5px] text-ink">
                <FileText className="h-3.5 w-3.5 text-ink-secondary" />
                <span>{fileName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFileName('');
                    setContent('');
                    setError(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="ml-1 text-ink-subtle hover:text-danger"
                  title="清除"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="text-[11.5px] text-ink-subtle">
                已读取 {(content.length / 1024).toFixed(1)} KB ·{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-ink-secondary underline hover:text-ink"
                >
                  重新选择
                </button>
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-ink-secondary">拖拽文件到此处，或</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-[13px] font-medium text-ink underline-offset-2 hover:underline"
              >
                点击选择文件
              </button>
              <p className="mt-2 text-[11.5px] text-ink-subtle">支持 .json 格式，最大 5 MB</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div>
          <label className="form-label">或直接粘贴文本</label>
          <CodeEditor
            className="mt-1"
            language="json"
            value={content}
            onChange={(v) => {
              setContent(v);
              setError(null);
            }}
            height={128}
            invalid={!!error}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
