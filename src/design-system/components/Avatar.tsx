import React from 'react'
import { statusClasses } from '../tokens'

export interface AvatarProps {
  src?: string
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  status?: keyof Omit<typeof statusClasses, 'default'>
  className?: string
}

const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' }
function initials(name = '') { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?' }

export function Avatar({ src, name, size = 'md', status, className = '' }: AvatarProps) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <span className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-accent font-semibold text-white ${sizes[size]}`}>
        {src ? <img src={src} alt={name || 'Avatar'} className="h-full w-full object-cover" /> : initials(name)}
      </span>
      {status && <span className={`absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border-2 border-white ${statusClasses[status].dot}`} aria-label={status} />}
    </span>
  )
}