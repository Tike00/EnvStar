import { AnimatePresence, motion } from 'motion/react'
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import { fitBoundsToViewport } from '../lib/graph-geometry.ts'
import type {
  Bounds,
  GraphLayout,
  OrbitBand,
  ViewportState,
} from '../../../shared/types/knowledge.ts'

interface StarMapProps {
  focusBounds: Bounds | null
  focusNonce: number
  initialFitKey: string
  layout: GraphLayout
  onClearSelection: () => void
  onNodeSelect: (nodeId: string) => void
  onSizeChange: (size: { width: number; height: number }) => void
  onViewportChange: (viewport: ViewportState) => void
  searchNodeIds: Set<string>
  selectedNodeId: string | null
  viewportRequest: ViewportState | null
  viewportRequestNonce: number
}

function isOrbitHighlighted(
  orbit: OrbitBand,
  activeNodeId: string | null,
  highlightedNodes: Set<string> | null,
) {
  if (!activeNodeId) {
    return false
  }

  if (orbit.centerId === activeNodeId || orbit.nodeIds.includes(activeNodeId)) {
    return true
  }

  if (highlightedNodes?.has(orbit.centerId)) {
    return true
  }

  return orbit.nodeIds.some((nodeId) => highlightedNodes?.has(nodeId))
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2
}

function getNodeCardSize(
  depth: number,
  isRoot: boolean,
  isSelected: boolean,
  isSearchMatch: boolean,
) {
  const baseSize = isRoot ? 120 : depth === 1 ? 22 : depth === 2 ? 16 : 12

  if (isRoot) {
    return isSelected ? baseSize + 8 : baseSize
  }

  if (isSelected) {
    return baseSize + 6
  }

  if (isSearchMatch) {
    return baseSize + 2
  }

  return baseSize
}

function getDisplayTitle(title: string, fileName: string, isRoot: boolean) {
  if (!isRoot) {
    return title
  }

  return fileName.replace(/\.(md|markdown)$/i, '') || title
}

