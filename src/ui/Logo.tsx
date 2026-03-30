import React from 'react'

export function Logo({ compact }: { compact?: boolean }) {
  const size = compact ? 44 : 56

  return (
    <div
      className="glass"
      style={{
        borderRadius: 18,
        padding: compact ? 8 : 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + (compact ? 12 : 16),
        height: size + (compact ? 12 : 16),
      }}
      aria-label="Application logo"
      title="Application logo"
    >
      <img
        src="/logo-template.svg"
        alt="Application logo"
        width={size}
        height={size}
        style={{ display: 'block', width: size, height: size }}
      />
    </div>
  )
}
