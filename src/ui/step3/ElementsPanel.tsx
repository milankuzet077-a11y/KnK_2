import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getLCornersState } from '../../domain/shapes/L/placementLogic'
import type { CatalogElement } from '../../domain/catalog/catalogTypes'
import { isCornerCatalogElement, getCatalogKind } from '../../domain/catalog/catalogTypes'
import type { ElementsPanelProps, Subcat } from './types'

const priceFormatter = new Intl.NumberFormat('sr-RS')

function filterBySubcategory(item: CatalogElement, subcat: Subcat, isIShape: boolean, isParallel: boolean): boolean {
  const kind = getCatalogKind(item)
  if (subcat === 'Donji') return kind === 'base' || kind.includes('donji')
  if (subcat === 'Gornji') return kind === 'wall' || kind.includes('gornji') || kind.includes('vise') || kind.includes('visi')
  if (subcat === 'Visoki') return kind === 'tall' || kind.includes('visok')
  if (subcat === 'Ugao') return !isIShape && !isParallel && isCornerCatalogElement(item)
  return true
}

function isWallKind(kind: string): boolean {
  return kind === 'wall' || kind.includes('gornji') || kind.includes('vise') || kind.includes('visi')
}

function isBaseOrTallKind(kind: string): boolean {
  return kind === 'base' || kind === 'tall' || kind.includes('donji') || kind.includes('visok')
}

const WALL_SWITCHER_STICKY_TOP = 0
const WALL_SWITCHER_HEIGHT = 54

