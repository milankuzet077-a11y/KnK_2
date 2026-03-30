import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { CatalogElement } from '../domain/catalog/catalogTypes'
import { loadAllCatalogs } from '../domain/catalog/loadCatalogs'
import { useMediaQuery } from './useMediaQuery'

type ElementDetailsJson = {
  id?: string
  title?: string
  code?: string
  description?: string
  dimensions?: { w?: number; h?: number; d?: number }
  images?: {
    hero?: string // npr "hero.webp"
    gallery?: string[] // npr ["g1.webp", "g2.webp"]
  }
  specs?: Record<string, string | number | boolean | null | undefined>
}

const DETAILS_GROUPS = ['base', 'wall', 'tall', 'corner'] as const

/**
 * Stranica sa detaljima elementa.
 * - Skrol radi i na mobilnom (body je fixed/overflow hidden, pa skrol ide u ovom containeru)
 * - "Nazad" vodi na konfigurator bez resetovanja scene
 * - Detalji se učitavaju iz: public/details/<group>/<id>/details.json
 */
export function ElementDetailsPage() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const elementId = params.id

  const isNarrow = useMediaQuery('(max-width: 900px)')

  const [loading, setLoading] = React.useState(true)
  const [item, setItem] = React.useState<CatalogElement | null>(null)

  const [detailsLoading, setDetailsLoading] = React.useState(false)
  const [details, setDetails] = React.useState<ElementDetailsJson | null>(null)
  const [detailsGroup, setDetailsGroup] = React.useState<(typeof DETAILS_GROUPS)[number] | null>(null)

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const { items } = await loadAllCatalogs()
        if (!alive) return
        const found = items.find((x) => x.id === elementId) ?? null
        setItem(found)
      } catch {
        if (!alive) return
        setItem(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [elementId])

  const safeId = elementId ? encodeURIComponent(elementId) : ''
  const detailsBasePath = detailsGroup && safeId ? `/details/${detailsGroup}/${safeId}` : ''

  const title = details?.title ?? item?.name ?? 'Detalji elementa'
  const code = details?.code
  const desc = details?.description

  const dimsW = details?.dimensions?.w ?? item?.dims?.w
  const dimsH = details?.dimensions?.h ?? item?.dims?.h
  const dimsD = details?.dimensions?.d ?? item?.dims?.d

  const heroUrl = details?.images?.hero && detailsBasePath ? `${detailsBasePath}/${details.images.hero}` : item?.thumbnail
  const galleryUrls =
    details?.images?.gallery && detailsBasePath ? details.images.gallery.map((f) => `${detailsBasePath}/${f}`) : []

  // Lightbox / galerija
  const allImages = React.useMemo(() => {
    const arr: string[] = []
    if (heroUrl) arr.push(heroUrl)
    for (const u of galleryUrls) {
      if (u && u !== heroUrl) arr.push(u)
    }
    return arr
  }, [heroUrl, galleryUrls])

  const [lightboxOpen, setLightboxOpen] = React.useState(false)
  const [lightboxIndex, setLightboxIndex] = React.useState(0)

  const openLightbox = React.useCallback(
    (index: number) => {
      if (!allImages.length) return
      const safeIndex = Math.max(0, Math.min(index, allImages.length - 1))
      setLightboxIndex(safeIndex)
      setLightboxOpen(true)
    },
    [allImages.length]
  )

  const closeLightbox = React.useCallback(() => setLightboxOpen(false), [])

  const prevImage = React.useCallback(() => {
    if (!allImages.length) return
    setLightboxIndex((i) => (i - 1 + allImages.length) % allImages.length)
  }, [allImages.length])

  const nextImage = React.useCallback(() => {
    if (!allImages.length) return
    setLightboxIndex((i) => (i + 1) % allImages.length)
  }, [allImages.length])

  // Ucitavanje detalja iz public/details/<group>/<id>/details.json
  React.useEffect(() => {
    let alive = true

    if (!elementId) {
      setDetails(null)
      setDetailsGroup(null)
      return () => {
        alive = false
      }
    }

    ;(async () => {
      try {
        setDetailsLoading(true)
        setDetails(null)
        setDetailsGroup(null)

        for (const group of DETAILS_GROUPS) {
          const url = `/details/${group}/${safeId}/details.json`
          try {
            const res = await fetch(url, { cache: 'no-store' })
            if (!alive) return
            if (!res.ok) continue

            const data = (await res.json()) as ElementDetailsJson
            if (!alive) return

            setDetails(data ?? null)
            setDetailsGroup(group)
            return
          } catch {
            // probaj sledeci folder
          }
        }
      } finally {
        if (alive) setDetailsLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [elementId, safeId])

  return (
    <div
      className="fullscreen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0b0f14',
        color: 'white',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* LIGHTBOX */}
      {lightboxOpen ? (
        <Lightbox
          images={allImages}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevImage}
          onNext={nextImage}
        />
      ) : null}

      {/* HEADER */}
      <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto', width: '100%', flex: '0 0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="btn"
            style={{ borderRadius: 14, padding: '10px 12px', fontWeight: 900 }}
            onClick={() => {
              if (window.history.length > 1) navigate(-1)
              else navigate('/', { replace: true })
            }}
          >
            ← Povratak u konfigurator
          </button>
          <div className="hint" style={{ opacity: 0.75 }}>
            Detalji elementa (<span style={{ color: 'var(--gold)', fontWeight: 900 }}>/element/:id</span>)
          </div>
        </div>
      </div>

      {/* SCROLL AREA */}
      <div
        style={{
          flex: '1 1 auto',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: 16
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div className="glass" style={{ borderRadius: 18, padding: 14 }}>
            {/*
              Prvo pokušavamo da nađemo element u katalogu, ali detalji mogu postojati i ako element
              nije (ili još nije) upisan u katalog.
              Zato prikazujemo "nije pronađen" tek ako NEMA ni katalog item-a ni details.json.
            */}
            {loading && !details ? (
              <div className="hint">Učitavam…</div>
            ) : !item && !details && !detailsLoading ? (
              <div>
                <div style={{ fontWeight: 1000, fontSize: 18 }}>Element nije pronađen</div>
                <div className="hint" style={{ marginTop: 6 }}>
                  ID: <span style={{ color: 'var(--gold)', fontWeight: 900 }}>{elementId ?? '—'}</span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isNarrow ? '1fr' : '1.1fr 0.9fr',
                  gap: 14
                }}
              >
                {/* LEVO: galerija */}
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ fontWeight: 1000, fontSize: 18 }}>{title}</div>
                  <div className="hint">
                    {dimsW}×{dimsH}×{dimsD} mm
                    {typeof item?.price === 'number' ? <> · {new Intl.NumberFormat('sr-RS').format(item.price)} RSD</> : null}
                    {detailsLoading ? <span style={{ marginLeft: 10, opacity: 0.7 }}>· učitavam detalje…</span> : null}
                    {code ? <span style={{ marginLeft: 10, opacity: 0.85 }}>· {code}</span> : null}
                  </div>

                  <div
                    className="glass"
                    style={{
                      borderRadius: 18,
                      padding: 12,
                      aspectRatio: '3 / 4',
                      width: '100%',
                      backgroundImage: heroUrl ? `url(${heroUrl})` : undefined,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      cursor: heroUrl ? 'pointer' : 'default'
                    }}
                    role={heroUrl ? 'button' : undefined}
                    tabIndex={heroUrl ? 0 : undefined}
                    aria-label={heroUrl ? 'Otvori galeriju' : undefined}
                    onClick={() => (heroUrl ? openLightbox(0) : null)}
                    onKeyDown={(e) => {
                      if (!heroUrl) return
                      if (e.key === 'Enter' || e.key === ' ') openLightbox(0)
                    }}
                  >
                    {!heroUrl ? (
                      <div className="hint">
                        Dodaj: public/details/&lt;base|wall|tall|corner&gt;/{elementId}/details.json i hero.webp
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isNarrow ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                      gap: 10
                    }}
                  >
                    {(galleryUrls.length ? galleryUrls.slice(0, 6) : [null, null, null]).map((url, i) => (
                      <div
                        key={i}
                        className="glass"
                        style={{
                          borderRadius: 16,
                          padding: 10,
                          aspectRatio: '3 / 4',
                          width: '100%',
                          backgroundImage: url ? `url(${url})` : undefined,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          cursor: url ? 'pointer' : 'default'
                        }}
                        role={url ? 'button' : undefined}
                        tabIndex={url ? 0 : undefined}
                        aria-label={url ? `Otvori sliku ${i + 1}` : undefined}
                        onClick={() => {
                          if (!url) return
                          const idx = allImages.findIndex((x) => x === url)
                          openLightbox(idx >= 0 ? idx : 0)
                        }}
                        onKeyDown={(e) => {
                          if (!url) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            const idx = allImages.findIndex((x) => x === url)
                            openLightbox(idx >= 0 ? idx : 0)
                          }
                        }}
                      >
                        {!url ? <div className="hint">Galerija #{i + 1}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>

                {/* DESNO: informacije */}
                <div style={{ display: 'grid', gap: 12 }}>
                  <div className="glass" style={{ borderRadius: 18, padding: 12 }}>
                    <div style={{ fontWeight: 1000 }}>Opšte informacije</div>
                    <div className="hint" style={{ marginTop: 8, lineHeight: 1.5 }}>
                      {desc
                        ? desc
                        : 'Dodaj opis u details.json (polje: description).'}
                    </div>
                    {detailsGroup ? (
                      <div className="hint" style={{ marginTop: 10, opacity: 0.7 }}>
                        Putanja: public/details/{detailsGroup}/{elementId}/details.json
                      </div>
                    ) : null}
                  </div>

                  <div className="glass" style={{ borderRadius: 18, padding: 12 }}>
                    <div style={{ fontWeight: 1000 }}>Tehnički podaci</div>
                    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                      <Row label="ID" value={item?.id ?? '—'} />
                      <Row label="SKU" value={item?.sku ?? '—'} />
                      <Row label="Kod" value={code ?? '—'} />
                      <Row label="Tip" value={item?.type ?? '—'} />
                      <Row label="Dimenzije" value={`${dimsW}×${dimsH}×${dimsD} mm`} />
                      <Row
                        label="Cena"
                        value={typeof item?.price === 'number' ? `${new Intl.NumberFormat('sr-RS').format(item.price)} RSD` : '—'}
                      />
                      <Row label="GLB" value={item?.glb ?? '—'} />

                      {details?.specs
                        ? Object.entries(details.specs).map(([k, v]) => (
                            <Row key={k} label={k} value={v === null || v === undefined ? '—' : String(v)} />
                          ))
                        : null}
                    </div>
                  </div>

                  <div className="glass" style={{ borderRadius: 18, padding: 12 }}>
                    <div style={{ fontWeight: 1000 }}>Dokumentacija</div>
                    <div className="hint" style={{ marginTop: 8 }}>
                      Možeš dodati PDF (uputstvo), linkove, preuzimanja, itd.
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="btn" style={{ borderRadius: 14, padding: '10px 12px', fontWeight: 900 }} disabled>
                        PDF (uskoro)
                      </button>
                      <button className="btn" style={{ borderRadius: 14, padding: '10px 12px', fontWeight: 900 }} disabled>
                        Slike (uskoro)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ height: 24 }} />
        </div>
      </div>
    </div>
  )
}

function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext
}: {
  images: string[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const [touchStartX, setTouchStartX] = React.useState<number | null>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  const current = images[index]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.86)',
        display: 'grid',
        placeItems: 'center',
        padding: 16
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Galerija slika"
      onClick={(e) => {
        // klik van slike zatvara
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="glass"
        style={{
          width: 'min(600px, 100%)', // <--- SMANJENO SA 1100px na 600px
          borderRadius: 18,
          padding: 12,
          display: 'grid',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div className="hint" style={{ opacity: 0.8 }}>
            {index + 1} / {images.length}
          </div>
          <button className="btn" style={{ borderRadius: 14, padding: '10px 12px', fontWeight: 900 }} onClick={onClose}>
            ✕ Zatvori
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center',
            gap: 10
          }}
        >
          <button
            className="btn"
            style={{ borderRadius: 16, padding: '12px 14px', fontWeight: 1000 }}
            onClick={onPrev}
            aria-label="Prethodna slika"
          >
            ‹
          </button>

          <div
            style={{
              width: '100%',
              aspectRatio: '3 / 4',
              maxHeight: '75vh',
              borderRadius: 16,
              backgroundImage: current ? `url(${current})` : undefined,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundColor: 'rgba(255,255,255,0.04)'
            }}
            onTouchStart={(e) => setTouchStartX(e.touches?.[0]?.clientX ?? null)}
            onTouchEnd={(e) => {
              const start = touchStartX
              const end = e.changedTouches?.[0]?.clientX
              setTouchStartX(null)
              if (start == null || end == null) return
              const dx = end - start
              if (Math.abs(dx) < 35) return
              if (dx > 0) onPrev()
              else onNext()
            }}
          />

          <button
            className="btn"
            style={{ borderRadius: 16, padding: '12px 14px', fontWeight: 1000 }}
            onClick={onNext}
            aria-label="Sledeća slika"
          >
            ›
          </button>
        </div>

        <div className="hint" style={{ opacity: 0.75, textAlign: 'center' }}>
          Tipke: Esc (zatvori), ←/→ (listaj). Na telefonu: prevuci levo/desno.
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
      <div className="hint" style={{ opacity: 0.75 }}>{label}</div>
      <div style={{ fontWeight: 900, textAlign: 'right', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}