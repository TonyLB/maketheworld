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
        ['ConnectedTo', 'subject', 'defer'],
        ['ConnectedTo', 'target', 'defer'],
    ] as const)('%s / %s -> %s', (relationKind, movedRole, expected) => {
        expect(classifyInteractionUnderTransfer(relationKind, movedRole)).toBe(expected)
    })

    // `'Present'`'s own case (presence plan PR-4/reading (d)) was deleted at presenceNodes
    // Slice 3 (PN-14): `'Present'` retired from `HostRelationalEdgeKind` entirely, so it is no
    // longer a value this function's parameter type can hold, and there is no case left to test.
})

describe('boundaryEdgeOutcomes', () => {
    it('reports an edge with the mover at one end, with the role the mover plays (peer kinds only)', () => {
        const glassLeaningOnBook: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: glassId, to: bookId, kind: 'Custom', relationLabel: 'leaning on' }
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: bookId },
                { tag: 'Object', universalKey: glassId },
            ],
            edges: [glassLeaningOnBook],
        })
        const outcomes = boundaryEdgeOutcomes(bookId, graph)

        expect(outcomes).toHaveLength(1)
        expect(outcomes[0]).toEqual({
            edge: { from: glassId, to: bookId, kind: 'Custom', relationLabel: 'leaning on' },
            movedRole: 'target',
            outcome: 'defer',
        })
    })
})
