import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: {
            getMembershipContainers: jest.fn(),
            getLudicGraph: jest.fn(),
        },
    },
}))

import internalCache from '../../../../internalCache'
import { planRelationalEdgeTransfer } from './planRelationalEdgeTransfer'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import { EphemeraLudicGraph } from '../../ludicGraph'
import type { DissolveRelationChange, EstablishRelationChange, GroundedReferent } from '../../../actions/enrich/objectManipulation/plan/planStep'

const getMembershipContainersMock = internalCache.Positions.getMembershipContainers as jest.MockedFunction<
    typeof internalCache.Positions.getMembershipContainers
>
const getLudicGraphMock = internalCache.Positions.getLudicGraph as jest.MockedFunction<
    typeof internalCache.Positions.getLudicGraph
>

const ROOM = 'ROOM#Cafe' as EphemeraRoomId
const BROOM = 'OBJECT#Broom' as EphemeraObjectId
const TABLE = 'OBJECT#Table' as EphemeraObjectId
const CHARACTER = 'CHARACTER#Alice' as EphemeraCharacterId

const establish = (subjectId: string, targetId: string): EstablishRelationChange<GroundedReferent> => ({
    kind: 'change',
    primitive: 'establishRelation',
    subject: { referentType: 'objectSpan', span: 'subject', groundedId: subjectId as never },
    target: { referentType: 'objectSpan', span: 'target', groundedId: targetId as never },
    relationKind: 'Custom', relationLabel: 'under',
})

