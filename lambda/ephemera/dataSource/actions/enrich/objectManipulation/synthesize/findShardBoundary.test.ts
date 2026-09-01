import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { findShardBoundary } from './findShardBoundary'

const ROOM_ID = 'ROOM#Vortex' as EphemeraRoomId
const ROOM_A_ID = 'ROOM#Alpha' as EphemeraRoomId
const ROOM_B_ID = 'ROOM#Beta' as EphemeraRoomId
const ROPE_ID = 'OBJECT#Rope' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const PLACE_SETTING_ID = 'OBJECT#PlaceSetting' as EphemeraObjectId
const HOST_P_ID = 'ROOM#P' as EphemeraRoomId
const HOST_Q_ID = 'ROOM#Q' as EphemeraRoomId
const HOST_M_ID = 'OBJECT#M' as EphemeraObjectId
const HOST_N_ID = 'OBJECT#N' as EphemeraObjectId

const containersFrom = (
    table: Record<string, EphemeraMembershipHostId[]>
) => (id: EphemeraPositionAdjacencyContainedId): EphemeraMembershipHostId[] => table[id] ?? []

describe('findShardBoundary', () => {
    it('is the degenerate same-shard case when both endpoints share one direct container', () => {
        const getMembershipContainers = containersFrom({
            [ROPE_ID]: [ROOM_ID],
            [CUP_ID]: [ROOM_ID],
        })

        const result = findShardBoundary({ subjectId: ROPE_ID, targetId: CUP_ID }, getMembershipContainers)

        expect(result).toEqual({
            verdict: 'crossed',
            commonAncestor: ROOM_ID,
            subjectPath: [ROOM_ID],
            targetPath: [ROOM_ID],
        })
    })

    it('finds the one-hop room/table crossing (rope in room, cup on table)', () => {
        const getMembershipContainers = containersFrom({
            [ROPE_ID]: [ROOM_ID],
            [CUP_ID]: [TABLE_ID],
            [TABLE_ID]: [ROOM_ID],
        })

        const result = findShardBoundary({ subjectId: ROPE_ID, targetId: CUP_ID }, getMembershipContainers)

        expect(result).toEqual({
            verdict: 'crossed',
            commonAncestor: ROOM_ID,
            subjectPath: [ROOM_ID],
            targetPath: [TABLE_ID, ROOM_ID],
        })
    })

    it('returns notFound when the two endpoints reach no common ancestor', () => {
        const getMembershipContainers = containersFrom({
            [ROPE_ID]: [ROOM_A_ID],
            [CUP_ID]: [ROOM_B_ID],
        })

        const result = findShardBoundary({ subjectId: ROPE_ID, targetId: CUP_ID }, getMembershipContainers)

        expect(result).toEqual({ verdict: 'notFound' })
    })

    it('walks through a multiply-contained intermediate host without erroring (cup on table AND in a place setting, both in the room)', () => {
        const getMembershipContainers = containersFrom({
            [ROPE_ID]: [ROOM_ID],
            [CUP_ID]: [TABLE_ID, PLACE_SETTING_ID],
            [TABLE_ID]: [ROOM_ID],
            [PLACE_SETTING_ID]: [ROOM_ID],
        })

        const result = findShardBoundary({ subjectId: ROPE_ID, targetId: CUP_ID }, getMembershipContainers)

        expect(result.verdict).toBe('crossed')
        if (result.verdict !== 'crossed') return
        expect(result.commonAncestor).toBe(ROOM_ID)
        expect(result.subjectPath).toEqual([ROOM_ID])
    })

    it('reports ambiguous for two genuinely incomparable Pareto-minimal common ancestors (not just two starting points converging on one node)', () => {
        // subject reaches P directly (depth 1) and Q via M (depth 2);
        // target reaches Q directly (depth 1) and P via N (depth 2) --- neither P nor Q dominates
        // the other (each is closer on one side, farther on the other), so both survive.
        const getMembershipContainers = containersFrom({
            [ROPE_ID]: [HOST_P_ID, HOST_M_ID],
            [HOST_M_ID]: [HOST_Q_ID],
            [CUP_ID]: [HOST_Q_ID, HOST_N_ID],
            [HOST_N_ID]: [HOST_P_ID],
        })

        const result = findShardBoundary({ subjectId: ROPE_ID, targetId: CUP_ID }, getMembershipContainers)

        expect(result.verdict).toBe('ambiguous')
        if (result.verdict !== 'ambiguous') return
        expect(new Set(result.commonAncestors)).toEqual(new Set([HOST_P_ID, HOST_Q_ID]))
    })
})
