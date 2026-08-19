import React from 'react'
import { statusClasses } from '../tokens'

export interface BadgeProps {
  variant?: keyof typeof statusClasses
  size?: 'sm' | 'md'
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', size = 'md', children, icon, className = '' }: BadgeProps) {
  const colors = statusClasses[variant]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${colors.bg} ${colors.text} ${size === 'sm' ? 'px-2 py-0.5 text-[11px] leading-[14px]' : 'px-2.5 py-1 text-xs leading-4'} ${className}`}>
      {icon}
      {children}
    </span>
  )
}