describe('planRelationalEdgeTransfer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('builds a one-leg establish chain when subject and target already share a host (live state)', async () => {
        getMembershipContainersMock.mockImplementation(async (id) => {
            if (id === BROOM || id === TABLE) {
                return [ROOM]
            }
            return []
        })
        getLudicGraphMock.mockResolvedValue(testLudicGraph(ROOM, {
            nodes: [
                { tag: 'Object', universalKey: BROOM },
                { tag: 'Object', universalKey: TABLE },
            ],
        }))

        const result = await planRelationalEdgeTransfer(establish(BROOM, TABLE))

        expect(result).toEqual({
            ok: true,
            steps: [{
                kind: 'establishRelation',
                subjectId: BROOM,
                targetId: TABLE,
                hostId: ROOM,
                relationKind: 'Custom', relationLabel: 'under',
            }],
        })
    })

    it('refuses a non-Object endpoint (a relational edge is Object-to-Object only)', async () => {
        const result = await planRelationalEdgeTransfer(establish(CHARACTER, TABLE))

        expect(result).toEqual({
            ok: false,
            errorCode: 'nonObjectEndpoint',
            errorMessage: expect.any(String),
        })
        expect(getMembershipContainersMock).not.toHaveBeenCalled()
    })

    it('refuses when no chain can be found (e.g. a dissolve with no existing edge)', async () => {
        getMembershipContainersMock.mockImplementation(async (id) => {
            if (id === BROOM || id === TABLE) {
                return [ROOM]
            }
            return []
        })
        getLudicGraphMock.mockResolvedValue(testLudicGraph(ROOM, {
            nodes: [
                { tag: 'Object', universalKey: BROOM },
                { tag: 'Object', universalKey: TABLE },
            ],
        }))

        const result = await planRelationalEdgeTransfer({
            ...establish(BROOM, TABLE),
            primitive: 'dissolveRelation',
        })

        expect(result.ok).toBe(false)
    })

    it('refuses an establish whose relation already holds, against the live graph (the patch would be idempotent, but the attempt would narrate)', async () => {
        getMembershipContainersMock.mockImplementation(async (id) => (id === BROOM || id === TABLE ? [ROOM] : []))
        getLudicGraphMock.mockImplementation(async (hostId) => (hostId === ROOM
            ? testLudicGraph(ROOM, {
                nodes: [{ tag: 'Object', universalKey: BROOM }, { tag: 'Object', universalKey: TABLE }],
                edges: [{ tag: 'Relational', from: BROOM, to: TABLE, kind: 'Custom', relationLabel: 'under' }],
            })
            : testLudicGraph(hostId)))

        const result = await planRelationalEdgeTransfer(establish(BROOM, TABLE))

        expect(result).toEqual({ ok: false, errorCode: 'expansionError', errorMessage: expect.stringContaining('is already present') })
    })

    describe('a crossing dissolve (Expansion\'s facilitating dissolve of a relation across a shard boundary)', () => {
        const STRING = 'OBJECT#String' as EphemeraObjectId
        const CUP = 'OBJECT#Cup' as EphemeraObjectId
        const BOX = 'OBJECT#Box' as EphemeraObjectId
        const dissolve = (subjectId: string, targetId: string): DissolveRelationChange<GroundedReferent> => ({
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: { referentType: 'graphNode', groundedId: subjectId as never },
            target: { referentType: 'graphNode', groundedId: targetId as never },
            relationKind: 'Custom', relationLabel: 'is tied to',
        })
        const tied = (from: unknown, to: unknown) => ({ from, to, kind: 'Custom' as const, relationLabel: 'is tied to' }) as never
        const withGraphs = (containers: Record<string, string[]>, graphs: Record<string, EphemeraLudicGraph>) => {
            getMembershipContainersMock.mockImplementation(async (id) => (containers[id] ?? []) as never)
            getLudicGraphMock.mockImplementation(async (hostId) => graphs[hostId] ?? testLudicGraph(hostId))
        }
        const tablePort = { owner: TABLE, port: 'port-table' }

        it('dissolves a one-sided crossing: a leg on each host, and the port it crossed through', async () => {
            // The string sits in the room (the common ancestor); the cup sits on the table.
            withGraphs({ [STRING]: [ROOM], [CUP]: [TABLE], [TABLE]: [ROOM] }, {
                [ROOM]: EphemeraLudicGraph.empty(ROOM).addObject(STRING).addObject(TABLE).addRelationalEdge(tied(STRING, tablePort)),
                [TABLE]: EphemeraLudicGraph.empty(TABLE).addObject(CUP)
                    .addPort({ portId: 'port-table', fromHostId: ROOM, kind: 'Custom', exteriorRelationLabel: 'is tied to' })
                    .addRelationalEdge(tied(tablePort, CUP)),
            })

            const result = await planRelationalEdgeTransfer(dissolve(STRING, CUP))

            expect(result).toEqual({
                ok: true,
                steps: [
                    { kind: 'dissolveRelation', subjectId: STRING, targetId: tablePort, hostId: ROOM, relationKind: 'Custom', relationLabel: 'is tied to' },
                    { kind: 'removeCrossingPort', hostId: TABLE, portId: 'port-table' },
                    { kind: 'dissolveRelation', subjectId: tablePort, targetId: CUP, hostId: TABLE, relationKind: 'Custom', relationLabel: 'is tied to' },
                ],
            })
        })

        it('dissolves a two-sided crossing, whose middle leg sits in a common ancestor neither end is directly in', async () => {
            // The string is in a box, the cup on a table; both sit in the room, which holds the
            // middle leg between the two ports.
            const boxPort = { owner: BOX, port: 'port-box' }
            withGraphs({ [STRING]: [BOX], [CUP]: [TABLE], [BOX]: [ROOM], [TABLE]: [ROOM] }, {
                [ROOM]: EphemeraLudicGraph.empty(ROOM).addObject(BOX).addObject(TABLE).addRelationalEdge(tied(boxPort, tablePort)),
                [BOX]: EphemeraLudicGraph.empty(BOX).addObject(STRING)
                    .addPort({ portId: 'port-box', fromHostId: ROOM, kind: 'Custom', exteriorRelationLabel: 'is tied to' })
                    .addRelationalEdge(tied(STRING, boxPort)),
                [TABLE]: EphemeraLudicGraph.empty(TABLE).addObject(CUP)
                    .addPort({ portId: 'port-table', fromHostId: ROOM, kind: 'Custom', exteriorRelationLabel: 'is tied to' })
                    .addRelationalEdge(tied(tablePort, CUP)),
            })

            const result = await planRelationalEdgeTransfer(dissolve(STRING, CUP))

            expect(result).toEqual({
                ok: true,
                steps: [
                    { kind: 'dissolveRelation', subjectId: STRING, targetId: boxPort, hostId: BOX, relationKind: 'Custom', relationLabel: 'is tied to' },
                    { kind: 'removeCrossingPort', hostId: BOX, portId: 'port-box' },
                    { kind: 'dissolveRelation', subjectId: boxPort, targetId: tablePort, hostId: ROOM, relationKind: 'Custom', relationLabel: 'is tied to' },
                    { kind: 'removeCrossingPort', hostId: TABLE, portId: 'port-table' },
                    { kind: 'dissolveRelation', subjectId: tablePort, targetId: CUP, hostId: TABLE, relationKind: 'Custom', relationLabel: 'is tied to' },
                ],
            })
        })
    })
})
