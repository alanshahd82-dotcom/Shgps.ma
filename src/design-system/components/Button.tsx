import React from 'react'
import { Loader2 } from 'lucide-react'

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  loading?: boolean
  icon?: React.ReactNode
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
}

const variants = {
  primary: 'bg-accent text-white hover:bg-accent-500',
  secondary: 'border border-border bg-white text-primary hover:bg-slate-50',
  ghost: 'bg-transparent text-primary hover:bg-slate-50',
  destructive: 'bg-red-500 text-white hover:bg-red-600',
}
const sizes = { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-sm', lg: 'h-12 px-5 text-[15px]' }

export function Button({ variant = 'primary', size = 'md', loading = false, icon, children, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}