import type { OptionTab, OptionTabId, OptionsValues } from './types'

export type OptionItemDef = {
  value: string
  title: string
  image: string
  priceText?: string
  details?: string
  isSimpleOption?: boolean
}

export type OptionTabDef = {
  id: OptionTabId
  title: string
  items: OptionItemDef[]
  disabled?: (values: OptionsValues) => boolean
  disabledHint?: string
}

function createPlaceholderImage(title: string, subtitle: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2d3440"/>
          <stop offset="100%" stop-color="#13171d"/>
        </linearGradient>
      </defs>
      <rect width="320" height="320" rx="28" fill="url(#g)"/>
      <rect x="20" y="20" width="280" height="280" rx="22" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.12)"/>
      <text x="160" y="138" text-anchor="middle" fill="#d6b36a" font-family="Arial, sans-serif" font-size="24" font-weight="700">${title}</text>
      <text x="160" y="178" text-anchor="middle" fill="rgba(255,255,255,.82)" font-family="Arial, sans-serif" font-size="18">${subtitle}</text>
    </svg>
  `.trim()

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const DEFAULT_OPTIONS: OptionsValues = {
  worktop: 'Bez Radne ploče',
  decor: 'Bela',
  handles: 'Crna',
  sink: 'Okrugla',
}

export const OPTION_TABS: OptionTabDef[] = [
  {
    id: 'worktop',
    title: 'Radna Ploča',
    items: [
      {
        value: 'Bez Radne ploče',
        title: 'Bez Radne ploče',
        image: createPlaceholderImage('Radna ploča', 'Bez ugradnje'),
        details: 'Opcija bez radne ploče. Ako je izaberete, radna ploča se uklanja iz konfiguracije.',
        isSimpleOption: true,
      },
      {
        value: 'Mermer Beli',
        title: 'Mermer Beli',
        image: '/textures/worktops/mermer-beli/albedo.jpg',
        priceText: 'Cena na upit',
        details: 'Dekor radne ploče: Mermer Beli.',
      },
      {
        value: 'Kamen Bež',
        title: 'Kamen Bež',
        image: '/textures/worktops/kamen-bez/albedo.jpg',
        priceText: 'Cena na upit',
        details: 'Dekor radne ploče: Kamen Bež.',
      },
      {
        value: 'Kamen Crni',
        title: 'Kamen Crni',
        image: '/textures/worktops/kamen-crni/albedo.jpg',
        priceText: 'Cena na upit',
        details: 'Dekor radne ploče: Kamen Crni.',
      },
      {
        value: 'Hrast',
        title: 'Hrast',
        image: '/textures/worktops/hrast/albedo.jpg',
        priceText: 'Cena na upit',
        details: 'Dekor radne ploče: Hrast.',
      },
      {
        value: 'Orah',
        title: 'Orah',
        image: '/textures/worktops/orah/albedo.jpg',
        priceText: 'Cena na upit',
        details: 'Dekor radne ploče: Orah.',
      },
    ],
  },
  {
    id: 'decor',
    title: 'Dekor',
    items: [
      {
        value: 'Bela',
        title: 'Bela',
        image: '/textures/decor/Bela.jpg',
        details: 'Dekor frontova: Bela.',
      },
      {
        value: 'Bež',
        title: 'Bež',
        image: '/textures/decor/Bez.jpg',
        details: 'Dekor frontova: Bež.',
      },
      {
        value: 'Kašmir',
        title: 'Kašmir',
        image: '/textures/decor/Kasmir.jpg',
        details: 'Dekor frontova: Kašmir.',
      },
      {
        value: 'Siva Light',
        title: 'Siva Light',
        image: '/textures/decor/Siva Light.jpg',
        details: 'Dekor frontova: Siva Light.',
      },
      {
        value: 'Siva Dark',
        title: 'Siva Dark',
        image: '/textures/decor/Siva Dark.jpg',
        details: 'Dekor frontova: Siva Dark.',
      },
      {
        value: 'Zelena',
        title: 'Zelena',
        image: '/textures/decor/Zelena.jpg',
        details: 'Dekor frontova: Zelena.',
      },
      {
        value: 'Hrast',
        title: 'Hrast',
        image: '/textures/decor/Hrast.jpg',
        details: 'Dekor frontova: Hrast.',
      },
      {
        value: 'Orah',
        title: 'Orah',
        image: '/textures/decor/Orah.jpg',
        details: 'Dekor frontova: Orah.',
      },
    ],
  },
  {
    id: 'handles',
    title: 'Ručice i Cokla',
    items: [
      {
        value: 'Crna',
        title: 'Crna',
        image: createPlaceholderImage('Ručice i cokla', 'Crna završna obrada'),
        details: 'Završna obrada ručica i cokle: Crna.',
      },
      {
        value: 'Siva',
        title: 'Siva',
        image: createPlaceholderImage('Ručice i cokla', 'Siva završna obrada'),
        details: 'Završna obrada ručica i cokle: Siva.',
      },
    ],
  },
  {
    id: 'sink',
    title: 'Sudopera',
    items: [
      {
        value: 'Bez Sudopere',
        title: 'Bez Sudopere',
        image: createPlaceholderImage('Sudopera', 'Bez ugradnje'),
        details: 'Opcija bez sudopere. Ako je izaberete, sudopera se uklanja iz konfiguracije.',
        isSimpleOption: true,
      },
      {
        value: 'Okrugla',
        title: 'Okrugla',
        image: createPlaceholderImage('Sudopera', 'Okrugla'),
        priceText: 'Cena na upit',
        details: 'Model sudopere: Okrugla.',
      },
      {
        value: 'Kocka',
        title: 'Kocka',
        image: createPlaceholderImage('Sudopera', 'Kocka'),
        priceText: 'Cena na upit',
        details: 'Model sudopere: Kocka.',
      },
      {
        value: 'Pravougaonik',
        title: 'Pravougaonik',
        image: createPlaceholderImage('Sudopera', 'Pravougaonik'),
        priceText: 'Cena na upit',
        details: 'Model sudopere: Pravougaonik.',
      },
    ],
  },
]

export function normalizeActiveTab(tab: OptionTab, values: OptionsValues): OptionTab {
  if (!tab) return null
  const def = OPTION_TABS.find((t) => t.id === tab)
  if (!def) return null
  const isDisabled = def.disabled?.(values) ?? false
  if (isDisabled) return null
  return tab
}
