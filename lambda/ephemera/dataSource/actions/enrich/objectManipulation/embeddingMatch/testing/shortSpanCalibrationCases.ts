import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { normalizeShortNameForEmbedding } from '../../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

import type { EmbeddingMatchCandidate } from '../types'

export type ShortSpanLexicalCase = {
    id: string
    span: string
    catalog: readonly string[]
    notes?: string
    /** When set, head catalog entry must rank above this shortName on lexical relevance. */
    expectHeadAbove?: string
    /** When set, top lexical score must stay below this bound (spurious-match guard). */
    expectTopLexBelow?: number
}

export type ShortSpanPoolCase = {
    id: string
    span: string
    catalog: readonly string[]
    notes?: string
    /** With admissibility on, lexical channel should be inactive for this span. */
    expectLexicalInactiveWithAdmissibility?: boolean
    /** With admissibility off, top joint relevance must stay below FT-5 joint floor proposal. */
    expectTopJointBelowWithAlwaysActive?: number
    expectHeadLabel?: string
}

export const SHORT_SPAN_LEXICAL_CASES: readonly ShortSpanLexicalCase[] = [
    {
        id: 'short-lex-001-length-1-a',
        span: 'a',
        catalog: ['axe', 'anvil', 'lantern'],
        notes: 'Length-1 span against multi-token catalog; spurious substring risk.',
        expectTopLexBelow: 0.35,
    },
    {
        id: 'short-lex-002-ax-axe-only',
        span: 'ax',
        catalog: ['rusty axe'],
        notes: 'Inadmissible length-2 span vs axe-only catalog under gate.',
        expectTopLexBelow: 0.35,
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
]

export const SHORT_SPAN_POOL_CASES: readonly ShortSpanPoolCase[] = [
    {
        id: 'short-pool-001-length-1-a',
        span: 'a',
        catalog: ['axe', 'anvil', 'lantern'],
        expectLexicalInactiveWithAdmissibility: true,
        expectTopJointBelowWithAlwaysActive: 0.42,
        notes: 'Gate off: lex scores but joint head stays below FT-5 floor.',
    },
    {
        id: 'short-pool-002-ax-axe-only',
        span: 'ax',
        catalog: ['rusty axe'],
        expectLexicalInactiveWithAdmissibility: true,
        expectTopJointBelowWithAlwaysActive: 0.42,
    },
    {
        id: 'short-pool-003-axolotl-vs-coaxial',
        span: 'ax',
        catalog: ['axolotl', 'coaxial'],
        expectHeadLabel: 'axolotl',
        notes: 'Pool ordering invariant with mocked embed tie.',
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
