import React from 'react'
import { I, Icon } from '../icons'

export function InfoDialog({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1f26', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24, padding: 24, maxWidth: 320, width: '90%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', gap: 16
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--gold)', fontWeight: 900, fontSize: 18 }}>
          <Icon>{I.info}</Icon>
          <span>Obaveštenje</span>
        </div>
        <div style={{ whiteSpace: 'pre-line', lineHeight: 1.5, color: 'rgba(255,255,255,0.9)' }}>{msg}</div>
        <button className="btn primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
          U redu
        </button>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  msg,
  onConfirm,
  onCancel,
  confirmLabel = 'Potvrdi',
  cancelLabel = 'Otkaži',
}: {
  msg: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
}) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#1a1f26', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24, padding: 24, maxWidth: 320, width: '90%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', gap: 16
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--gold)', fontWeight: 900, fontSize: 18 }}>
          <Icon>{I.info}</Icon>
          <span>Potvrda</span>
        </div>
        <div style={{ whiteSpace: 'pre-line', lineHeight: 1.5, color: 'rgba(255,255,255,0.9)' }}>{msg}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={onCancel} style={{ flex: 1, justifyContent: 'center' }}>
            {cancelLabel}
          </button>
          <button className="btn primary" onClick={onConfirm} style={{ flex: 1, justifyContent: 'center' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
