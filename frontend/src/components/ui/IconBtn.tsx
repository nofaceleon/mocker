import { type ReactNode } from 'react';

type IconBtnProps = {
  children: ReactNode;
  title?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
  danger?: boolean;
};

export function IconBtn({
  children,
  title,
  onClick,
  type = 'button',
  className,
  danger,
}: IconBtnProps) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      className={`icon-btn ${danger ? 'hover:!border-danger-border hover:!bg-danger-soft hover:!text-danger' : ''} ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
