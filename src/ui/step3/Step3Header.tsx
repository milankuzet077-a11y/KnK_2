import React from 'react'
import type { WallKey } from '../../domain/types'

const RAW_BASE = import.meta.env.BASE_URL ?? '/'
const BASE = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`
const step1Logo = 'assets/step1-logo.png'

export function Step3Header({
  isDesktop,
  activeWall,
  dimensionText,
  previewOnly = false,
}: {
  isDesktop: boolean
  activeWall: WallKey
  dimensionText: string
  previewOnly?: boolean
}) {
  return (
    <div className="safe" style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <img
        src={`${BASE}${step1Logo}`}
        alt="Kuhinja na klik"
        style={{
          width: isDesktop ? 220 : 164,
          height: 'auto',
          display: 'block',
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />

      {previewOnly ? null : (
        <div className="glass pill" style={{
          borderRadius: 18,
          boxShadow: 'none',
          width: 180,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '8px 0'
        }}>
          <span style={{ color: 'var(--gold)', fontWeight: 900, whiteSpace: 'nowrap', fontSize: 16 }}>
            Zid {activeWall}
          </span>
          <span className="hint" style={{ whiteSpace: 'pre-line', lineHeight: 1.4, textAlign: 'center', fontSize: 13 }}>
            {dimensionText}
          </span>
        </div>
      )}
    </div>
  )
}
