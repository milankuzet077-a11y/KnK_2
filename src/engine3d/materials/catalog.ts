/*
 * Putanja: src/engine3d/materials/catalog.ts
 *
 * Katalog svih tekstura i njihovih pomoćnih mapa.
 * Ovde se za svaki dekor i radnu ploču određuje:
 * - putanja do osnovne slike
 * - putanja do roughness mape
 * - putanja do normal mape
 * - smer goda
 * - realna veličina ploče koju slika simulira
 *
 * Ako želiš da dodaš novi dekor ili promeniš osećaj materijala, prvo se menja ovaj fajl.
 */
export type MaterialFamily = 'solid' | 'wood' | 'stone' | 'marble'

export type TextureSetConfig = {
  // Osnovna slika dekora. Nju korisnik najviše vidi.
  albedo: string
  // Mapa koja određuje koliko je površina mat ili sjajna po delovima.
  roughness?: string
  // Mapa za lažni reljef pod svetlom. Ne menja oblik modela, već samo utisak pod osvetljenjem.
  normal?: string
  // Jačina reljefa iz normal mape.
  normalStrength?: number
  // Osnovna mat/sjaj vrednost materijala kada roughness mapa nije dovoljna sama za sebe.
  roughnessValue?: number
  // Smer goda ili šare. Bitno za pravilno okretanje teksture.
  grain?: 'vertical' | 'horizontal' | 'none'
  // Realna veličina ploče koju ova slika glumi. Od ovoga zavise repeat i isečci teksture.
  sizeMm?: { width: number; height: number }
  family: MaterialFamily
}

// Frontovi koriste ovaj katalog tekstura. Putanje vode ka public/textures/fronts/...
export const FRONT_TEXTURES: Record<string, TextureSetConfig> = {
  Bela: {
    albedo: '/textures/fronts/bela/albedo.jpg', roughness: '/textures/fronts/bela/roughness.jpg', normal: '/textures/fronts/bela/normal.jpg', normalStrength: 0.04, roughnessValue: 0.88, grain: 'none', family: 'solid',
  },
  'Bež': {
    albedo: '/textures/fronts/bez/albedo.jpg', roughness: '/textures/fronts/bez/roughness.jpg', normal: '/textures/fronts/bez/normal.jpg', normalStrength: 0.04, roughnessValue: 0.88, grain: 'none', family: 'solid',
  },
  'Kašmir': {
    albedo: '/textures/fronts/kasmir/albedo.jpg', roughness: '/textures/fronts/kasmir/roughness.jpg', normal: '/textures/fronts/kasmir/normal.jpg', normalStrength: 0.04, roughnessValue: 0.88, grain: 'none', family: 'solid',
  },
  'Siva Dark': {
    albedo: '/textures/fronts/siva-dark/albedo.jpg', roughness: '/textures/fronts/siva-dark/roughness.jpg', normal: '/textures/fronts/siva-dark/normal.jpg', normalStrength: 0.04, roughnessValue: 0.9, grain: 'none', family: 'solid',
  },
  'Siva Light': {
    albedo: '/textures/fronts/siva-light/albedo.jpg', roughness: '/textures/fronts/siva-light/roughness.jpg', normal: '/textures/fronts/siva-light/normal.jpg', normalStrength: 0.04, roughnessValue: 0.88, grain: 'none', family: 'solid',
  },
  Zelena: {
    albedo: '/textures/fronts/zelena/albedo.jpg', roughness: '/textures/fronts/zelena/roughness.jpg', normal: '/textures/fronts/zelena/normal.jpg', normalStrength: 0.04, roughnessValue: 0.89, grain: 'none', family: 'solid',
  },
  Hrast: {
    albedo: '/textures/fronts/hrast/albedo.jpg', roughness: '/textures/fronts/hrast/roughness.jpg', normal: '/textures/fronts/hrast/normal.jpg', normalStrength: 0.24, roughnessValue: 0.62, grain: 'vertical', sizeMm: { width: 1300, height: 2800 }, family: 'wood',
  },
  Orah: {
    albedo: '/textures/fronts/orah/albedo.jpg', roughness: '/textures/fronts/orah/roughness.jpg', normal: '/textures/fronts/orah/normal.jpg', normalStrength: 0.22, roughnessValue: 0.64, grain: 'vertical', sizeMm: { width: 1300, height: 2800 }, family: 'wood',
  },
}

// Radne ploče koriste ovaj katalog tekstura. Putanje vode ka public/textures/worktops/...
export const WORKTOP_TEXTURES: Record<string, TextureSetConfig> = {
  'Mermer Beli': {
    albedo: '/textures/worktops/mermer-beli/albedo.jpg', roughness: '/textures/worktops/mermer-beli/roughness.jpg', normal: '/textures/worktops/mermer-beli/normal.jpg', normalStrength: 0.18, roughnessValue: 0.2, grain: 'horizontal', sizeMm: { width: 2800, height: 1300 }, family: 'marble',
  },
  'Kamen Bež': {
    albedo: '/textures/worktops/kamen-bez/albedo.jpg', roughness: '/textures/worktops/kamen-bez/roughness.jpg', normal: '/textures/worktops/kamen-bez/normal.jpg', normalStrength: 0.22, roughnessValue: 1.5, grain: 'horizontal', sizeMm: { width: 2800, height: 1300 }, family: 'stone',
  },
  'Kamen Crni': {
    albedo: '/textures/worktops/kamen-crni/albedo.jpg', roughness: '/textures/worktops/kamen-crni/roughness.jpg', normal: '/textures/worktops/kamen-crni/normal.jpg', normalStrength: 0.2, roughnessValue: 1.5, grain: 'horizontal', sizeMm: { width: 2800, height: 1300 }, family: 'stone',
  },
  Hrast: {
    albedo: '/textures/worktops/hrast/albedo.jpg', roughness: '/textures/worktops/hrast/roughness.jpg', normal: '/textures/worktops/hrast/normal.jpg', normalStrength: 0.26, roughnessValue: 0.72, grain: 'horizontal', sizeMm: { width: 2800, height: 1300 }, family: 'wood',
  },
  Orah: {
    albedo: '/textures/worktops/orah/albedo.jpg', roughness: '/textures/worktops/orah/roughness.jpg', normal: '/textures/worktops/orah/normal.jpg', normalStrength: 0.24, roughnessValue: 0.74, grain: 'horizontal', sizeMm: { width: 2800, height: 1300 }, family: 'wood',
  },
}

export function getFrontTextureConfig(decor?: string | null): TextureSetConfig | null {
  if (!decor) return null
  return FRONT_TEXTURES[decor] ?? null
}

export function getWorktopTextureConfig(worktop?: string | null): TextureSetConfig | null {
  if (!worktop || worktop === 'Bez Radne ploče') return null
  return WORKTOP_TEXTURES[worktop] ?? null
}
