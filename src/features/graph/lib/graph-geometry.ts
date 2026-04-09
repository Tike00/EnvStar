import type { Bounds, ViewportState } from '../../../shared/types/knowledge.ts'

function normalizeBounds(bounds: Bounds): Bounds {
  return {
    ...bounds,
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
  }
}

export function createBoundsFromNodes(
  points: Array<{ x: number; y: number; radius?: number }>,
  padding = 0,
): Bounds {
  if (points.length === 0) {
    return {
      minX: -1,
      minY: -1,
      maxX: 1,
      maxY: 1,
      width: 2,
      height: 2,
    }
  }

  const rawBounds = points.reduce(
    (bounds, point) => {
      const radius = point.radius ?? 0
      return {
        minX: Math.min(bounds.minX, point.x - radius),
        minY: Math.min(bounds.minY, point.y - radius),
        maxX: Math.max(bounds.maxX, point.x + radius),
        maxY: Math.max(bounds.maxY, point.y + radius),
        width: 0,
        height: 0,
      }
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      width: 0,
      height: 0,
    },
  )

  return normalizeBounds({
    minX: rawBounds.minX - padding,
    minY: rawBounds.minY - padding,
    maxX: rawBounds.maxX + padding,
    maxY: rawBounds.maxY + padding,
    width: 0,
    height: 0,
  })
}

export function fitBoundsToViewport(
  bounds: Bounds,
  width: number,
  height: number,
  padding = 140,
): ViewportState {
  const safeWidth = Math.max(1, width - padding * 2)
  const safeHeight = Math.max(1, height - padding * 2)
  const scale = Math.min(
    2.4,
    Math.max(0.24, Math.min(safeWidth / bounds.width, safeHeight / bounds.height)),
  )
  const centerX = bounds.minX + bounds.width / 2
  const centerY = bounds.minY + bounds.height / 2

  return {
    x: width / 2 - centerX * scale,
    y: height / 2 - centerY * scale,
    scale,
  }
}

export function boundsAroundPoint(x: number, y: number, radius = 260): Bounds {
  return {
    minX: x - radius,
    maxX: x + radius,
    minY: y - radius,
    maxY: y + radius,
    width: radius * 2,
    height: radius * 2,
  }
}

export function getViewportBounds(
  viewport: ViewportState,
  size: { width: number; height: number },
): Bounds {
  const safeScale = Math.max(viewport.scale, 0.001)

  return {
    minX: (0 - viewport.x) / safeScale,
    minY: (0 - viewport.y) / safeScale,
    maxX: (size.width - viewport.x) / safeScale,
    maxY: (size.height - viewport.y) / safeScale,
    width: size.width / safeScale,
    height: size.height / safeScale,
  }
}

export function centerViewportOnWorldPoint(
  x: number,
  y: number,
  size: { width: number; height: number },
  scale: number,
): ViewportState {
  const safeScale = Math.max(scale, 0.001)

  return {
    x: size.width / 2 - x * safeScale,
    y: size.height / 2 - y * safeScale,
    scale: safeScale,
  }
}
