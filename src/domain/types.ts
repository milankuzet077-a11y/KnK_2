export type KitchenShape = 'straight' | 'parallel' | 'l-shape'

// Jedinstveni skup zidova koje aplikacija trenutno koristi kroz UI i backend.
// (Walls tip i dalje može imati i D zbog kompatibilnosti, ali WallKey ne izlaže D dok ne bude implementiran.)
export type WallKey = 'A' | 'B' | 'C'

export type Walls = {
  A?: number
  B?: number
  C?: number
  D?: number
}

// Element koji je postavljen u scenu
export type PlacedItem = {
  uniqueId: string      
  catalogId: string     
  elementId: string     
  width: number         
  depth: number         
  mountingHeight?: number 
  /**
   * Opcioni identifikator zida (A/B/C). Postojece stanje u storage-u moze da ga nema,
   * pa mora da bude optional.
   */
  wallKey?: WallKey
  
  // Opcioni meta podaci (koristi UI za prikaz ukupne cene i corner pravila)
  price?: number
  category?: string
  cornerHandedness?: 'left' | 'right'
  decor?: string
  supportRole?: 'base' | 'wall'
  supportSourceCatalogId?: string
  worktopMeta?: {
    armAmm: number
    armBmm: number
    extraCoverMm: number
  }
  glbUrl?: string

  // NOVO: Pamtimo tacnu poziciju elementa (mm od leve ivice)
  x: number 
}

// ------------------------------
// Backend placement contract (uskoro izvor istine)
// ------------------------------

export type LayoutState = {
  shape: KitchenShape
  walls: Walls
  items: PlacedItem[]
}

export type PlacementCandidate = {
  catalogId: string
  elementId: string
  /**
   * Ako UI zeli da forsira zid, prosledi wallKey.
   * Ako nije prosledjeno, backend moze da auto-odabere.
   */
  wallKey?: WallKey
  /**
   * Zeljena pozicija u mm od "leve" ivice zida.
   * Ako nije prosledjeno, backend moze da auto-pozicionira.
   */
  x?: number
}

export type ValidateAndPlaceRequest = {
  layout: LayoutState
  candidate: PlacementCandidate
  /**
   * Opcionalni klijent request id (za idempotency na backendu).
   */
  requestId?: string
}

export type PlacementFailureCode =
  | 'WALL_TOO_SHORT'
  | 'NOT_ENOUGH_SPACE'
  | 'OVERLAP'
  | 'INVALID_WALL'
  | 'INVALID_DIMENSIONS'
  | 'CORNER_CONFLICT'
  | 'UNSUPPORTED_SHAPE'
  | 'UNKNOWN'

export type ValidateAndPlaceResponse =
  | {
      ok: true
      placed: PlacedItem
      warnings?: string[]
    }
  | {
      ok: false
      code: PlacementFailureCode
      message: string
      details?: Record<string, unknown>
    }