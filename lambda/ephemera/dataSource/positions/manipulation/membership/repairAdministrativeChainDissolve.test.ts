import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { repairAdministrativeChainDissolve } from './repairAdministrativeChainDissolve'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

/**
 * Direct unit coverage of the administrative repair policy extracted from
 * `executeMembershipTransfer`'s pre-3d body (3d, 2026-09-08). The chain-walk/crossing-leg
 * mechanics it composes (`findRelationalChainsTouching`, `buildCrossingDissolveLegs`,
 * `fetchRelationalReachability`) have their own suites; the two "removing the interior/exterior
 * side of a crossing" cases that exercise this policy end to end through a real commit stay in
 * `executeMembershipTransfer.test.ts`, since they assert commit-level behavior this function
 * doesn't itself produce.
 */
describe('repairAdministrativeChainDissolve', () => {
    it('dissolves a boundary edge touching the departing object, unconditionally (no defer concept)', async () => {
        const roomGraph = testLudicGraph(FROM_ROOM, {
            nodes: [
                { tag: 'Object', universalKey: OBJECT_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational', from: OBJECT_ID, to: TABLE_ID, kind: 'Under' }],
        })
        const getMembershipContainers = async (): Promise<EphemeraRoomId[]> => [FROM_ROOM]
        const getGraph = async (): Promise<EphemeraLudicGraph> => roomGraph

        const { dissolveSteps, hostByReferencedId } = await repairAdministrativeChainDissolve(
            OBJECT_ID,
            getMembershipContainers,
            getGraph
        )

        expect(dissolveSteps.some((step) => step.kind === 'dissolveRelation'
            && step.subjectId === OBJECT_ID && step.targetId === TABLE_ID)).toBe(true)
        expect(hostByReferencedId.get(OBJECT_ID)).toBe(FROM_ROOM)
    })

    it('produces no dissolve steps for a character entity --- a character can never carry a relational edge', async () => {
        const getMembershipContainers = async (): Promise<EphemeraRoomId[]> => [FROM_ROOM]
        const getGraph = async (): Promise<EphemeraLudicGraph> => testLudicGraph(FROM_ROOM, { nodes: [] })

        const { dissolveSteps, hostByReferencedId } = await repairAdministrativeChainDissolve(
            CHARACTER_ID,
            getMembershipContainers,
            getGraph
        )

        expect(dissolveSteps).toEqual([])
        expect(hostByReferencedId.size).toBe(0)
    })
})
