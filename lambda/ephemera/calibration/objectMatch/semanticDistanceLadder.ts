/**
 * Semantic distance ladder for embedding exploration (not identity threshold lock).
 * Ordered tiers from closest to farthest expected semantic relation.
 */

export const SEMANTIC_DISTANCE_LADDER_ID = 'semantic-distance-ladder-v1' as const

export type SemanticDistanceTier =
    | 'exact'
    | 'inflection'
    | 'tight-paraphrase'
    | 'loose-synonym'
    | 'hypernym-hyponym'
    | 'thematic-neighbor'
    | 'unrelated'

export type SemanticDistanceLadderPair = {
    id: string
    tier: SemanticDistanceTier
    left: string
    right: string
    notes?: string
}

/** Closest-first order for monotonicity checks on tier medians. */
export const SEMANTIC_DISTANCE_TIER_ORDER: readonly SemanticDistanceTier[] = [
    'exact',
    'inflection',
    'tight-paraphrase',
    'loose-synonym',
    'hypernym-hyponym',
    'thematic-neighbor',
    'unrelated',
]

export const SEMANTIC_DISTANCE_LADDER_PAIRS: readonly SemanticDistanceLadderPair[] = [
    {
        id: 'ladder-001-exact-lantern',
        tier: 'exact',
        left: 'lantern',
        right: 'lantern',
        notes: 'Baseline; same normalized text (embed cache returns one vector per invoke).',
    },
    {
        id: 'ladder-002-exact-bag',
        tier: 'exact',
        left: 'bag',
        right: 'bag',
    },
    {
        id: 'ladder-010-inflection-bags',
        tier: 'inflection',
        left: 'bag',
        right: 'bags',
        notes: 'Morphological variant; shared stem.',
    },
    {
        id: 'ladder-011-inflection-swords',
        tier: 'inflection',
        left: 'sword',
        right: 'swords',
    },
    {
        id: 'ladder-020-tight-broom',
        tier: 'tight-paraphrase',
        left: 'broom',
        right: 'sweeping tool',
        notes: 'Canonical identity corpus paraphrase.',
    },
    {
        id: 'ladder-021-tight-satchel-bag',
        tier: 'tight-paraphrase',
        left: 'satchel',
        right: 'travel bag',
        notes: 'Near paraphrase with partial lexical overlap.',
    },
    {
        id: 'ladder-030-loose-sack',
        tier: 'loose-synonym',
        left: 'bag',
        right: 'sack',
        notes: 'Synonym without inflection overlap.',
    },
    {
        id: 'ladder-031-loose-blade',
        tier: 'loose-synonym',
        left: 'sword',
        right: 'blade',
    },
    {
        id: 'ladder-040-hypernym-rapier',
        tier: 'hypernym-hyponym',
        left: 'sword',
        right: 'ornate rapier',
        notes: 'Identity corpus unary-trap pair.',
    },
    {
        id: 'ladder-041-hypernym-hammer',
        tier: 'hypernym-hyponym',
        left: 'tool',
        right: 'hammer',
    },
    {
        id: 'ladder-050-neighbor-anvil-hammer',
        tier: 'thematic-neighbor',
        left: 'anvil',
        right: 'hammer',
        notes: 'Workshop-adjacent; identity hard-negative pair.',
    },
    {
        id: 'ladder-051-neighbor-broom-lantern',
        tier: 'thematic-neighbor',
        left: 'broom',
        right: 'lantern',
    },
    {
        id: 'ladder-060-unrelated-bag-lantern',
        tier: 'unrelated',
        left: 'bag',
        right: 'lantern',
    },
    {
        id: 'ladder-061-unrelated-sword-anvil',
        tier: 'unrelated',
        left: 'sword',
        right: 'anvil',
    },
    {
        id: 'ladder-062-unrelated-broom-sword',
        tier: 'unrelated',
        left: 'broom',
        right: 'sword',
    },
]

export function filterLadderPairsByTier(
    tier?: SemanticDistanceTier
): readonly SemanticDistanceLadderPair[] {
    if (tier === undefined) {
        return SEMANTIC_DISTANCE_LADDER_PAIRS
    }
    return SEMANTIC_DISTANCE_LADDER_PAIRS.filter((entry) => entry.tier === tier)
}
