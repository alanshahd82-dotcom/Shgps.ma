import React from 'react'

export interface SkeletonProps {
  width?: string
  height?: string
  variant?: 'text' | 'circular' | 'rectangular'
  className?: string
  animate?: boolean
}

export function Skeleton({ width, height, variant = 'rectangular', className = '', animate = true }: SkeletonProps) {
  const shape = variant === 'text' ? 'h-4 rounded-[6px]' : variant === 'circular' ? 'rounded-full' : 'rounded-[10px]'
  return <div aria-hidden="true" className={`bg-border ${shape} ${animate ? 'animate-pulse' : ''} ${className}`} style={{ width, height: height || (variant === 'text' ? '16px' : undefined) }} />
}