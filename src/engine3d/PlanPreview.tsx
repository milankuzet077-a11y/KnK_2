import React, { useMemo } from 'react'
import type { KitchenShape, Walls } from '../domain/types'
import type { PlacedItem } from '../domain/types'
import type { WorktopVirtualItem } from '../domain/shapes/shared/worktopVirtual'

type RenderableItem = PlacedItem | WorktopVirtualItem

type Props = {
  shape: KitchenShape
  walls: Walls
  items: RenderableItem[]
}

const WIDTH = 360
const HEIGHT = 240
const PADDING = 20
const PARALLEL_GAP_MM = 3500

function toNumber(value: unknown) {
  const result = Number(value || 0)
  return Number.isFinite(result) ? result : 0
}

function getBounds(shape: KitchenShape, walls: Walls) {
  const wallA = toNumber(walls.A)
  const wallB = toNumber(walls.B)

  if (shape === 'parallel') {
    return { minX: 0, minY: 0, maxX: PARALLEL_GAP_MM + 600, maxY: Math.max(wallA, wallB, 1) }
  }

  if (shape === 'l-shape') {
    return { minX: 0, minY: 0, maxX: wallA, maxY: wallB }
  }

  return { minX: 0, minY: 0, maxX: wallA, maxY: 700 }
}

function projectPoint(x: number, y: number, bounds: ReturnType<typeof getBounds>) {
  const usableWidth = WIDTH - PADDING * 2
  const usableHeight = HEIGHT - PADDING * 2
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const scale = Math.min(usableWidth / width, usableHeight / height)
  return {
    x: PADDING + (x - bounds.minX) * scale,
    y: HEIGHT - PADDING - (y - bounds.minY) * scale,
    scale,
  }
}

function renderWalls(shape: KitchenShape, walls: Walls, bounds: ReturnType<typeof getBounds>) {
  const wallA = toNumber(walls.A)
  const wallB = toNumber(walls.B)

  if (shape === 'parallel') {
    const leftTop = projectPoint(0, wallA, bounds)
    const leftBottom = projectPoint(0, 0, bounds)
    const rightTop = projectPoint(PARALLEL_GAP_MM, wallB, bounds)
    const rightBottom = projectPoint(PARALLEL_GAP_MM, 0, bounds)
    return (
      <>
        <line x1={leftTop.x} y1={leftTop.y} x2={leftBottom.x} y2={leftBottom.y} stroke="#d7dbe0" strokeWidth="7" strokeLinecap="round" />
        <line x1={rightTop.x} y1={rightTop.y} x2={rightBottom.x} y2={rightBottom.y} stroke="#d7dbe0" strokeWidth="7" strokeLinecap="round" />
      </>
    )
  }

  if (shape === 'l-shape') {
    const a0 = projectPoint(0, 0, bounds)
    const a1 = projectPoint(wallA, 0, bounds)
    const b1 = projectPoint(0, wallB, bounds)
    return (
      <>
        <line x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} stroke="#d7dbe0" strokeWidth="7" strokeLinecap="round" />
        <line x1={a0.x} y1={a0.y} x2={b1.x} y2={b1.y} stroke="#d7dbe0" strokeWidth="7" strokeLinecap="round" />
      </>
    )
  }

  const p0 = projectPoint(0, 0, bounds)
  const p1 = projectPoint(wallA, 0, bounds)
  return <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#d7dbe0" strokeWidth="7" strokeLinecap="round" />
}

function itemRect(item: RenderableItem, shape: KitchenShape, bounds: ReturnType<typeof getBounds>) {
  const width = Math.max(1, toNumber((item as { width?: number }).width) || 600)
  const depth = Math.max(1, toNumber((item as { depth?: number; depthMm?: number }).depthMm ?? (item as { depth?: number }).depth) || 600)
  const x = toNumber((item as { x?: number }).x)
  const wallKey = String((item as { wallKey?: string }).wallKey || 'A')

  let originX = 0
  let originY = 0
  let rectWidth = width
  let rectHeight = depth

  if (shape === 'parallel') {
    if (wallKey === 'B') {
      originX = PARALLEL_GAP_MM - depth
      originY = x
      rectWidth = depth
      rectHeight = width
    } else {
      originX = 0
      originY = x
      rectWidth = depth
      rectHeight = width
    }
  } else if (shape === 'l-shape' && wallKey === 'B') {
    originX = x
    originY = 0
    rectWidth = width
    rectHeight = depth
  } else {
    originX = x
    originY = 0
  }

  const p = projectPoint(originX, originY + rectHeight, bounds)
  return { x: p.x, y: p.y, width: rectWidth * p.scale, height: rectHeight * p.scale }
}

export function PlanPreview({ shape, walls, items }: Props) {
  const bounds = useMemo(() => getBounds(shape, walls), [shape, walls])

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" style={{ opacity: 0.95 }}>
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="18" fill="rgba(8,11,16,0.72)" />
        {renderWalls(shape, walls, bounds)}
        {items.filter((item) => String(item.catalogId || '') !== '__virtual__').slice(0, 24).map((item) => {
          const rect = itemRect(item, shape, bounds)
          const isWood = ['Hrast', 'Orah'].includes(String((item as { decor?: string }).decor || ''))
          return (
            <rect
              key={String(item.uniqueId)}
              x={rect.x}
              y={rect.y}
              width={Math.max(6, rect.width)}
              height={Math.max(6, rect.height)}
              rx="3"
              fill={isWood ? 'rgba(184,140,96,0.82)' : 'rgba(194,202,212,0.72)'}
              stroke="rgba(255,255,255,0.24)"
              strokeWidth="1"
            />
          )
        })}
      </svg>
    </div>
  )
}
