import type { RoomExit } from '../../baseClasses'
import { normalizeCommandToken } from '../../discriminateIntent/exitResolution'
import type { SpanCandidatePool } from './spanResolution'

/**
 * An exit span's pool: lexical and exact, since a room's exits are a handful of short names. Each
 * room an exit of that name leads to is a candidate, named by the exit, so two exits of one name
 * to different rooms are two candidates (the dry run refuses that ambiguity) and two to the same
 * room are one. An exit span makes no embedding call.
 */
export function exitSpanPool(span: string, exits: readonly RoomExit[]): SpanCandidatePool {
    const name = normalizeCommandToken(span)
    const targets = [...new Set(exits.filter(({ normalizedName }) => normalizedName === name).map(({ targetId }) => targetId))]
    return {
        span,
        candidates: targets.map((targetId) => ({
            id: targetId,
            label: name,
            jointRelevance: 1,
            lexRelevance: 1,
            sourceTags: ['exact'],
            locus: { kind: 'room' },
        })),
    }
}