export function StarMap({
  focusBounds,
  focusNonce,
  initialFitKey,
  layout,
  onClearSelection,
  onNodeSelect,
  onSizeChange,
  onViewportChange,
  searchNodeIds,
  selectedNodeId,
  viewportRequest,
  viewportRequestNonce,
}: StarMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const zoomRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null)
  const hasInitialFitRef = useRef(false)
  const animationFrameRef = useRef<number | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [currentViewport, setCurrentViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    scale: 1,
  })
  const previousNodeMapRef = useRef(new Map<string, { x: number; y: number }>())
  const currentViewportRef = useRef<ViewportState>({
    x: 0,
    y: 0,
    scale: 1,
  })

  const stopViewportAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const applyViewport = useCallback(
    (nextViewport: ViewportState, animate: boolean) => {
      const svg = svgRef.current
      const zoomBehavior = zoomRef.current
      if (!svg || !zoomBehavior) {
        return
      }

      const selection = select(svg)
      const applyTransform = (viewport: ViewportState) => {
        selection.call(
          zoomBehavior.transform,
          zoomIdentity.translate(viewport.x, viewport.y).scale(viewport.scale),
        )
      }

      if (!animate) {
        stopViewportAnimation()
        applyTransform(nextViewport)
        return
      }

      const startViewport = currentViewportRef.current
      const delta =
        Math.abs(startViewport.x - nextViewport.x) +
        Math.abs(startViewport.y - nextViewport.y) +
        Math.abs(startViewport.scale - nextViewport.scale)

      if (delta < 1) {
        applyTransform(nextViewport)
        return
      }

      stopViewportAnimation()

      const startedAt = performance.now()
      const duration = 760

      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration)
        const eased = easeInOutCubic(progress)
        const interpolatedViewport = {
          x: startViewport.x + (nextViewport.x - startViewport.x) * eased,
          y: startViewport.y + (nextViewport.y - startViewport.y) * eased,
          scale:
            startViewport.scale + (nextViewport.scale - startViewport.scale) * eased,
        }

        applyTransform(interpolatedViewport)

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(step)
        } else {
          animationFrameRef.current = null
        }
      }

      animationFrameRef.current = requestAnimationFrame(step)
    },
    [stopViewportAnimation],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const nextSize = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }

      setDimensions(nextSize)
      onSizeChange(nextSize)
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [onSizeChange])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const handleUserInterrupt = () => {
      stopViewportAnimation()
    }

    svg.addEventListener('pointerdown', handleUserInterrupt, { passive: true })
    svg.addEventListener('wheel', handleUserInterrupt, { passive: true })

    return () => {
      svg.removeEventListener('pointerdown', handleUserInterrupt)
      svg.removeEventListener('wheel', handleUserInterrupt)
    }
  }, [stopViewportAnimation])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const selection = select(svg)
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.24, 3.2])
      .filter((event) => event.button !== 1)
      .on('zoom', (event) => {
        const transform = event.transform
        const nextViewport = {
          x: transform.x,
          y: transform.y,
          scale: transform.k,
        }

        currentViewportRef.current = nextViewport
        setCurrentViewport(nextViewport)
        onViewportChange(nextViewport)
      })

    zoomRef.current = behavior
    selection.call(behavior)

    return () => {
      selection.on('.zoom', null)
    }
  }, [onViewportChange])

  useEffect(() => {
    if (!zoomRef.current || !svgRef.current || dimensions.width === 0 || dimensions.height === 0) {
      return
    }

    if (hasInitialFitRef.current && layout.nodes.length > 0) {
      return
    }

    hasInitialFitRef.current = true
    const initialViewport = fitBoundsToViewport(
      layout.worldBounds,
      dimensions.width,
      dimensions.height,
      180,
    )

    applyViewport(initialViewport, false)
  }, [
    applyViewport,
    dimensions.height,
    dimensions.width,
    layout.nodes.length,
    layout.worldBounds,
  ])

  useEffect(() => {
    hasInitialFitRef.current = false
  }, [initialFitKey])

  useLayoutEffect(() => {
    const nextNodeMap = new Map(layout.nodes.map((node) => [node.id, { x: node.x, y: node.y }] as const))
    const previousNodeMap = previousNodeMapRef.current

    if (selectedNodeId) {
      const previousNode = previousNodeMap.get(selectedNodeId)
      const nextNode = nextNodeMap.get(selectedNodeId)

      if (previousNode && nextNode) {
        const positionDelta =
          Math.abs(previousNode.x - nextNode.x) + Math.abs(previousNode.y - nextNode.y)

        if (positionDelta > 0.5) {
          const current = currentViewportRef.current
          const pinnedScreenX = previousNode.x * current.scale + current.x
          const pinnedScreenY = previousNode.y * current.scale + current.y

          applyViewport(
            {
              x: pinnedScreenX - nextNode.x * current.scale,
              y: pinnedScreenY - nextNode.y * current.scale,
              scale: current.scale,
            },
            false,
          )
        }
      }
    }

    previousNodeMapRef.current = nextNodeMap
  }, [applyViewport, layout.nodes, selectedNodeId])

  useEffect(() => {
    if (!focusBounds || dimensions.width === 0 || dimensions.height === 0) {
      return
    }

    const targetViewport = fitBoundsToViewport(
      focusBounds,
      dimensions.width,
      dimensions.height,
      150,
    )

    applyViewport(targetViewport, true)
  }, [applyViewport, dimensions.height, dimensions.width, focusBounds, focusNonce])

  useEffect(() => {
    if (!viewportRequest) {
      return
    }

    applyViewport(viewportRequest, true)
  }, [applyViewport, viewportRequest, viewportRequestNonce])

  useEffect(() => () => stopViewportAnimation(), [stopViewportAnimation])

  const activeNodeId = selectedNodeId ?? hoveredNodeId
  const hasSearchResults = searchNodeIds.size > 0
  const nodeMap = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node] as const)),
    [layout.nodes],
  )
  const adjacencyMap = useMemo(() => {
    const adjacency = new Map<string, Set<string>>()

    for (const node of layout.nodes) {
      adjacency.set(node.id, new Set([node.id]))
    }

    for (const edge of layout.edges) {
      adjacency.get(edge.source)?.add(edge.target)
      adjacency.get(edge.target)?.add(edge.source)
    }

    return adjacency
  }, [layout.edges, layout.nodes])

  const highlightedNodes = activeNodeId
    ? adjacencyMap.get(activeNodeId) ?? new Set([activeNodeId])
    : null
  const selectedChildNodeIds = useMemo(
    () => new Set(selectedNodeId ? (nodeMap.get(selectedNodeId)?.childIds ?? []) : []),
    [nodeMap, selectedNodeId],
  )

  const handleCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    if (event.target === event.currentTarget) {
      onClearSelection()
    }
  }

  return (
    <div ref={containerRef} className="relative min-h-screen w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(192,132,252,0.16),transparent_14%),radial-gradient(circle_at_78%_18%,rgba(129,140,248,0.14),transparent_16%),radial-gradient(circle_at_48%_74%,rgba(232,121,249,0.1),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-90 [background-image:radial-gradient(circle_at_12%_14%,rgba(255,255,255,0.24)_0_1.1px,transparent_1.3px),radial-gradient(circle_at_78%_24%,rgba(221,214,254,0.18)_0_1.1px,transparent_1.3px),radial-gradient(circle_at_24%_68%,rgba(255,255,255,0.16)_0_1px,transparent_1.2px),radial-gradient(circle_at_68%_58%,rgba(196,181,253,0.14)_0_1px,transparent_1.2px)] [background-position:0_0,160px_120px,90px_210px,240px_300px] [background-size:320px_320px,520px_520px,660px_660px,720px_720px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_40%,rgba(168,85,247,0.12),transparent_24%),radial-gradient(circle_at_72%_60%,rgba(129,140,248,0.08),transparent_24%)] mix-blend-screen" />
      <div className="pointer-events-none absolute -left-24 top-[4%] h-[32rem] w-[32rem] rounded-full bg-fuchsia-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-10rem] top-[12%] h-[30rem] w-[30rem] rounded-full bg-violet-500/10 blur-[145px]" />
      <div className="pointer-events-none absolute bottom-[-12rem] left-[18%] h-[30rem] w-[30rem] rounded-full bg-indigo-500/10 blur-[160px]" />

      <svg
        ref={svgRef}
        className="relative z-10 h-screen w-full"
        onClick={handleCanvasClick}
      >
        <defs>
          <radialGradient id="envstar-star-core" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
            <stop offset="34%" stopColor="rgba(245,208,254,0.94)" />
            <stop offset="72%" stopColor="rgba(196,181,253,0.78)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0.44)" />
          </radialGradient>
          <radialGradient id="envstar-planet-core" cx="50%" cy="46%" r="72%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.94)" />
            <stop offset="46%" stopColor="rgba(233,213,255,0.82)" />
            <stop offset="100%" stopColor="rgba(167,139,250,0.4)" />
          </radialGradient>
          <filter id="envstar-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="envstar-line-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          transform={`translate(${currentViewport.x} ${currentViewport.y}) scale(${currentViewport.scale})`}
        >
          {layout.orbits.map((orbit) => {
            const orbitSearchHit =
              searchNodeIds.has(orbit.centerId) ||
              orbit.nodeIds.some((nodeId) => searchNodeIds.has(nodeId))
            const orbitHighlighted =
              isOrbitHighlighted(orbit, activeNodeId, highlightedNodes) ||
              (!activeNodeId && hasSearchResults && orbitSearchHit)
            const dimmed = selectedNodeId
              ? !orbitHighlighted
              : hasSearchResults
                ? !orbitSearchHit
                : false

            return (
              <g key={orbit.id}>
                <circle
                  cx={orbit.centerX}
                  cy={orbit.centerY}
                  r={orbit.radius}
                  fill="none"
                  filter="url(#envstar-line-glow)"
                  stroke={orbitHighlighted ? 'rgba(221,214,254,0.54)' : 'rgba(196,181,253,0.16)'}
                  strokeWidth={orbitHighlighted ? 1.04 : 0.72}
                  opacity={dimmed ? 0.05 : orbitHighlighted ? 0.62 : 0.34}
                />
              </g>
            )
          })}

        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${currentViewport.x}px, ${currentViewport.y}px) scale(${currentViewport.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {layout.nodes.map((node) => {
            const isSelected = node.id === selectedNodeId
            const isRelated = highlightedNodes?.has(node.id) ?? false
            const isSearchMatch = searchNodeIds.has(node.id)
            const isDimmed = selectedNodeId
              ? !isRelated
              : hasSearchResults
                ? !isSearchMatch
                : false
            const size = getNodeCardSize(node.depth, node.isRoot, isSelected, isSearchMatch)
            const displayTitle = getDisplayTitle(node.title, node.fileName, node.isRoot)
            const orbitCenter = node.orbitCenterId ? nodeMap.get(node.orbitCenterId) : null
            const isLeftOrbit = orbitCenter ? node.x < orbitCenter.x : false
            const isSelectedChild = selectedChildNodeIds.has(node.id)
            const showLabel =
              node.isRoot ||
              node.depth === 1 ||
              isSelected ||
              isSelectedChild ||
              isSearchMatch ||
              currentViewport.scale > 1.02

            return (
              <motion.div
                key={node.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: isDimmed ? 0.28 : 1 }}
                transition={{ duration: 0.34, ease: 'easeOut' }}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: node.x,
                  top: node.y,
                  width: size,
                  height: size,
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  onNodeSelect(node.id)
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() =>
                  setHoveredNodeId((current) => (current === node.id ? null : current))
                }
                title={node.pathTitles.join(' / ')}
              >
                {node.isRoot ? (
                  <div className="relative flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-fuchsia-400/18 via-violet-500/14 to-indigo-500/12 px-4 text-center backdrop-blur-2xl shadow-[0_0_120px_rgba(168,85,247,0.26)]">
                    <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(216,180,254,0.24),transparent_58%),radial-gradient(circle_at_70%_70%,rgba(129,140,248,0.16),transparent_70%)]" />
                    <div className="absolute inset-2 rounded-full bg-[radial-gradient(circle,rgba(196,181,253,0.22),transparent_64%)] blur-xl" />
                    {isSelected ? (
                      <div className="absolute -inset-2 rounded-full border border-violet-200/18 shadow-[0_0_84px_rgba(168,85,247,0.22)]" />
                    ) : null}
                    <div className="relative z-10 max-w-full truncate text-xl font-semibold tracking-wide text-white">
                      {displayTitle}
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={`relative rounded-full border ${
                        node.depth === 1
                          ? 'border-white/14 bg-gradient-to-br from-fuchsia-200/46 to-violet-500/26 shadow-[0_0_26px_rgba(192,132,252,0.24)]'
                          : 'border-white/12 bg-gradient-to-br from-violet-200/38 to-indigo-500/22 shadow-[0_0_18px_rgba(167,139,250,0.18)]'
                      }`}
                      style={{ width: size, height: size }}
                    >
                      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_30%,rgba(255,255,255,0.92),rgba(245,208,254,0.72)_26%,rgba(167,139,250,0.12)_62%,transparent_78%)]" />
                      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.28),transparent_70%)] blur-[4px]" />
                    </div>

                    {isSelected ? (
                      <div className="absolute -inset-2 rounded-full border border-violet-200/16 shadow-[0_0_42px_rgba(168,85,247,0.18)]" />
                    ) : null}

                    {showLabel ? (
                      <div
                        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-white ${
                          isLeftOrbit ? 'right-full mr-3 text-right' : 'left-full ml-3 text-left'
                        }`}
                      >
                        <div className="text-xs font-medium tracking-wide text-slate-100">
                          {displayTitle}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {layout.nodes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <p className="text-sm text-slate-300">等待生成知识星系...</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
