import React from 'react'

export interface CardProps {
  variant?: 'clean' | 'subtle'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

const paddingClasses = { none: 'p-0', sm: 'p-3', md: 'p-4', lg: 'p-6' }

export function Card({ variant = 'clean', padding = 'md', children, className = '', onClick, ...props }: CardProps) {
  return (
    <div
      {...props}
      onClick={onClick}
      className={`rounded-[10px] ${variant === 'clean' ? 'border border-border bg-white shadow-sm' : 'bg-slate-50'} ${paddingClasses[padding]} ${onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''} ${className}`}
    >
      {children}
    </div>
  )
}