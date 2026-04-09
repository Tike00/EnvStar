import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Compass, Database, Sparkles, X } from 'lucide-react'
import { useKnowledgeStore } from '../providers/knowledge-store.tsx'
import { FileImporter } from '../../features/markdown/components/file-importer.tsx'
import { ConstellationJumpList } from '../../features/graph/components/constellation-jump-list.tsx'
import { MiniMap } from '../../features/graph/components/minimap.tsx'
import { StarMap } from '../../features/graph/components/star-map.tsx'
import { centerViewportOnWorldPoint } from '../../features/graph/lib/graph-geometry.ts'
import { layoutConstellations } from '../../features/graph/lib/layout-constellations.ts'
import { buildProgressiveVisibility } from '../../features/graph/lib/progressive-visibility.ts'
import { NodeDetailDrawer } from '../../features/node-detail/components/node-detail-drawer.tsx'
import { GlobalSearchPanel } from '../../features/search/components/global-search-panel.tsx'
import {
  searchKnowledgeNodes,
  type KnowledgeSearchResult,
} from '../../features/search/lib/search-knowledge.ts'
import type { Bounds, ViewportState } from '../../shared/types/knowledge.ts'

export function GraphScreen() {
  const {
    constellations,
    clearAll,
    importFiles,
    isBusy,
    isHydrated,
    removeConstellation,
  } = useKnowledgeStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [focusBounds, setFocusBounds] = useState<Bounds | null>(null)
  const [focusNonce, setFocusNonce] = useState(0)
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    scale: 1,
  })
  const [viewportRequest, setViewportRequest] = useState<ViewportState | null>(null)
  const [viewportRequestNonce, setViewportRequestNonce] = useState(0)
  const [graphSize, setGraphSize] = useState({ width: 0, height: 0 })
  const [isControlsCollapsed, setControlsCollapsed] = useState(false)
  const [isSearchOpen, setSearchOpen] = useState(false)
  const [showAllNodes, setShowAllNodes] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const lastCenteredNodeKeyRef = useRef<string | null>(null)

  const selectedNodeId = searchParams.get('node')
  const deferredSelectedNodeId = useDeferredValue(selectedNodeId)
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const rawNodeMap = useMemo(
    () =>
      new Map(
        constellations.flatMap((constellation) =>
          constellation.nodes.map((node) => [node.id, node] as const),
        ),
      ),
    [constellations],
  )
  const rawConstellationMap = useMemo(
    () =>
      new Map(constellations.map((constellation) => [constellation.id, constellation] as const)),
    [constellations],
  )
  const initialFitKey = useMemo(
    () =>
      constellations
        .map(
          (constellation) =>
            `${constellation.id}:${constellation.nodes.length}:${constellation.edges.length}`,
        )
        .join('|'),
    [constellations],
  )

  const progressiveView = useMemo(
    () => buildProgressiveVisibility(constellations, selectedNodeId, showAllNodes),
    [constellations, selectedNodeId, showAllNodes],
  )
  const layout = useMemo(
    () => layoutConstellations(progressiveView.constellations),
    [progressiveView.constellations],
  )

  const nodeMap = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node] as const)),
    [layout.nodes],
  )
  const constellationMap = useMemo(
    () =>
      new Map(
        layout.constellations.map((constellation) => [constellation.id, constellation] as const),
      ),
    [layout.constellations],
  )

  const searchResults = useMemo(
    () => searchKnowledgeNodes(constellations, deferredSearchQuery, 14),
    [constellations, deferredSearchQuery],
  )
  const searchNodeIds = useMemo(
    () => new Set(searchResults.map((result) => result.node.id)),
    [searchResults],
  )

  const selectedNode = deferredSelectedNodeId
    ? (rawNodeMap.get(deferredSelectedNodeId) ?? null)
    : null
  const selectedConstellationId =
    selectedNode?.constellationId ??
    searchParams.get('constellation') ??
    constellations[0]?.id ??
    null
  const selectedConstellation = selectedConstellationId
    ? (rawConstellationMap.get(selectedConstellationId) ?? null)
    : null

  const relatedNodes = selectedNode
    ? selectedNode.relatedNodeIds
        .map((relatedNodeId) => rawNodeMap.get(relatedNodeId) ?? null)
        .filter((node): node is NonNullable<typeof node> => Boolean(node))
    : []

  const totalNodes = useMemo(
    () => constellations.reduce((sum, constellation) => sum + constellation.nodes.length, 0),
    [constellations],
  )
  const totalEdges = useMemo(
    () => constellations.reduce((sum, constellation) => sum + constellation.edges.length, 0),
    [constellations],
  )
  const visibleNodes = layout.nodes.length
  const visibleEdges = layout.edges.length

  const updateSearchParams = (nodeId: string | null, constellationId: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (nodeId) {
      next.set('node', nodeId)
    } else {
      next.delete('node')
    }

    if (constellationId) {
      next.set('constellation', constellationId)
    } else {
      next.delete('constellation')
    }

    setSearchParams(next, { replace: true })
  }

  const requestFocus = (nextBounds: Bounds) => {
    setFocusBounds(nextBounds)
    setFocusNonce((current) => current + 1)
  }

  const requestViewport = (nextViewport: ViewportState) => {
    setViewportRequest(nextViewport)
    setViewportRequestNonce((current) => current + 1)
  }

  const getNodeFocusScale = (depth: number) => {
    if (depth <= 0) {
      return 0.82
    }

    if (depth === 1) {
      return 1.02
    }

    if (depth === 2) {
      return 1.16
    }

    return 1.28
  }

  const handleNodeSelect = (nodeId: string) => {
    const node = rawNodeMap.get(nodeId)
    if (!node) {
      return
    }

    updateSearchParams(node.id, node.constellationId)
  }

  const handleSearchResultSelect = (result: KnowledgeSearchResult) => {
    setSearchOpen(false)
    updateSearchParams(result.node.id, result.node.constellationId)
  }

  const handleClearSelection = () => {
    updateSearchParams(null, selectedConstellationId)
  }

  const handleConstellationJump = (constellationId: string) => {
    const constellation = constellationMap.get(constellationId)
    if (!constellation) {
      return
    }

    updateSearchParams(null, constellationId)
    requestFocus(constellation.bounds)
  }

  const handleMiniMapJump = (nextViewport: ViewportState) => {
    requestViewport(nextViewport)
  }

  const handleRemoveConstellation = (constellationId: string) => {
    const fallbackConstellationId =
      constellations.find((constellation) => constellation.id !== constellationId)?.id ?? null

    if (
      selectedConstellationId === constellationId ||
      selectedNode?.constellationId === constellationId
    ) {
      updateSearchParams(null, fallbackConstellationId)
    }

    removeConstellation(constellationId)
  }

  useEffect(() => {
    if (constellations.length === 0) {
      if (selectedNodeId || selectedConstellationId) {
        updateSearchParams(null, null)
      }
      return
    }

    if (selectedNodeId && !rawNodeMap.has(selectedNodeId)) {
      updateSearchParams(
        null,
        selectedConstellationId && rawConstellationMap.has(selectedConstellationId)
          ? selectedConstellationId
          : (constellations[0]?.id ?? null),
      )
      return
    }

    if (selectedConstellationId && !rawConstellationMap.has(selectedConstellationId)) {
      updateSearchParams(null, constellations[0]?.id ?? null)
    }
  }, [
    constellations,
    rawConstellationMap,
    rawNodeMap,
    selectedConstellationId,
    selectedNodeId,
  ])

  useEffect(() => {
    if (!selectedNodeId || graphSize.width === 0 || graphSize.height === 0) {
      if (!selectedNodeId) {
        lastCenteredNodeKeyRef.current = null
      }
      return
    }

    const layoutNode = nodeMap.get(selectedNodeId)
    if (!layoutNode) {
      return
    }

    const centerKey = `${selectedNodeId}:${Math.round(layoutNode.x)}:${Math.round(layoutNode.y)}`
    if (lastCenteredNodeKeyRef.current === centerKey) {
      return
    }

    lastCenteredNodeKeyRef.current = centerKey
    requestViewport(
      centerViewportOnWorldPoint(
        layoutNode.x,
        layoutNode.y,
        graphSize,
        Math.max(viewport.scale, getNodeFocusScale(layoutNode.depth)),
      ),
    )
  }, [graphSize.height, graphSize.width, nodeMap, selectedNodeId, viewport.scale])

  if (!isHydrated) {
    return (
      <div className="cosmos-shell flex min-h-screen items-center justify-center p-6">
        <div className="glass-panel max-w-md rounded-[2rem] p-8 text-center">
          <Sparkles className="mx-auto mb-4 h-8 w-8 text-violet-200" />
          <h1 className="text-2xl font-semibold text-white">正在构建知识星图</h1>
          <p className="mt-3 text-sm text-slate-300">
            Envstar 正在恢复已导入的 Markdown 星系和本地视图状态。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmos-shell relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,10,32,0.32),rgba(7,4,18,0.78))]" />
      <div className="pointer-events-none absolute -left-28 top-[6%] h-[34rem] w-[34rem] rounded-full bg-fuchsia-500/12 blur-[150px]" />
      <div className="pointer-events-none absolute right-[-8rem] top-[18%] h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute left-[30%] top-[54%] h-[26rem] w-[26rem] -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[150px]" />

      {layout.nodes.length === 0 ? (
        <div className="relative flex min-h-screen items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel w-full max-w-2xl rounded-[2rem] p-8 md:p-10"
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-xl">
                <p className="text-xs uppercase tracking-[0.36em] text-violet-200/65">Envstar</p>
                <h1 className="mt-4 text-4xl font-semibold text-white md:text-5xl">
                  你的知识星图目前还是一片寂静宇宙
                </h1>
                <p className="mt-4 text-base leading-7 text-slate-300">
                  导入一个或多个 Markdown 文件后，Envstar 会把标题层级映射成恒星、行星和卫星节点，并保留代码块、命令示例与正文内容。
                </p>
              </div>
              <div className="rounded-3xl border border-violet-200/12 bg-slate-950/38 px-4 py-3 text-sm text-slate-300">
                支持多文件星系、缩放拖拽、节点聚焦、渐进展开以及技术笔记内容检索。
              </div>
            </div>

            <div className="mt-8">
              <FileImporter
                documentCount={constellations.length}
                isBusy={isBusy}
                onClear={clearAll}
                onImport={importFiles}
              />
            </div>
          </motion.div>
        </div>
      ) : (
        <>
          <StarMap
            focusBounds={focusBounds}
            focusNonce={focusNonce}
            initialFitKey={initialFitKey}
            layout={layout}
            onClearSelection={handleClearSelection}
            onNodeSelect={handleNodeSelect}
            onSizeChange={setGraphSize}
            onViewportChange={setViewport}
            searchNodeIds={searchNodeIds}
            selectedNodeId={selectedNode?.id ?? null}
            viewportRequest={viewportRequest}
            viewportRequestNonce={viewportRequestNonce}
          />

          <div className="pointer-events-none absolute inset-0">
            {isControlsCollapsed ? (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto absolute left-4 top-4 z-20"
              >
                <button
                  type="button"
                  onClick={() => setControlsCollapsed(false)}
                  className="glass-panel inline-flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs text-slate-100 transition hover:border-violet-200/16 hover:bg-white/8"
                >
                  <Sparkles className="h-3.5 w-3.5 text-violet-200" />
                  <span>展开 Envstar 面板</span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto absolute left-4 top-4 z-20 w-[min(320px,calc(100vw-2rem))] space-y-2.5"
              >
                <div className="glass-panel rounded-[1.55rem] px-3.5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.42em] text-violet-200/65">
                        Envstar
                      </p>
                      <h1 className="mt-1.5 text-[1.12rem] font-semibold text-white">
                        星空知识图谱
                      </h1>
                      <p className="mt-1.5 text-[12px] leading-5 text-slate-300">
                        默认只显示恒星和当前分支的下一层节点，点击后会平滑聚焦到对应轨道。
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => requestFocus(layout.worldBounds)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-violet-200/14 bg-slate-950/42 text-violet-50 transition hover:border-violet-200/24 hover:bg-white/8"
                        title="回到全景"
                      >
                        <Compass className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setControlsCollapsed(true)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-slate-200 transition hover:border-violet-200/16 hover:bg-white/8"
                        title="缩略面板"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1.5 text-sm">
                    <div className="rounded-[1rem] border border-white/8 bg-white/4 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                        星系
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {constellations.length}
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-white/8 bg-white/4 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                        节点
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {visibleNodes}/{totalNodes}
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-white/8 bg-white/4 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                        关系
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {visibleEdges}/{totalEdges}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <GlobalSearchPanel
                      isOpen={isSearchOpen}
                      query={searchQuery}
                      results={searchResults}
                      selectedNodeId={selectedNode?.id ?? null}
                      onClose={() => setSearchOpen(false)}
                      onOpen={() => setSearchOpen(true)}
                      onQueryChange={setSearchQuery}
                      onSelectResult={handleSearchResultSelect}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowAllNodes((current) => !current)}
                      className={`rounded-[1rem] border px-2.5 py-2.5 text-xs transition ${
                        showAllNodes
                          ? 'border-violet-200/16 bg-violet-400/10 text-violet-50'
                          : 'border-white/8 bg-white/4 text-slate-200 hover:border-violet-200/14 hover:bg-white/8'
                      }`}
                    >
                      {showAllNodes ? '已显示全部节点' : '显示全部节点'}
                    </button>
                    <div className="rounded-[1rem] border border-white/8 bg-white/4 px-2.5 py-2.5 text-xs text-slate-300">
                      {showAllNodes ? '全量模式' : '渐进展开模式'}
                    </div>
                  </div>

                  <div className="mt-3">
                    <FileImporter
                      documentCount={constellations.length}
                      isBusy={isBusy}
                      onClear={clearAll}
                      onImport={importFiles}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className="pointer-events-auto absolute right-4 top-4 z-20 flex max-h-[calc(100vh-1.9rem)] w-[min(286px,calc(100vw-2rem))] flex-col gap-3"
            >
              <ConstellationJumpList
                activeConstellationId={selectedConstellationId}
                constellations={constellations}
                onJump={handleConstellationJump}
                onRemove={handleRemoveConstellation}
              />

              <div className="glass-panel shrink-0 rounded-[1.75rem] px-4 py-4 text-sm text-slate-300">
                <div className="flex items-center gap-2 text-white">
                  <Database className="h-4 w-4 text-violet-200" />
                  <span className="font-medium">当前视野提示</span>
                </div>
                <p className="mt-3 leading-6">
                  节点点击后会先平滑移动到目标位置，再适度放大当前层级。搜索结果会扫描所有已加载的 Markdown 正文和标题，不受当前视野限制。
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-violet-200/12 bg-violet-400/10 px-3 py-1 text-xs text-violet-50">
                    {showAllNodes ? '全部节点已开启' : '渐进展开中'}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs text-slate-200">
                    当前缩放 {viewport.scale.toFixed(2)}x
                  </span>
                  {searchQuery.trim() ? (
                    <span className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs text-slate-200">
                      搜索命中 {searchResults.length} 项
                    </span>
                  ) : null}
                </div>

                {selectedConstellation ? (
                  <div className="mt-4 rounded-2xl border border-violet-200/10 bg-violet-400/8 px-3 py-3 text-violet-50">
                    当前星系：{selectedConstellation.title}
                  </div>
                ) : null}
              </div>
            </motion.div>

            <MiniMap
              layout={layout}
              onFocusWorld={() => requestFocus(layout.worldBounds)}
              onViewportRequest={handleMiniMapJump}
              size={graphSize}
              viewport={viewport}
            />
          </div>

          <NodeDetailDrawer
            node={selectedNode}
            onClose={handleClearSelection}
            onSelectNode={(nodeId) => {
              handleNodeSelect(nodeId)
            }}
            relatedNodes={relatedNodes}
          />
        </>
      )}
    </div>
  )
}
