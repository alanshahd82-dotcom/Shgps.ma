export function downsample(values, maxN) {
  if (!Array.isArray(values) || values.length <= maxN || maxN < 2) return values || []
  const result = []
  const stride = (values.length - 1) / (maxN - 1)
  for (let index = 0; index < maxN; index += 1) {
    result.push(values[Math.min(values.length - 1, Math.round(index * stride))])
  }
  return result
}

function squaredDistance(point, segmentStart, segmentEnd) {
  const x = point[0]
  const y = point[1]
  let dx = segmentEnd[0] - segmentStart[0]
  let dy = segmentEnd[1] - segmentStart[1]

  if (dx !== 0 || dy !== 0) {
    const t = ((x - segmentStart[0]) * dx + (y - segmentStart[1]) * dy) / (dx * dx + dy * dy)
    if (t > 1) {
      dx = x - segmentEnd[0]
      dy = y - segmentEnd[1]
    } else if (t > 0) {
      const projected = [segmentStart[0] + dx * t, segmentStart[1] + dy * t]
      dx = x - projected[0]
      dy = y - projected[1]
    } else {
      dx = x - segmentStart[0]
      dy = y - segmentStart[1]
    }
  } else {
    dx = x - segmentStart[0]
    dy = y - segmentStart[1]
  }

  return dx * dx + dy * dy
}

function simplifySection(points, first, last, squaredTolerance, kept) {
  let maximum = squaredTolerance
  let splitIndex = -1

  for (let index = first + 1; index < last; index += 1) {
    const distance = squaredDistance(points[index], points[first], points[last])
    if (distance > maximum) {
      splitIndex = index
      maximum = distance
    }
  }

  if (splitIndex !== -1) {
    if (splitIndex - first > 1) simplifySection(points, first, splitIndex, squaredTolerance, kept)
    kept.push(points[splitIndex])
    if (last - splitIndex > 1) simplifySection(points, splitIndex, last, squaredTolerance, kept)
  }
}

export function simplifyPath(points, tolerance = 0.00005) {
  if (!Array.isArray(points) || points.length <= 2) return points || []
  const squaredTolerance = Math.max(0, tolerance) ** 2
  const kept = [points[0]]
  simplifySection(points, 0, points.length - 1, squaredTolerance, kept)
  kept.push(points[points.length - 1])
  return kept
}

export function bucketMax(values, maxN = 300) {
  if (!Array.isArray(values) || values.length <= maxN || maxN < 2) return values || []
  const bucketSize = values.length / maxN
  const result = []

  for (let bucket = 0; bucket < maxN; bucket += 1) {
    const start = Math.floor(bucket * bucketSize)
    const end = Math.min(values.length, Math.floor((bucket + 1) * bucketSize))
    let maximum = values[start]
    for (let index = start + 1; index < end; index += 1) {
      if (Number(values[index]?.speed) > Number(maximum?.speed)) maximum = values[index]
    }
    if (maximum) result.push(maximum)
  }

  return result
}