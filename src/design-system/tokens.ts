// Design Tokens for ATHAR GPS

export const colors = {
  primary: '#0F172A',
  accent: '#2563EB',
  accentSoft: '#DBEAFE',
  online: '#10B981',
  idle: '#6B7280',
  alert: '#F59E0B',
  danger: '#EF4444',
  offline: '#94A3B8',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  border: '#E2E8F0',
  textMuted: '#64748B',
  textPrimary: '#0F172A',
} as const

export const spacing = {
  xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '20px',
  '2xl': '24px', '3xl': '32px', '4xl': '40px', '5xl': '48px',
  '6xl': '64px', '7xl': '80px',
} as const

export const typography = {
  fontSans: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  fontMono: 'JetBrains Mono, ui-monospace, monospace',
  display: { size: '32px', lineHeight: '40px', weight: 600 },
  title: { size: '20px', lineHeight: '28px', weight: 600 },
  heading: { size: '16px', lineHeight: '24px', weight: 600 },
  body: { size: '14px', lineHeight: '20px', weight: 400 },
  caption: { size: '12px', lineHeight: '16px', weight: 400 },
  overline: { size: '10px', lineHeight: '14px', weight: 500, uppercase: true },
} as const

export const radius = { sm: '6px', md: '10px', lg: '16px', xl: '24px', full: '9999px' } as const
export const shadows = {
  sm: '0 1px 2px rgba(15,23,42,0.05)',
  md: '0 4px 12px rgba(15,23,42,0.08)',
  lg: '0 12px 32px rgba(15,23,42,0.12)',
} as const

export const statusClasses = {
  online: { text: 'text-emerald-600', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
  idle: { text: 'text-gray-500', bg: 'bg-gray-500/10', dot: 'bg-gray-500' },
  alert: { text: 'text-amber-600', bg: 'bg-amber-500/10', dot: 'bg-amber-500' },
  danger: { text: 'text-red-600', bg: 'bg-red-500/10', dot: 'bg-red-500' },
  offline: { text: 'text-slate-500', bg: 'bg-slate-400/10', dot: 'bg-slate-400' },
  default: { text: 'text-slate-600', bg: 'bg-slate-50', dot: 'bg-slate-400' },
} as const