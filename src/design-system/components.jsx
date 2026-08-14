import React, { useEffect } from 'react'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}) {
  return (
    <button
      type={props.type || 'button'}
      className={cx('ds-button', `ds-button--${variant}`, size !== 'md' && `ds-button--${size}`, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? '…' : children}
    </button>
  )
}

export function IconButton({ label, className = '', children, ...props }) {
  return (
    <button
      type={props.type || 'button'}
      aria-label={label}
      title={props.title || label}
      className={cx('ds-icon-button', className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({
  variant = 'standard',
  as: Element = 'div',
  className = '',
  children,
  ...props
}) {
  return (
    <Element
      className={cx('ds-card', `ds-card--${variant}`, variant === 'interactive' && 'ds-focus-ring', className)}
      {...props}
    >
      {children}
    </Element>
  )
}

function useEscape(onClose, enabled) {
  useEffect(() => {
    if (!enabled || !onClose) return undefined
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onClose])
}

export function Sheet({ open = false, title, labelledBy, onClose, children, className = '' }) {
  useEscape(onClose, open)
  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="ds-sheet-backdrop"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cx('ds-sheet', className)}
      >
        <div className="ds-sheet__handle" aria-hidden="true" />
        {title && <h2 id={labelledBy}>{title}</h2>}
        {children}
      </section>
    </>
  )
}

export function Modal({ open = false, title, labelledBy, onClose, children, className = '' }) {
  useEscape(onClose, open)
  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="ds-modal-backdrop"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cx('ds-modal', className)}
      >
        {title && <h2 id={labelledBy}>{title}</h2>}
        {children}
      </section>
    </>
  )
}

export function StateMessage({ kind = 'empty', title, description, action, className = '' }) {
  return (
    <div className={cx('ds-state', `ds-state--${kind}`, className)} role={kind === 'error' ? 'alert' : undefined}>
      <strong className="ds-state__title">{title}</strong>
      {description && <p className="ds-state__description">{description}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ width, height = '1rem', className = '', ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cx('ds-skeleton', className)}
      style={{ width, height, ...props.style }}
    />
  )
}

export function OfflineState({ children }) {
  return <div className="ds-offline" role="status">{children}</div>
}

export function LastUpdated({ children }) {
  return <time className="ds-last-updated">{children}</time>
}