import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { testLudicGraph } from '../testFixtures'
import {
    boundaryEdgeOutcomes,
    classifyInteractionUnderTransfer,
} from './interactionUnderTransfer'

const bookId = 'OBJECT#Book' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId

describe('classifyInteractionUnderTransfer', () => {
    it.each([
        ['Custom', 'subject', 'defer'],
        ['Custom', 'target', 'defer'],
    ] as const)('%s / %s -> %s', (relationKind, movedRole, expected) => {
        expect(classifyInteractionUnderTransfer(relationKind, movedRole)).toBe(expected)
    })

    // AB-54 (2026-08-19): containment kinds are *hosting* kinds -- the subordinate node lives
    // in its host's own shard -- so they do not appear on the exterior graph this classifier
    // runs over. The throw asserts that invariant rather than standing in for a pending answer.
    // It is scoped to the current constructor discipline (AB-53, iteration 1), not forever:
    // if multi-level graphs land, this test is the thing that should fail and be revisited.
    // `On` joined `In`/`PartOf` here 2026-08-22 (Channel D, CD2, reduced scope): it is a
    // hosting kind too, now dormant at ingress and asserted as an invariant here, same as
    // its two siblings, even though the real shard-hosting mechanism remains unbuilt (CC3-gated).
    it.each(['On', 'In', 'PartOf'] as const)('throws naming AB-54 for %s, rather than classifying a hosting kind', (relationKind) => {
        expect(() => classifyInteractionUnderTransfer(relationKind, 'subject')).toThrow(/AB-54/)
        expect(() => classifyInteractionUnderTransfer(relationKind, 'target')).toThrow(/AB-54/)
    })

    // `'Present'`'s own case (presence plan PR-4/reading (d)) was deleted at presenceNodes
    // Slice 3 (PN-14): `'Present'` retired from `HostRelationalEdgeKind` entirely, so it is no
    // longer a value this function's parameter type can hold, and there is no case left to test.
})

describe('boundaryEdgeOutcomes', () => {
    it('reports only the true external edge for a resolved transfer set (peer kinds only -- On/In/PartOf throw)', () => {
        const glassLeaningOnBook: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: glassId, to: bookId, kind: 'Custom', relationLabel: 'leaning on' }
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: bookId },
                { tag: 'Object', universalKey: glassId },
            ],
            edges: [glassLeaningOnBook],
        })
        const outcomes = boundaryEdgeOutcomes(new Set([bookId]), graph)

        expect(outcomes).toHaveLength(1)
        expect(outcomes[0]).toEqual({
            edge: { from: glassId, to: bookId, kind: 'Custom', relationLabel: 'leaning on' },
            movedRole: 'target',
            outcome: 'defer',
        })
    })
})
