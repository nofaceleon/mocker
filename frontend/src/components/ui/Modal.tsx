import { type HTMLAttributes, type ReactNode, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Button } from './Button';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
};

const widthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, footer, width = 'md', children }: ModalProps) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-4">
      <div role="presentation" className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full overflow-hidden rounded-lg bg-white shadow-lg',
          widthClasses[width],
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-ink-tertiary hover:bg-canvas-subtle hover:text-ink"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="max-h-[calc(100vh-180px)] overflow-auto px-5 py-4 scrollbar-modern">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-canvas-subtle/50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

type ConfirmOptions = {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

function ConfirmDialog({
  opts,
  onResult,
}: {
  opts: ConfirmOptions;
  onResult: (ok: boolean) => void;
}) {
  const [open, setOpen] = useState(true);

  const handleClose = (ok: boolean) => {
    setOpen(false);
    onResult(ok);
  };

  return (
    <Modal
      open={open}
      onClose={() => handleClose(false)}
      title={opts.title ?? '请确认'}
      footer={
        <>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            {opts.cancelText ?? '取消'}
          </Button>
          <Button variant={opts.danger ? 'danger' : 'primary'} onClick={() => handleClose(true)}>
            {opts.confirmText ?? '确认'}
          </Button>
        </>
      }
    >
      <div className="text-[13px] text-ink-secondary">{opts.message}</div>
    </Modal>
  );
}

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container);

      const handleResult = (ok: boolean) => {
        resolve(ok);
        setTimeout(() => {
          root.unmount();
          container.remove();
        }, 100);
      };

      root.render(<ConfirmDialog opts={opts} onResult={handleResult} />);
    });
  });
}

export function ModalSection(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('space-y-3', props.className)} />;
}
