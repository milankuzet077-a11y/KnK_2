export type OptionTabId =
  | 'worktop'
  | 'decor'
  | 'handles'
  | 'sink'

export type OptionTab = OptionTabId | null

export type OptionsValues = Record<OptionTabId, string>
