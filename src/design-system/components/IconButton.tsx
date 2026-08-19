import React from 'react'

export interface IconButtonProps {
  icon: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'ghost' | 'danger'
  label: string
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
}

const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' }
const variants = {
  default: 'bg-slate-50 hover:bg-border',
  ghost: 'bg-transparent hover:bg-slate-50',
  danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
}

export function IconButton({ icon, size = 'md', variant = 'default', label, className = '', ...props }: IconButtonProps) {
  return (
    <button {...props} type={props.type || 'button'} aria-label={label} title={label} className={`inline-flex items-center justify-center rounded-[10px] transition-colors focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}>
      {icon}
    </button>
  )
}