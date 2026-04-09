import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { type PointerEvent, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Crosshair, Map, Maximize2, Minus, X } from 'lucide-react'
import {
  centerViewportOnWorldPoint,
  getViewportBounds,
} from '../lib/graph-geometry.ts'
import type { GraphLayout, ViewportState } from '../../../shared/types/knowledge.ts'

interface MiniMapProps {
  layout: GraphLayout
  onFocusWorld: () => void
  size: {
    width: number
    height: number
  }
  viewport: ViewportState
  onViewportRequest: (viewport: ViewportState) => void
}

const PANEL_MAP_WIDTH = 294
const PANEL_MAP_HEIGHT = 188

const EXPANDED_MAP_WIDTH = 760
const EXPANDED_MAP_HEIGHT = 460

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function MiniMap({
  layout,
  onFocusWorld,
  onViewportRequest,
  size,
  viewport,
}: MiniMapProps) {
  const dragControls = useDragControls()
  const activePointerIdRef = useRef<number | null>(null)
  const [isCollapsed, setCollapsed] = useState(false)
  const [isExpanded, setExpanded] = useState(false)

  const world = layout.worldBounds
  const viewportBounds = getViewportBounds(viewport, size)

  const createMiniMapMetrics = (mapWidth: number, mapHeight: number) => {
    const scale = Math.min(mapWidth / world.width, mapHeight / world.height)
    const offsetX = (mapWidth - world.width * scale) / 2
    const offsetY = (mapHeight - world.height * scale) / 2

    const rawViewportX = offsetX + (viewportBounds.minX - world.minX) * scale
    const rawViewportY = offsetY + (viewportBounds.minY - world.minY) * scale
    const rawViewportWidth = viewportBounds.width * scale
    const rawViewportHeight = viewportBounds.height * scale

    const viewportX = clamp(rawViewportX, 0, mapWidth)
    const viewportY = clamp(rawViewportY, 0, mapHeight)
    const viewportMaxX = clamp(rawViewportX + rawViewportWidth, 0, mapWidth)
    const viewportMaxY = clamp(rawViewportY + rawViewportHeight, 0, mapHeight)

    return {
      scale,
      offsetX,
      offsetY,
      viewportRect: {
        x: viewportX,
        y: viewportY,
        width: Math.max(0, viewportMaxX - viewportX),
        height: Math.max(0, viewportMaxY - viewportY),
      },
    }
  }

  const compactMetrics = useMemo(
    () => createMiniMapMetrics(PANEL_MAP_WIDTH, PANEL_MAP_HEIGHT),
    [layout, viewport, size],
  )
  const expandedMetrics = useMemo(
    () => createMiniMapMetrics(EXPANDED_MAP_WIDTH, EXPANDED_MAP_HEIGHT),
    [layout, viewport, size],
  )

  const handlePanelPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target
    if (target instanceof Element && target.closest('[data-minimap-interactive="true"]')) {
      return
    }

    dragControls.start(event)
  }

  const requestViewportFromPointer = (
    clientX: number,
    clientY: number,
    target: SVGSVGElement,
    mapWidth: number,
    mapHeight: number,
    scale: number,
    offsetX: number,
    offsetY: number,
  ) => {
    const rect = target.getBoundingClientRect()
    const localX = ((clientX - rect.left) / Math.max(rect.width, 1)) * mapWidth
    const localY = ((clientY - rect.top) / Math.max(rect.height, 1)) * mapHeight
    const normalizedX = (localX - offsetX) / Math.max(scale, 0.001)
    const normalizedY = (localY - offsetY) / Math.max(scale, 0.001)
    const worldX = clamp(world.minX + normalizedX, world.minX, world.maxX)
    const worldY = clamp(world.minY + normalizedY, world.minY, world.maxY)

    onViewportRequest(
      centerViewportOnWorldPoint(worldX, worldY, size, Math.max(viewport.scale, 0.24)),
    )
  }

  const handleMapPointerDown = (
    event: PointerEvent<SVGSVGElement>,
    mapWidth: number,
    mapHeight: number,
    scale: number,
    offsetX: number,
    offsetY: number,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    activePointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)

    requestViewportFromPointer(
      event.clientX,
      event.clientY,
      event.currentTarget,
      mapWidth,
      mapHeight,
      scale,
      offsetX,
      offsetY,
    )
  }

  const handleMapPointerMove = (
    event: PointerEvent<SVGSVGElement>,
    mapWidth: number,
    mapHeight: number,
    scale: number,
    offsetX: number,
    offsetY: number,
  ) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    requestViewportFromPointer(
      event.clientX,
      event.clientY,
      event.currentTarget,
      mapWidth,
      mapHeight,
      scale,
      offsetX,
      offsetY,
    )
  }

  const releasePointer = (event: PointerEvent<SVGSVGElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    activePointerIdRef.current = null
  }

  const renderMapSurface = (
    mapWidth: number,
    mapHeight: number,
    metrics: ReturnType<typeof createMiniMapMetrics>,
    isExpandedSurface: boolean,
  ) => (
    <svg
      viewBox={`0 0 ${mapWidth} ${mapHeight}`}
      style={{ aspectRatio: `${mapWidth} / ${mapHeight}` }}
      onPointerDown={(event) =>
        handleMapPointerDown(
          event,
          mapWidth,
          mapHeight,
          metrics.scale,
          metrics.offsetX,
          metrics.offsetY,
        )
      }
      onPointerMove={(event) =>
        handleMapPointerMove(
          event,
          mapWidth,
          mapHeight,
          metrics.scale,
          metrics.offsetX,
          metrics.offsetY,
        )
      }
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onPointerLeave={releasePointer}
      onWheel={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      className={`block w-full touch-none select-none cursor-crosshair overflow-hidden rounded-[1.3rem] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.14),transparent_28%),rgba(8,5,20,0.78)] ${
        isExpandedSurface ? 'shadow-[0_18px_50px_rgba(0,0,0,0.26)]' : ''
      }`}
    >
      <rect width={mapWidth} height={mapHeight} fill="transparent" />

      {layout.constellations.map((constellation) => {
        const x = metrics.offsetX + (constellation.bounds.minX - world.minX) * metrics.scale
        const y = metrics.offsetY + (constellation.bounds.minY - world.minY) * metrics.scale
        const constellationWidth = constellation.bounds.width * metrics.scale
        const constellationHeight = constellation.bounds.height * metrics.scale

        return (
          <rect
            key={constellation.id}
            x={x}
            y={y}
            width={constellationWidth}
            height={constellationHeight}
            rx={16}
            fill="rgba(167, 139, 250, 0.08)"
            stroke="rgba(216, 180, 254, 0.16)"
            strokeWidth={1}
          />
        )
      })}

      {layout.nodes.map((node) => (
        <circle
          key={node.id}
          cx={metrics.offsetX + (node.x - world.minX) * metrics.scale}
          cy={metrics.offsetY + (node.y - world.minY) * metrics.scale}
          r={Math.max(isExpandedSurface ? 2.4 : 1.5, node.radius * metrics.scale * 0.42)}
          fill={node.accent}
          opacity={node.isRoot ? 0.96 : 0.82}
        />
      ))}

      <rect
        x={metrics.viewportRect.x}
        y={metrics.viewportRect.y}
        width={Math.max(metrics.viewportRect.width, 10)}
        height={Math.max(metrics.viewportRect.height, 10)}
        rx={14}
        fill="rgba(196, 181, 253, 0.08)"
        stroke="rgba(221, 214, 254, 0.62)"
        strokeWidth={isExpandedSurface ? 1.8 : 1.5}
      />
    </svg>
  )

  const expandedOverlay =
    isExpanded && typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            <motion.div
              key="expanded-minimap-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] hidden items-center justify-center bg-[rgba(8,5,20,0.34)] px-4 py-8 backdrop-blur-sm lg:flex"
              onClick={() => setExpanded(false)}
              onPointerDown={(event) => event.stopPropagation()}
              onWheel={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="glass-panel w-[min(792px,calc(100vw-2rem))] rounded-[2rem] border border-white/8 bg-[rgba(21,14,39,0.62)] p-4 shadow-[0_30px_140px_rgba(0,0,0,0.32)]"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onWheel={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.36em] text-violet-200/65">
                      Expanded Map
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      Drag or click anywhere to move the main view precisely.
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onFocusWorld}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-200/14 bg-slate-950/50 text-violet-50 transition hover:border-violet-200/24 hover:bg-white/7"
                      title="Focus all"
                    >
                      <Crosshair className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/4 text-slate-200 transition hover:border-violet-200/16 hover:bg-white/8"
                      title="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {renderMapSurface(
                  EXPANDED_MAP_WIDTH,
                  EXPANDED_MAP_HEIGHT,
                  expandedMetrics,
                  true,
                )}

                <p className="mt-4 text-sm leading-6 text-slate-300">
                  Click or drag on the enlarged map, and click the dimmed area to exit.
                </p>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null

  return (
    <>
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={isCollapsed}
        dragMomentum={false}
        className="pointer-events-auto absolute bottom-4 left-4 z-20 hidden lg:block"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {isCollapsed ? (
            <motion.button
              key="collapsed"
              type="button"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={() => setCollapsed(false)}
              className="glass-panel inline-flex cursor-grab items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-100 transition hover:border-violet-200/16 hover:bg-white/8 active:cursor-grabbing"
              title="Expand minimap"
            >
              <Map className="h-4 w-4 text-violet-200" />
              <span>Expand Minimap</span>
            </motion.button>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              onPointerDown={handlePanelPointerDown}
              className="glass-panel w-[326px] cursor-grab overflow-hidden rounded-[1.8rem] px-4 py-4 active:cursor-grabbing"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 text-left">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.36em] text-violet-200/65">
                      Minimap
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    data-minimap-interactive="true"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-200/14 bg-slate-950/50 text-violet-50 transition hover:border-violet-200/24 hover:bg-white/7"
                    title="Open large map"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onFocusWorld}
                    data-minimap-interactive="true"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-200/14 bg-slate-950/50 text-violet-50 transition hover:border-violet-200/24 hover:bg-white/7"
                    title="Focus all"
                  >
                    <Crosshair className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollapsed(true)}
                    data-minimap-interactive="true"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/4 text-slate-200 transition hover:border-violet-200/16 hover:bg-white/8"
                    title="Collapse minimap"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {renderMapSurface(
                PANEL_MAP_WIDTH,
                PANEL_MAP_HEIGHT,
                compactMetrics,
                false,
              )}

              <p className="mt-3 text-xs leading-6 text-slate-400">
                当导入的 Markdown 星团较多、普通小地图不方便精确定位时，可以使用放大地图。
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {expandedOverlay}
    </>
  )
}
