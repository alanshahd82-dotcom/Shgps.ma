import React, { useMemo } from 'react'

export default function NativeAreaChart({ data = [], xKey, series = [], height = 180 }) {
  const chart = useMemo(() => {
    const width = 640
    const padding = { top: 12, right: 14, bottom: 24, left: 14 }
    const innerWidth = width - padding.left - padding.right
    const innerHeight = height - padding.top - padding.bottom
    const values = series.flatMap(item => data.map(row => Number(row[item.dataKey])).filter(Number.isFinite))
    const max = Math.max(1, ...values)
    const points = data.map((row, index) => ({
      x: padding.left + (data.length <= 1 ? innerWidth / 2 : (index * innerWidth) / (data.length - 1)),
      label: row[xKey],
      values: Object.fromEntries(series.map(item => [
        item.dataKey,
        padding.top + innerHeight - ((Number(row[item.dataKey]) || 0) / max) * innerHeight,
      ])),
    }))
    return { width, padding, points, max }
  }, [data, height, series, xKey])

  return (
    <svg viewBox={`0 0 ${chart.width} ${height}`} width="100%" height={height} role="img" aria-label="Data chart">
      <line
        x1={chart.padding.left}
        x2={chart.width - chart.padding.right}
        y1={height - chart.padding.bottom}
        y2={height - chart.padding.bottom}
        stroke="#e2e8f0"
      />
      {series.map(item => {
        const line = chart.points.map(point => `${point.x},${point.values[item.dataKey]}`).join(' ')
        return (
          <polyline
            key={item.dataKey}
            points={line}
            fill="none"
            stroke={item.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}
      {chart.points.map((point, index) => (
        <text
          key={`${point.label}-${index}`}
          x={point.x}
          y={height - 7}
          textAnchor="middle"
          fontSize="10"
          fill="#94a3b8"
        >
          {point.label}
        </text>
      ))}
    </svg>
  )
}