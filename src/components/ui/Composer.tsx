import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { ArrowUp } from 'lucide-react';

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

export function ComposerRoot({
  children,
  id,
  className,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div id={id} className={cx('composer-root', className)} style={{ borderRadius: 0 }}>
      {children}
    </div>
  );
}

export function ComposerCard({
  children,
  id,
  className,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div id={id} className={cx('composer-card card flex flex-col', className)} style={{ borderRadius: 0, boxShadow: 'none' }}>
      {children}
    </div>
  );
}

export function ComposerAttachments({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('composer-attachments', className)}>
      {children}
    </div>
  );
}

export function ComposerRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('composer-row relative', className)}>
      <div className="composer-row-inner flex items-center">
        {children}
      </div>
    </div>
  );
}

export function ComposerLeft({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('composer-left flex items-center', className)}>
      {children}
    </div>
  );
}

export const ComposerIconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cx('btn-icon composer-tool-button', className)}
      {...props}
    />
  )
);

export const ComposerInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cx('composer-input', className)}
      {...props}
    />
  )
);

export const ComposerTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cx('composer-input composer-textarea', className)}
      {...props}
    />
  )
);

export function ComposerSendButton({
  onClick,
  disabled,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-send"
      title={title}
    >
      <ArrowUp size={14} />
    </button>
  );
}
