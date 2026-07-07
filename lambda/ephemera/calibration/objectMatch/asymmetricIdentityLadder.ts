/**
 * Asymmetric identity ladder: thin objectSpan (query) vs rich catalog index text (document).
 * Exploration only; does not lock production shortName-only thresholds.
 */

export const ASYMMETRIC_IDENTITY_LADDER_ID = 'asymmetric-identity-ladder-v1' as const

export type CatalogIndexComposition = 'shortName' | 'shortNamePlusDescription' | 'descriptionOnly'

export const CATALOG_INDEX_COMPOSITIONS: readonly CatalogIndexComposition[] = [
    'shortName',
    'shortNamePlusDescription',
    'descriptionOnly',
]

export const DEFAULT_CATALOG_INDEX_COMPOSITION: CatalogIndexComposition = 'shortNamePlusDescription'

export type AsymmetricIdentityTier =
    | 'identity-positive-exact'
    | 'identity-positive-paraphrase'
    | 'synonym-without-shared-tokens'
    | 'thematic-neighbor'
    | 'hard-negative'
    | 'identity-absent-object'
    | 'unrelated'

/** Closest-first order for exploratory monotonicity checks on tier medians. */
export const ASYMMETRIC_IDENTITY_TIER_ORDER: readonly AsymmetricIdentityTier[] = [
    'identity-positive-exact',
    'identity-positive-paraphrase',
    'synonym-without-shared-tokens',
    'thematic-neighbor',
    'hard-negative',
    'identity-absent-object',
    'unrelated',
]

export type AsymmetricIdentityLadderCase = {
    id: string
    tier: AsymmetricIdentityTier
    span: string
    catalogShortName: string
    description: string
    symmetricBaselinePairId?: string
    compositionStudy?: boolean
    notes?: string
}

/** Trim only; do not apply exit-name normalization to catalog prose. */
export const normalizeCatalogIndexTextForEmbedding = (text: string): string => text.trim()

export const buildCatalogIndexText = (
    composition: CatalogIndexComposition,
    catalogShortName: string,
    description: string
): string => {
    const shortName = catalogShortName.trim()
    const prose = description.trim()
    switch (composition) {
        case 'shortName':
            return shortName
        case 'descriptionOnly':
            return prose
        case 'shortNamePlusDescription':
            return prose.length > 0 ? `${shortName}. ${prose}` : shortName
    }
}

export const ASYMMETRIC_IDENTITY_LADDER_CASES: readonly AsymmetricIdentityLadderCase[] = [
    {
        id: 'asym-001-exact-broom',
        tier: 'identity-positive-exact',
        span: 'broom',
        catalogShortName: 'broom',
        description:
            'A straw cleaning implement with a long handle, used for sweeping floors and dust.',
        notes: 'Span matches catalog shortName; enriched index should stay high.',
    },
    {
        id: 'asym-002-exact-lantern',
        tier: 'identity-positive-exact',
        span: 'lantern',
        catalogShortName: 'lantern',
        description:
            'A portable oil lamp with glass panels, giving warm light in dark spaces.',
    },
    {
        id: 'asym-010-paraphrase-broom',
        tier: 'identity-positive-paraphrase',
        span: 'sweeping tool',
        catalogShortName: 'broom',
        description:
            'A straw cleaning implement with a long handle, used for sweeping floors and dust.',
        symmetricBaselinePairId: 'ladder-020-tight-broom',
        notes: 'Canonical paraphrase; primary uplift target vs symmetric shortName baseline.',
        compositionStudy: true,
    },
    {
        id: 'asym-011-paraphrase-travel-bag',
        tier: 'identity-positive-paraphrase',
        span: 'travel bag',
        catalogShortName: 'satchel',
        description: 'A leather shoulder bag sized for journey gear and personal effects.',
        symmetricBaselinePairId: 'ladder-021-tight-satchel-bag',
    },
    {
        id: 'asym-020-synonym-blade-rapier',
        tier: 'synonym-without-shared-tokens',
        span: 'blade',
        catalogShortName: 'ornate rapier',
        description:
            'An elegant narrow sword with a decorated guard, favored by duelists.',
        symmetricBaselinePairId: 'ladder-031-loose-blade',
        notes: 'Unary-trap family; enriched text may help or inflate false resolve.',
    },
    {
        id: 'asym-030-neighbor-anvil-hammer',
        tier: 'thematic-neighbor',
        span: 'anvil',
        catalogShortName: 'hammer',
        description:
            'A metal-headed striking tool for nails, forging, and workshop metalwork.',
        symmetricBaselinePairId: 'ladder-050-neighbor-anvil-hammer',
        compositionStudy: true,
    },
    {
        id: 'asym-031-neighbor-broom-lantern',
        tier: 'thematic-neighbor',
        span: 'broom',
        catalogShortName: 'lantern',
        description:
            'A portable oil lamp with glass panels, giving warm light in dark spaces.',
        symmetricBaselinePairId: 'ladder-051-neighbor-broom-lantern',
    },
    {
        id: 'asym-040-hard-negative-broom-lantern',
        tier: 'hard-negative',
        span: 'broom',
        catalogShortName: 'lantern',
        description:
            'A portable oil lamp with glass panels, giving warm light in dark spaces.',
        notes: 'Distinct objects; span names broom but catalog entry is lantern.',
    },
    {
        id: 'asym-041-hard-negative-sweeping-tool-lantern',
        tier: 'hard-negative',
        span: 'sweeping tool',
        catalogShortName: 'lantern',
        description:
            'A portable oil lamp with glass panels, giving warm light in dark spaces.',
        notes: 'Paraphrase-like span with no matching object in catalog.',
    },
    {
        id: 'asym-050-absent-sword-vs-broom',
        tier: 'identity-absent-object',
        span: 'sword',
        catalogShortName: 'broom',
        description:
            'A straw cleaning implement with a long handle, used for sweeping floors and dust.',
        symmetricBaselinePairId: 'ladder-062-unrelated-broom-sword',
        notes: 'Absent-object guard: sword span against wrong enriched catalog entry.',
        compositionStudy: true,
    },
    {
        id: 'asym-051-absent-sword-vs-anvil',
        tier: 'identity-absent-object',
        span: 'sword',
        catalogShortName: 'anvil',
        description:
            'A heavy iron block in the workshop, used for metalwork and hammering.',
        symmetricBaselinePairId: 'ladder-061-unrelated-sword-anvil',
    },
    {
        id: 'asym-060-unrelated-bag-lantern',
        tier: 'unrelated',
        span: 'bag',
        catalogShortName: 'lantern',
        description:
            'A portable oil lamp with glass panels, giving warm light in dark spaces.',
        symmetricBaselinePairId: 'ladder-060-unrelated-bag-lantern',
    },
    {
        id: 'asym-061-unrelated-sword-anvil',
        tier: 'unrelated',
        span: 'sword',
        catalogShortName: 'anvil',
        description:
            'A heavy iron block in the workshop, used for metalwork and hammering.',
        symmetricBaselinePairId: 'ladder-061-unrelated-sword-anvil',
    },
]

export function filterAsymmetricLadderCasesByTier(
    tier?: AsymmetricIdentityTier
): readonly AsymmetricIdentityLadderCase[] {
    if (tier === undefined) {
        return ASYMMETRIC_IDENTITY_LADDER_CASES
    }
    return ASYMMETRIC_IDENTITY_LADDER_CASES.filter((entry) => entry.tier === tier)
}
