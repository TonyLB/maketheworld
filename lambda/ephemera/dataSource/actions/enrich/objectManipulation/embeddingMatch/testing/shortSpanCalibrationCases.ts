import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { normalizeShortNameForEmbedding } from '../../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

import type { EmbeddingMatchCandidate } from '../types'

import type { ShortSpanPoolVectorPlan } from './mockVectors'

export type ShortSpanLexicalCase = {
    id: string
    span: string
    catalog: readonly string[]
    notes?: string
    /** When set, head catalog entry must rank above this shortName on lexical relevance. */
    expectHeadAbove?: string
}

/**
 * Pool fixture intent for FT-1.3.1 retirement harness (gate-off / alwaysActive target).
 *
 * - spurious-diverse-catalog: length-1 (or similar) vs many unrelated entries; joint head must
 *   stay below FT-5 floor with lexical always on --- substring false-positive guard.
 * - shorthand-unary: legitimate prefix shorthand vs one (or few) catalog entries; ranking the
 *   intended object highly (and clearing the floor) is desired, not a regression.
 * - ordering-invariant: geometry / rank order checks with weak embed tie.
 */
export type ShortSpanPoolFixtureCategory =
    | 'spurious-diverse-catalog'
    | 'shorthand-unary'
    | 'ordering-invariant'

export type ShortSpanPoolCase = {
    id: string
    span: string
    catalog: readonly string[]
    category: ShortSpanPoolFixtureCategory
    notes?: string
    vectorPlan: ShortSpanPoolVectorPlan
    /** When set, alwaysActive head label must match. */
    expectHeadLabel?: string
    /** spurious-diverse-catalog: top joint must stay strictly below this (default T_JOINT_ABS). */
    expectTopJointBelow?: number
    /** spurious-diverse-catalog: when joint clears floor, margin must stay below T_JOINT_MARGIN. */
    expectTopMarginBelowWhenAboveFloor?: boolean
}

export const SHORT_SPAN_LEXICAL_CASES: readonly ShortSpanLexicalCase[] = [
    {
        id: 'short-lex-001-length-1-a',
        span: 'a',
        catalog: ['axe', 'anvil', 'lantern'],
        notes: 'Length-1 vs diverse catalog --- spurious substring risk (pool: short-pool-001).',
    },
    {
        id: 'short-lex-002-ax-axe-shorthand',
        span: 'ax',
        catalog: ['rusty axe'],
        expectHeadAbove: 'rusty axe',
        notes: 'Prefix shorthand for axe token inside rusty axe --- desired match (mirror short-lex-004).',
    },
    {
        id: 'short-lex-003-axolotl-vs-coaxial',
        span: 'ax',
        catalog: ['axolotl', 'coaxial'],
        expectHeadAbove: 'coaxial',
        notes: 'Adjoined-flank geometry: prefix match ranks above infix.',
    },
    {
        id: 'short-lex-004-unary-short',
        span: 'ax',
        catalog: ['rusty ax'],
        expectHeadAbove: 'rusty ax',
        notes: 'Short span with admissible catalog token.',
    },
    {
        id: 'short-lex-005-unary-a-axe-shorthand',
        span: 'a',
        catalog: ['axe'],
        notes: 'Unary axe catalog: a as shorthand may score moderately high.',
    },
    {
        id: 'short-lex-006-gem-gemstones-proportionate',
        span: 'gem',
        catalog: ['gemstones', 'anvil'],
        expectHeadAbove: 'anvil',
        notes: 'Proportionate coverage control (1/3 embed); legitimate stem should beat unrelated catalog entry.',
    },
    {
        id: 'short-lex-007-don-wimbledon-symmetry',
        span: 'don',
        catalog: ['wimbledon', 'anvil'],
        expectHeadAbove: 'anvil',
        notes: 'Morphology mirror of gem/gemstones (3-char span, 6-char adjoined, 9-char candidate, 3/9 coverage); lex must match gem pair.',
    },
]

export const SHORT_SPAN_POOL_CASES: readonly ShortSpanPoolCase[] = [
    {
        id: 'short-pool-001-length-1-a',
        span: 'a',
        catalog: ['axe', 'anvil', 'lantern'],
        category: 'spurious-diverse-catalog',
        vectorPlan: { kind: 'below-multi-floor', similarities: [0.11, 0.09, 0.08] },
        expectTopMarginBelowWhenAboveFloor: true,
        notes: 'Diverse catalog: gate-off joint head must stay below FT-5 floor with weak embed.',
    },
    {
        id: 'short-pool-002-ax-axe-shorthand',
        span: 'ax',
        catalog: ['rusty axe'],
        category: 'shorthand-unary',
        vectorPlan: { kind: 'unary-below-floor', similarity: 0.11 },
        expectHeadLabel: 'rusty axe',
        notes: 'Prefix shorthand for only object in room --- high joint is a success case, not spurious.',
    },
    {
        id: 'short-pool-003-axolotl-vs-coaxial',
        span: 'ax',
        catalog: ['axolotl', 'coaxial'],
        category: 'ordering-invariant',
        vectorPlan: { kind: 'below-multi-floor', similarities: [0.11, 0.09] },
        expectHeadLabel: 'axolotl',
        notes: 'Pool ordering invariant with weak embed tie.',
    },
    {
        id: 'short-pool-004-unary-a-axe-shorthand',
        span: 'a',
        catalog: ['axe'],
        category: 'shorthand-unary',
        vectorPlan: { kind: 'unary-below-floor', similarity: 0.16 },
        expectHeadLabel: 'axe',
        notes: 'Unary a/axe shorthand --- moderate-to-high joint OK; embed still weak.',
    },
]

export const buildCatalogCandidates = (
    catalog: readonly string[],
    objectIdPrefix: string
): EmbeddingMatchCandidate[] =>
    catalog.map((shortName, index) => ({
        objectId: `${objectIdPrefix}-${index}` as EphemeraObjectId,
        normalizedShortName: normalizeShortNameForEmbedding(shortName),
        catalogScope: 'room' as const,
    }))
