import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testPositionGraph } from '../../../../positions/positionGraph/testFixtures'
import type { TransferMembershipStep } from '../parsePlanStep'
import { expandTransferMembership } from './expandTransferMembership'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const GLASS_ID = 'OBJECT#Glass' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

const baseStep = (objectId: EphemeraObjectId): TransferMembershipStep => ({
    kind: 'transferMembership',
    objectIds: new Set([objectId]),
    fromHostId: ROOM_ID,
    toHostId: CHARACTER_ID,
})

describe('expandTransferMembership', () => {
    it('leaves a single object with no relational edges unchanged', () => {
        const graph = testPositionGraph(ROOM_ID, {
            nodes: [{ tag: 'Object', universalKey: TRAY_ID }],
            edges: [],
        })

        const result = expandTransferMembership(baseStep(TRAY_ID), (hostId) =>
            hostId === ROOM_ID ? graph : undefined
        )

        expect(result).toEqual({
            verdict: 'complete',
            dissolveSteps: [],
            transferStep: { ...baseStep(TRAY_ID), objectIds: new Set([TRAY_ID]) },
        })
    })

    it('absorbs an internal On edge into the closure with no dissolve steps', () => {
        const graph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: GLASS_ID },
            ],
            edges: [{ tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' }],
        })

        const result = expandTransferMembership(baseStep(TRAY_ID), (hostId) =>
            hostId === ROOM_ID ? graph : undefined
        )

        expect(result.verdict).toBe('complete')
        if (result.verdict === 'complete') {
            expect(result.dissolveSteps).toEqual([])
            expect(result.transferStep.objectIds).toEqual(new Set([TRAY_ID, GLASS_ID]))
        }
    })

    it('matches BD-13\'s worked example: get tray with glass On tray, tray On table', () => {
        const graph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: TABLE_ID },
                { tag: 'Object', universalKey: GLASS_ID },
            ],
            edges: [
                { tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' },
                { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' },
            ],
        })

        const result = expandTransferMembership(baseStep(TRAY_ID), (hostId) =>
            hostId === ROOM_ID ? graph : undefined
        )

        expect(result.verdict).toBe('complete')
        if (result.verdict === 'complete') {
            expect(result.transferStep.objectIds).toEqual(new Set([TRAY_ID, GLASS_ID]))
            expect(result.dissolveSteps).toEqual([{
                kind: 'dissolveRelation',
                subjectId: TRAY_ID,
                targetId: TABLE_ID,
                relationKind: 'On',
                hostRoomId: ROOM_ID,
            }])
        }
    })

    it('defers on a Custom-kind boundary edge', () => {
        const graph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'Custom', relationLabel: 'wedged against' }],
        })

        const result = expandTransferMembership(baseStep(TRAY_ID), (hostId) =>
            hostId === ROOM_ID ? graph : undefined
        )

        expect(result).toEqual({
            verdict: 'defer',
            decidable: false,
            reason: expect.any(String),
        })
    })

    it('defers, decidably, on an Under-subject-move boundary edge', () => {
        const graph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'Under' }],
        })

        const result = expandTransferMembership(baseStep(TRAY_ID), (hostId) =>
            hostId === ROOM_ID ? graph : undefined
        )

        expect(result).toEqual({
            verdict: 'defer',
            decidable: true,
            reason: expect.any(String),
        })
    })

    it('errors when the source graph is missing', () => {
        const result = expandTransferMembership(baseStep(TRAY_ID), () => undefined)

        expect(result.verdict).toBe('error')
    })

    it('errors on a dissolve-classified boundary edge on a non-Room (Character) source host', () => {
        const graph = testPositionGraph(CHARACTER_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' }],
        })
        const step: TransferMembershipStep = {
            kind: 'transferMembership',
            objectIds: new Set([TRAY_ID]),
            fromHostId: CHARACTER_ID,
            toHostId: ROOM_ID,
        }

        const result = expandTransferMembership(step, (hostId) => (hostId === CHARACTER_ID ? graph : undefined))

        expect(result.verdict).toBe('error')
    })
})
