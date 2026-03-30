import React from 'react'
import { I, Icon } from '../icons'

export function SidePanel({
  side,
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  side: 'left' | 'right'
  title: string
  icon?: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const width = 420
  const x = open ? 0 : side === 'left' ? -width - 10 : width + 10
  return (
    <>
      <button
        className="glass"
        onClick={onToggle}
        style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: 12,
          zIndex: 3,
          width: 46, height: 160, borderRadius: 20,
          border: open ? '1px solid rgba(214,179,106,.35)' : '1px solid rgba(255,255,255,.12)',
          cursor: 'pointer', display: open ? 'none' : 'grid', placeItems: 'center',
          background: open ? 'linear-gradient(180deg, rgba(214,179,106,.14), rgba(0,0,0,.18))' : undefined,
        } as React.CSSProperties}
      >
        <div style={{ transform: 'rotate(-90deg)', letterSpacing: 2, fontWeight: 900, fontSize: 12, color: open ? 'var(--gold)' : 'rgba(255,255,255,.86)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          {title}
        </div>
      </button>
      <div
        className={'glass' + (open ? ' fadeIn' : '')}
        style={{
          position: 'absolute',
          top: 90,
          bottom: 90,
          zIndex: 2,
          width,
          borderRadius: 26,
          padding: 14,
          overflow: 'hidden',
          [side]: 12,
          transform: `translateX(${x}px)`,
          transition: 'transform .22s ease',
          pointerEvents: open ? 'auto' : 'none'
        } as React.CSSProperties}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 900, letterSpacing: .2 }}>{title}</div>
          <button className="btn" onClick={onToggle} style={{ minHeight: 40, padding: '8px 10px' }}><Icon>{I.close}</Icon> Zatvori</button>
        </div>
        <div style={{ marginTop: 12, height: 'calc(100% - 54px)', minHeight: 0, overflow: 'hidden' }}>{children}</div>
      </div>
    </>
  )
}
