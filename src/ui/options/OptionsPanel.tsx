import React from 'react'
import type { OptionTab, OptionTabId, OptionsValues } from './types'
import type { Subcat } from '../step3/types'
import { OPTION_TABS, normalizeActiveTab, type OptionItemDef } from './config'
import { I, Icon } from '../icons'

type DecorTargetGroup = Extract<Subcat, 'Donji' | 'Gornji' | 'Visoki'>

type DetailState = {
  tabId: OptionTabId
  item: OptionItemDef
} | null

function OptionDetailsDialog({
  item,
  title,
  showPrice,
  isSelected,
  onSelect,
  onClose,
}: {
  item: OptionItemDef
  title: string
  showPrice: boolean
  isSelected: boolean
  onSelect: () => void
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1f26',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24,
          padding: 24,
          maxWidth: 420,
          width: '92%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'grid',
          gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--gold)', fontWeight: 900, fontSize: 18 }}>
          <Icon>{I.info}</Icon>
          <span>{title}</span>
        </div>

        <div
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            borderRadius: 18,
            border: '1px solid rgba(255,255,255,.08)',
            background: 'rgba(255,255,255,.03)',
            backgroundImage: `url(${item.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{item.title}</div>
          {showPrice && item.priceText && (
            <div style={{ color: 'var(--gold)', fontWeight: 800 }}>{item.priceText}</div>
          )}
          {item.details && (
            <div style={{ whiteSpace: 'pre-line', lineHeight: 1.5, color: 'rgba(255,255,255,0.9)' }}>{item.details}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
            Zatvori
          </button>
          <button className={isSelected ? 'btn' : 'btn primary'} onClick={() => { onSelect(); onClose() }} style={{ flex: 1, justifyContent: 'center' }}>
            {isSelected ? 'Izabrano' : 'Izaberi'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function OptionsPanel(props: {
  optionTab: OptionTab
  setOptionTab: (t: OptionTab) => void
  values: OptionsValues
  setValues: React.Dispatch<React.SetStateAction<OptionsValues>>
  scrollTop?: number
  onScrollTopChange?: (value: number) => void
  activeDecorGroup: DecorTargetGroup
  setActiveDecorGroup: (group: DecorTargetGroup) => void
  onRequestRemoveWorktop?: (apply: () => void) => void
}) {
  const {
    optionTab,
    setOptionTab,
    values,
    setValues,
    scrollTop = 0,
    onScrollTopChange,
    activeDecorGroup,
    setActiveDecorGroup,
    onRequestRemoveWorktop,
  } = props
  const [detailState, setDetailState] = React.useState<DetailState>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const next = normalizeActiveTab(optionTab, values)
    if (next !== optionTab) setOptionTab(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionTab, values])


  React.useLayoutEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const nextScrollTop = Math.max(0, scrollTop)
    if (Math.abs(node.scrollTop - nextScrollTop) <= 1) return
    node.scrollTop = nextScrollTop
  }, [scrollTop, optionTab])

  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    onScrollTopChange?.(event.currentTarget.scrollTop)
  }, [onScrollTopChange])

  const setValue = (tab: OptionTabId, value: string) => {
    const apply = () => setValues((v) => ({ ...v, [tab]: value }))

    if (tab === 'worktop' && value === 'Bez Radne ploče' && values.worktop !== 'Bez Radne ploče') {
      if (onRequestRemoveWorktop) {
        onRequestRemoveWorktop(apply)
        return
      }
    }

    apply()
  }

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          height: '100%',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 2,
          overscrollBehavior: 'contain',
        }}
      >
        <div style={{ display: 'grid', gap: 10 }}>
        {OPTION_TABS.map((t) => {
          const isActive = optionTab === t.id
          const isDisabled = t.disabled?.(values) ?? false
          const showPrice = t.id === 'worktop' || t.id === 'sink'

          return (
            <div
              key={t.id}
              style={{
                display: 'grid',
                gap: isActive && !isDisabled ? 8 : 0,
              }}
            >
              <button
                className={'btn' + (isActive ? ' primary' : '')}
                onClick={() => !isDisabled && setOptionTab(isActive ? null : t.id)}
                disabled={isDisabled}
                style={{
                  justifyContent: 'space-between',
                  opacity: isDisabled ? 0.45 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                <span style={{ fontWeight: 900 }}>{t.title}</span>
                <span className="hint">{isDisabled ? '—' : values[t.id]}</span>
              </button>

              {isActive && (
                <div
                  className="glass"
                  style={{
                    borderRadius: 18,
                    padding: 14,
                    boxShadow: 'none',
                    opacity: isDisabled ? 0.7 : 1,
                  }}
                >
                  {isDisabled ? (
                    <div className="hint">{t.disabledHint ?? 'Ova opcija trenutno nije dostupna.'}</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {t.id === 'decor' && (
                        <div
                          style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 8,
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            overflowX: 'auto',
                            padding: '2px 0 8px',
                            marginTop: -2,
                            background: 'linear-gradient(180deg, rgba(15,18,24,.96), rgba(15,18,24,.84), rgba(15,18,24,0))',
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          {(['Donji', 'Gornji', 'Visoki'] as DecorTargetGroup[]).map((group) => (
                            <button
                              key={group}
                              className="btn"
                              onClick={() => setActiveDecorGroup(group)}
                              style={{
                                flex: '0 0 auto',
                                minHeight: 38,
                                padding: '8px 10px',
                                borderRadius: 12,
                                background: activeDecorGroup === group ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                whiteSpace: 'nowrap',
                                fontWeight: 800,
                              }}
                            >
                              {group}
                            </button>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                        {t.items.map((item) => {
                          const selected = values[t.id] === item.value

                          if (item.isSimpleOption) {
                            return (
                              <button
                                key={item.value}
                                className="btn"
                                style={{
                                  width: '100%',
                                  minWidth: 0,
                                  minHeight: 52,
                                  padding: '12px 14px',
                                  borderRadius: 18,
                                  textAlign: 'left',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 12,
                                  background: selected ? 'rgba(214,179,106,.18)' : undefined,
                                  border: selected
                                    ? '1px solid rgba(214,179,106,.45)'
                                    : '1px solid rgba(255,255,255,.12)',
                                }}
                                onClick={() => setValue(t.id, item.value)}
                              >
                                <span style={{ fontWeight: 900 }}>{item.title}</span>
                                <span className="hint">{selected ? 'Izabrano' : 'Klik za izbor'}</span>
                              </button>
                            )
                          }

                          return (
                            <div key={item.value} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <button
                                className="btn"
                                style={{
                                  position: 'relative',
                                  flex: 1,
                                  minHeight: 124,
                                  padding: '12px 12px 12px 124px',
                                  borderRadius: 18,
                                  textAlign: 'left',
                                  display: 'block',
                                  width: '100%',
                                  minWidth: 0,
                                  background: selected ? 'rgba(214,179,106,.18)' : undefined,
                                  border: selected
                                    ? '1px solid rgba(214,179,106,.45)'
                                    : '1px solid rgba(255,255,255,.12)',
                                }}
                                onClick={() => setValue(t.id, item.value)}
                              >
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: 12,
                                    bottom: 12,
                                    width: 100,
                                    borderRadius: 14,
                                    border: '1px solid rgba(255,255,255,.08)',
                                    background: 'rgba(255,255,255,.03)',
                                    backgroundImage: `url(${item.image})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                  }}
                                />
                                <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                                  <div style={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.title}
                                  </div>
                                  {showPrice && item.priceText ? (
                                    <div style={{ color: 'var(--gold)', fontWeight: 700 }}>{item.priceText}</div>
                                  ) : null}
                                  {selected && <div className="hint">Izabrano</div>}
                                </div>
                              </button>

                              <button
                                className="btn"
                                style={{
                                  minHeight: 44,
                                  padding: '10px 12px',
                                  borderRadius: 14,
                                  fontWeight: 900,
                                  whiteSpace: 'nowrap',
                                }}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setDetailState({ tabId: t.id, item })
                                }}
                              >
                                Detalji
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        </div>
      </div>

      {detailState && (
        <OptionDetailsDialog
          item={detailState.item}
          title={OPTION_TABS.find((tab) => tab.id === detailState.tabId)?.title ?? 'Detalji'}
          showPrice={detailState.tabId === 'worktop' || detailState.tabId === 'sink'}
          isSelected={values[detailState.tabId] === detailState.item.value}
          onSelect={() => setValue(detailState.tabId, detailState.item.value)}
          onClose={() => setDetailState(null)}
        />
      )}
    </>
  )
}
