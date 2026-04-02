// src/ui/Step2Walls.tsx
import React, { useEffect, useMemo, useState } from 'react'
import type { KitchenShape, Walls } from '../domain/types'

const MIN_WALL_MM = 500
const MIN_WALL_CM = MIN_WALL_MM / 10

const RAW_BASE = import.meta.env.BASE_URL ?? '/'
const BASE = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`
const step1Logo = 'assets/step1-logo.png'

const shapeIllustrations: Record<KitchenShape, string> = {
  straight: 'assets/shapes/straight.png',
  parallel: 'assets/shapes/parallel.png',
  'l-shape': 'assets/shapes/l-shapes.png',
}

const wallMarkersByShape: Record<
  KitchenShape,
  Array<{
    key: 'A' | 'B'
    top?: string
    left?: string
    right?: string
    bottom?: string
    transform?: string
  }>
> = {
  straight: [
    {
      key: 'A',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
    },
  ],
  parallel: [
    {
      key: 'A',
      top: '50%',
      left: '12px',
      transform: 'translateY(-50%)',
    },
    {
      key: 'B',
      top: '50%',
      right: '12px',
      transform: 'translateY(-50%)',
    },
  ],
  'l-shape': [
    {
      key: 'A',
      top: '50%',
      left: '12px',
      transform: 'translateY(-50%)',
    },
    {
      key: 'B',
      top: '12px',
      left: '62%',
      transform: 'translateX(-50%)',
    },
  ],
}

function wallKeys(shape: KitchenShape) {
  if (shape === 'straight') return ['A'] as const
  return shape === 'parallel' || shape === 'l-shape' ? (['A', 'B'] as const) : (['A'] as const)
}

function getWallValue(walls: Walls, key: keyof Walls): number | undefined {
  return walls[key]
}

function mmToCmInput(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return String(value / 10)
}

function parseCmToMm(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (!trimmed) return null
  const parsedCm = Number(trimmed)
  if (!Number.isFinite(parsedCm)) return null
  return parsedCm * 10
}

export function Step2Walls({
  shape,
  initial,
  initialInputs,
  onBack,
  onNext,
}: {
  shape: KitchenShape
  initial: Walls
  initialInputs?: Partial<Record<string, string>>
  onBack: () => void
  onNext: (w: Walls, rawInputs: Record<string, string>) => void
}) {
  const keys = useMemo(() => wallKeys(shape), [shape])
  const shapeImage = shapeIllustrations[shape]
  const wallMarkers = wallMarkersByShape[shape]
  const [wallInputs, setWallInputs] = useState<Record<string, string>>(() => ({
    A: initialInputs?.A ?? mmToCmInput(initial.A),
    B: initialInputs?.B ?? mmToCmInput(initial.B),
    C: initialInputs?.C ?? mmToCmInput(initial.C),
    D: initialInputs?.D ?? mmToCmInput(initial.D),
  }))

  useEffect(() => {
    setWallInputs({
      A: initialInputs?.A ?? mmToCmInput(initial.A),
      B: initialInputs?.B ?? mmToCmInput(initial.B),
      C: initialInputs?.C ?? mmToCmInput(initial.C),
      D: initialInputs?.D ?? mmToCmInput(initial.D),
    })
  }, [initial.A, initial.B, initial.C, initial.D, initialInputs?.A, initialInputs?.B, initialInputs?.C, initialInputs?.D])

  const parsedWalls = useMemo<Walls>(() => {
    const nextWalls: Walls = {}
    keys.forEach((key) => {
      const parsed = parseCmToMm(wallInputs[key] ?? '')
      nextWalls[key] = parsed ?? undefined
    })
    return nextWalls
  }, [keys, wallInputs])

  const invalidKeys = useMemo(() => {
    return keys.filter((key) => {
      const value = getWallValue(parsedWalls, key)
      return typeof value !== 'number' || !Number.isFinite(value) || value < MIN_WALL_MM
    })
  }, [keys, parsedWalls])

  const canNext = invalidKeys.length === 0
  const validationMsg =
    invalidKeys.length === 0
      ? ''
      : `Unesite validne dimenzije (${MIN_WALL_CM}cm ili više) za zid: ${invalidKeys.join(', ')}`

  return (
    <div className="safe" style={{ minHeight: 'var(--app-height)', display: 'grid', placeItems: 'center' }}>
      <div className="glass fadeIn step2-card" style={{ width: 'min(860px, 96vw)', borderRadius: 28, padding: 18 }}>
        <div
          style={{
            display: 'grid',
            justifyItems: 'center',
            gap: 12,
            textAlign: 'center',
          }}
        >
          <img
            src={`${BASE}${step1Logo}`}
            alt="Kuhinja na klik"
            style={{
              width: 'min(100%, 420px)',
              height: 'auto',
              display: 'block',
              objectFit: 'contain',
            }}
          />
          <div style={{ fontSize: 22, fontWeight: 900 }}>Unesite dimenzije svojih zidova</div>
          <div className="hint">Unosite dimenzije u cm</div>
        </div>

        <div style={{ marginTop: 14, display: 'grid', placeItems: 'center' }}>
          <div
            className="glass"
            style={{
              width: 'min(100%, 360px)',
              borderRadius: 20,
              padding: 14,
              boxShadow: 'none',
            }}
          >
            <div style={{ position: 'relative', width: '100%', borderRadius: 16, overflow: 'hidden' }}>
              <img
                src={`${BASE}${shapeImage}`}
                alt="Prikaz oblika kuhinje sa oznakama zidova"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  objectFit: 'contain',
                  background: 'rgba(255,255,255,.03)',
                }}
              />
              {wallMarkers.map((marker) => (
                <div
                  key={marker.key}
                  style={{
                    position: 'absolute',
                    top: marker.top,
                    left: marker.left,
                    right: marker.right,
                    bottom: marker.bottom,
                    transform: marker.transform,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'rgba(0,0,0,.74)',
                    border: '1px solid rgba(255,255,255,.18)',
                    color: 'rgba(255,255,255,.96)',
                    fontWeight: 900,
                    fontSize: 12,
                    lineHeight: 1,
                    letterSpacing: 0.3,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 8px 20px rgba(0,0,0,.22)',
                  }}
                >
                  Zid {marker.key}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {keys.map((key) => (
            <div key={key} className="glass" style={{ borderRadius: 20, padding: 14, boxShadow: 'none' }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Zid {key}</div>
              <input
                value={wallInputs[key] ?? ''}
                onChange={(event) => setWallInputs((prev) => ({ ...prev, [key]: event.target.value }))}
                inputMode="decimal"
                placeholder="npr. 360"
                style={{
                  width: '100%',
                  minHeight: 46,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,.14)',
                  background: 'rgba(0,0,0,.18)',
                  color: 'rgba(255,255,255,.92)',
                  padding: '10px 12px',
                  outline: 'none',
                }}
              />
              <div className="hint" style={{ marginTop: 8 }}>
                cm
              </div>
            </div>
          ))}
        </div>

        {!!validationMsg && (
          <div className="hint" style={{ marginTop: 12, color: 'rgba(255,140,140,.95)' }}>
            {validationMsg}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={onBack}>
            Vrati se na izbor oblika
          </button>
          <button
            className="btn primary"
            disabled={!canNext}
            onClick={() => {
              if (canNext) onNext(parsedWalls, wallInputs)
            }}
            title={!canNext ? `Minimum ${MIN_WALL_CM}cm po zidu` : undefined}
          >
            Sledeći korak
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px){
          .step2-card{
            max-height: calc(var(--app-height) - 24px - var(--safe-top) - var(--safe-bottom));
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
          }

          .step2-card::-webkit-scrollbar{
            width: 0;
            height: 0;
          }

          .safe [style*="repeat(3"]{ grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
