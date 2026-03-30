// src/ui/Step1ChooseShape.tsx
import React from 'react'
import type { KitchenShape } from '../domain/types'

// NOTE:
// Koristimo BASE_URL (Vite) da bi slike radile i kad je aplikacija hostovana u pod-folderu
// (npr. https://domen.com/nekipath/), a ne samo na root-u.
const RAW_BASE = import.meta.env.BASE_URL ?? '/'
const BASE = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`

const shapes: { id: KitchenShape; title: string; img: string }[] = [
  { id: 'straight', title: 'Ravna', img: 'assets/shapes/straight.png' },
  { id: 'parallel', title: 'Paralelna', img: 'assets/shapes/parallel.png' },
  { id: 'l-shape', title: 'Ugaona Г', img: 'assets/shapes/l-shapes.png' },
]

const step1Logo = 'assets/step1-logo.png'

export function Step1ChooseShape({ onPick }: { onPick: (s: KitchenShape) => void }) {
  return (
    <div className="safe fullscreen shapeStep" style={{ display: 'grid', placeItems: 'center' }}>
      <div
        className="glass fadeIn shapePanel"
        style={{
          width: 'min(740px, 94vw)',
          borderRadius: 28,
          padding: 18,
          maxHeight: 'calc(var(--app-height) - 24px)',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          className="shapeHeader"
          style={{
            display: 'grid',
            justifyItems: 'center',
            gap: 14,
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
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.3, textAlign: 'center' }}>
            Izaberite oblik vaše kuhinje
          </div>
        </div>

        <div
          className="shapeGrid"
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          {shapes.map((s) => (
            <button
              key={s.id}
              className="btn shapeCard"
              onClick={() => onPick(s.id)}
              style={{
                borderRadius: 20,
                padding: 14,
                display: 'grid',
                justifyItems: 'center',
                gap: 10,
              }}
            >
              <div
                className="shapeThumb"
                style={{
                  width: '100%',
                  aspectRatio: '5 / 4',
                  borderRadius: 0,
                  border: '1px solid rgba(255,255,255,.10)',
                  background: 'rgba(255,255,255,.06)',
                  overflow: 'hidden',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <img
                  src={`${BASE}${s.img.startsWith('/') ? s.img.slice(1) : s.img}`}
                  alt={s.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    opacity: 1,
                    transform: 'scale(0.98)',
                  }}
                />
              </div>

              <div
                className="shapeTitle"
                style={{
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  width: '100%',
                  height: 34,
                  display: 'grid',
                  placeItems: 'center',
                  letterSpacing: 0.4,
                }}
              >
                {s.title}
              </div>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .shapeCard{
          transition: transform .12s ease, filter .12s ease;
          will-change: transform;
        }
        .shapeCard:hover{
          transform: translateY(-2px);
          filter: brightness(1.03);
        }
        .shapeCard:active{
          transform: translateY(0px) scale(.99);
        }

        @media (max-width: 700px){
          .shapePanel{ width: min(520px, 94vw) !important; padding: 14px !important; }
          .shapeGrid{ grid-template-columns: 1fr !important; gap: 10px !important; }
          .shapeCard{ padding: 12px !important; }
          .shapeThumb{
            max-height: 220px !important;
            aspect-ratio: 5 / 4 !important;
            border-radius: 14px !important;
          }
          .shapeTitle{ height: 30px !important; font-size: 13px !important; }
        }

        @media (min-width: 1200px){
          .shapePanel{ width: min(780px, 70vw) !important; }
        }
      `}</style>
    </div>
  )
}
