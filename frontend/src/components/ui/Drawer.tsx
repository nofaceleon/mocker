import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
  footer?: ReactNode;
};

const widthClasses = {
  sm: 'w-[420px]',
  md: 'w-[560px]',
  lg: 'w-[760px]',
  xl: 'w-[960px]',
};

export function Drawer({ open, onClose, title, width = 'md', children, footer }: DrawerProps) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute right-0 top-0 flex h-full flex-col bg-white shadow-lg',
          widthClasses[width],
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
          <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-tertiary hover:bg-canvas-subtle hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4 scrollbar-thin">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-canvas-subtle/50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