export function ElementsPanel({
  shape,
  placedItems,
  targetWall,
  availableWalls,
  onTargetWallChange,
  onAddItem,
  subcat,
  onSubcatChange,
  onCloseDrawer,
  scrollTop = 0,
  onScrollTopChange,
}: ElementsPanelProps) {
  const navigate = useNavigate()
  const isIShape = shape === 'straight'
  const isParallel = shape === 'parallel'
  const isLShape = shape === 'l-shape'

  const cornersState = React.useMemo(() => {
    if (!isLShape) return { hasLower: true, hasUpper: true, ready: true }
    return getLCornersState(placedItems) ?? { hasLower: false, hasUpper: false, ready: false }
  }, [isLShape, placedItems])

  const lowerUnlocked = !isLShape || cornersState.hasLower
  const upperUnlocked = !isLShape || cornersState.hasUpper

  React.useEffect(() => {
    if (!isLShape) return
    const subcatUnlocked = subcat === 'Ugao'
      || ((subcat === 'Donji' || subcat === 'Visoki') && lowerUnlocked)
      || (subcat === 'Gornji' && upperUnlocked)

    if (!subcatUnlocked) {
      onSubcatChange('Ugao')
    }
  }, [isLShape, lowerUnlocked, upperUnlocked, subcat, onSubcatChange])

  React.useEffect(() => {
    if ((isIShape || isParallel) && subcat === 'Ugao') {
      onSubcatChange('Donji')
    }
  }, [isIShape, isParallel, subcat, onSubcatChange])

  const [items, setItems] = React.useState<CatalogElement[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { loadAllCatalogs } = await import('../../domain/catalog/loadCatalogs')
        const data = await loadAllCatalogs()
        if (!alive) return
        setItems(Array.isArray(data.items) ? data.items : [])
      } catch {
        if (!alive) return
        setItems([])
      } finally {
        if (!alive) return
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const [openSubcat, setOpenSubcat] = React.useState<Subcat | null>(() => (placedItems.length > 0 ? subcat : (isLShape ? 'Ugao' : null)))
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const subcatButtonRefs = React.useRef<Record<Subcat, HTMLButtonElement | null>>({
    Donji: null,
    Gornji: null,
    Visoki: null,
    Ugao: null,
  })

  React.useEffect(() => {
    setOpenSubcat(placedItems.length > 0 ? subcat : (isLShape ? 'Ugao' : null))
  }, [isLShape, placedItems.length, shape, subcat])


  const filteredByOpenSubcat = React.useMemo(() => {
    if (openSubcat === null) return []
    return items.filter((it) => filterBySubcategory(it, openSubcat, isIShape, isParallel))
  }, [items, openSubcat, isIShape, isParallel])


  React.useLayoutEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const nextScrollTop = Math.max(0, scrollTop)
    if (Math.abs(node.scrollTop - nextScrollTop) <= 1) return
    node.scrollTop = nextScrollTop
  }, [scrollTop, openSubcat, loading, filteredByOpenSubcat.length])

  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const nextScrollTop = event.currentTarget.scrollTop
    onScrollTopChange?.(nextScrollTop)
  }, [onScrollTopChange])

  const subcats: Subcat[] = isLShape ? ['Donji', 'Gornji', 'Visoki', 'Ugao'] : ['Donji', 'Gornji', 'Visoki']
  const subcatLabels: Record<Subcat, string> = {
    Donji: 'Radni (donji) elementi',
    Gornji: 'Viseći (gornji) elementi',
    Visoki: 'Visoki elementi',
    Ugao: 'Ugaoni elementi',
  }

  return (
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
      <div style={{ display: 'grid', gap: 12 }}>
        {isLShape && (!cornersState.hasLower || !cornersState.hasUpper) && (
          <div
            className="hint"
            style={{
              padding: '10px 12px',
              borderRadius: 14,
              border: '1px solid rgba(214,179,106,.28)',
              background: 'rgba(214,179,106,.10)',
              color: 'rgba(255,255,255,.92)',
              lineHeight: 1.35
            }}
          >
            {!cornersState.hasLower && !cornersState.hasUpper
              ? <>Za <strong>L</strong> oblik prvo dodajte <strong>DONJI</strong> ugaoni element da biste otključali <strong>donje</strong> i <strong>visoke</strong> elemente, a <strong>GORNJI</strong> ugaoni element otključava <strong>gornje</strong> elemente.</>
              : !cornersState.hasLower
                ? <>Dodajte <strong>DONJI</strong> ugaoni element da biste otključali <strong>donje</strong> i <strong>visoke</strong> elemente.</>
                : <>Dodajte <strong>GORNJI</strong> ugaoni element da biste otključali <strong>gornje</strong> elemente.</>}
          </div>
        )}

        {!isIShape && (
          <>
            <div
              style={{
                position: 'sticky',
                top: WALL_SWITCHER_STICKY_TOP,
                zIndex: 8,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                alignSelf: 'start',
                padding: '2px 0 8px',
                marginBottom: 6,
                background: 'linear-gradient(180deg, rgba(15,18,24,.98), rgba(15,18,24,.90), rgba(15,18,24,0))',
                backdropFilter: 'blur(10px)',
              }}
            >
              {availableWalls.map((w) => {
                const active = targetWall === w
                return (
                  <button
                    key={w}
                    onClick={() => onTargetWallChange?.(w)}
                    className="btn"
                    style={{
                      flex: 1,
                      minHeight: 38,
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: active ? 'rgba(214,179,106,.18)' : 'rgba(0,0,0,0.12)',
                      border: active ? '1px solid rgba(214,179,106,.35)' : '1px solid rgba(255,255,255,0.12)',
                      fontWeight: 900
                    }}
                  >
                    Zid {w}
                  </button>
                )
              })}
            </div>
            <div className="hint" style={{ fontSize: 12, opacity: 0.75 }}>
              Izaberite zid na koji postavljate element.
            </div>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {subcats.map((s) => {
            const disabled = (isLShape && s === 'Donji' && !lowerUnlocked)
              || (isLShape && s === 'Visoki' && !lowerUnlocked)
              || (isLShape && s === 'Gornji' && !upperUnlocked)
            const active = openSubcat === s

            return (
              <div key={s} style={{ display: 'grid', gap: active ? 10 : 0 }}>
                <button
                  ref={(node) => { subcatButtonRefs.current[s] = node }}
                  onClick={() => {
                    if (disabled) return
                    if (openSubcat === s) {
                      setOpenSubcat(null)
                      return
                    }
                    onSubcatChange(s)
                    setOpenSubcat(s)
                    window.requestAnimationFrame(() => {
                      subcatButtonRefs.current[s]?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                    })
                  }}
                  className={'btn' + (active ? ' primary' : '')}
                  disabled={disabled}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    textAlign: 'left',
                    justifyContent: 'space-between',
                    opacity: disabled ? 0.45 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    position: active ? 'sticky' : 'relative',
                    top: active ? (!isIShape ? WALL_SWITCHER_HEIGHT : 0) : undefined,
                    zIndex: active ? 6 : 1,
                    background: active ? 'linear-gradient(180deg, rgba(214,179,106,.36), rgba(36,28,12,.92))' : undefined,
                    border: active ? '1px solid rgba(214,179,106,.50)' : undefined,
                    boxShadow: active ? '0 10px 24px rgba(0,0,0,.22)' : undefined,
                    backdropFilter: active ? 'blur(12px)' : undefined,
                  }}
                >
                  <span style={{ fontWeight: 900 }}>{subcatLabels[s]}</span>
                  <span className="hint">{disabled ? 'Nedostupno' : active ? 'Klik za zatvaranje' : 'Klik za izbor'}</span>
                </button>

                {active && (
                  loading ? (
                    <div className="hint" style={{ padding: '4px 2px 0' }}>Učitavanje kataloga…</div>
                  ) : filteredByOpenSubcat.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                      {filteredByOpenSubcat.map((it, idx: number) => {
                        const itemKind = getCatalogKind(it)
                        const locked = isLShape
                          ? (isWallKind(itemKind) && !upperUnlocked) || (isBaseOrTallKind(itemKind) && !lowerUnlocked)
                          : false
                        const isPromo = typeof it.promoPrice === 'number' && typeof it.price === 'number' && it.promoPrice < it.price
                        return (
                          <div key={`${it.id}-${idx}`} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
                                minWidth: 0
                              }}
                              onClick={() => { if (!locked) onAddItem?.(it) }}
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
                                  backgroundImage: it.thumbnail ? `url(${it.thumbnail})` : undefined,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }}
                              />
                              <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                                <div style={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                                <div className="hint">{it?.dims?.w}×{it?.dims?.h}×{it?.dims?.d} mm</div>
                                {isPromo ? (
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ textDecoration: 'line-through', fontSize: 13, opacity: 0.5 }}>
                                      {priceFormatter.format(it.price ?? 0)} RSD
                                    </span>
                                    <span style={{ color: 'var(--gold)', fontWeight: 900, fontSize: 16 }}>
                                      {priceFormatter.format(it.promoPrice ?? 0)} RSD
                                    </span>
                                  </div>
                                ) : (
                                  typeof it.price === 'number' && <div style={{ color: 'var(--gold)', fontWeight: 700 }}>{priceFormatter.format(it.price)} RSD</div>
                                )}
                              </div>
                            </button>

                            <button
                              className="btn"
                              style={{
                                minHeight: 44,
                                padding: '10px 12px',
                                borderRadius: 14,
                                fontWeight: 900,
                                whiteSpace: 'nowrap'
                              }}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onCloseDrawer?.()
                                navigate(`/element/${encodeURIComponent(it.id)}`)
                              }}
                            >
                              Detalji
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="hint" style={{ padding: '4px 2px 0' }}>Nema rezultata.</div>
                  )
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

}
