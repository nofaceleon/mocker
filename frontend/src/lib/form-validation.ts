import { toast } from 'sonner';

/** 滚动到目标元素并聚焦 */
export function focusField(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // 等滚动启动后再 focus，避免被布局打断
  requestAnimationFrame(() => {
    if (typeof el.focus === 'function') {
      el.focus();
    }
  });
}

/** toast 报错并聚焦到对应字段 */
export function reportFieldError(
  message: string,
  el?: HTMLElement | null | undefined,
): void {
  toast.error(message);
  focusField(el);
}
