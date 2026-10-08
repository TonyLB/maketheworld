/**
 * Payoff test for narrating a crossing (`positions/AGENT.contract.md`, An attempt narrates through
 * its narration units): a thing tied
 * across a shard boundary (a relation whose legs sit in two graphs, joined by a crossing port)
 * can be taken, and the tie's dissolve narrates to the rooms whose rosters it touches. Expansion
 * follows the relation through the port to its true far end and stamps that end from the shard
 * holding its own leg, so a far end seen in another room reaches that room too.
 *
 * Real, in this order, following `ropeLashedTakePayoff.integration.test.ts`'s harness (see its
 * header): `parseCommand` with no Bedrock call, the bus crossing as plain data, then the real
 * `commitAttempt` -> `commitStepSequence` against a mocked `ephemeraDB` leaf, terminating at the
 * committed graphs and the delivered narration.
 */
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
const mockGetCurrentTimestamp = jest.fn()
jest.mock('../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: () => mockGetCurrentTimestamp(),
}))
jest.mock('../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { parseCommand } from './actions/parseCommand'
import { CommandAttempt, type CommandAttemptData } from './actions/commandAttempt'
import { commitAttempt } from './positions/manipulation/commitAttempt'
import { EphemeraLudicGraph } from './positions/ludicGraph'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const ROOM_ID = 'ROOM#Bridge' as EphemeraRoomId
const OTHER_ROOM_ID = 'ROOM#Galley' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId
const ONLOOKER_ID = 'CHARACTER#Onlooker' as EphemeraCharacterId
const STRING_ID = 'OBJECT#String' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const WALL_ID = 'OBJECT#Wall' as EphemeraObjectId
const HOOK_ID = 'OBJECT#Hook' as EphemeraObjectId

const tied = (from: unknown, to: unknown) => ({ from, to, kind: 'Custom' as const, relationLabel: 'is tied to' }) as never
const crossingPort = (portId: string, fromHostId: EphemeraRoomId) => ({ portId, fromHostId, kind: 'Custom' as const, exteriorRelationLabel: 'is tied to' })
const fullBinding = (key: string, fromHostId: EphemeraRoomId) => ({ tag: 'Presence' as const, universalKey: key as EphemeraPresenceNodeId, fromHostId, cover: { tag: 'Full' as const } })

/** Same stand-in as `ropeLashedTakePayoff.integration.test.ts`: runs the real reducer over the seeded graphs. */
const makeTransactWriteMock = (graphsByHost: Record<string, EphemeraLudicGraph>) => (
    jest.fn(async (items: any[]): Promise<void> => {
        const multiKeyItem = items.find((item) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
        if (!multiKeyItem) {
            return
        }
        const draft: Record<string, any> = {}
        multiKeyItem.Keys.forEach((key: { EphemeraId: string; DataCategory: string }) => {
            const graph = graphsByHost[key.EphemeraId]
            if (!graph) {
                throw new Error(`makeTransactWriteMock: no seeded graph for footprint host ${key.EphemeraId}`)
            }
            draft[`${key.EphemeraId}#${key.DataCategory}`] = {
                EphemeraId: key.EphemeraId,
                DataCategory: key.DataCategory,
                ludicGraph: graph.toStored(),
            }
        })
        multiKeyItem.reducer(draft)
    })
)

type World = {
    graphs: Record<string, EphemeraLudicGraph>
    containers: Record<string, EphemeraMembershipHostId[]>
    names: Record<string, string>
}

describe('crossing take payoff (integration)', () => {
    let world: World = { graphs: {}, containers: {}, names: {} }

    const seed = (next: World) => {
        world = next
        for (const [objectId, shortName] of Object.entries(world.names)) {
            internalCache.ImprovisationComponentData.set(objectId as EphemeraObjectId, IMPROVISATION_ASSET_ID, new StandardObject({ tag: 'Object', universalKey: objectId as EphemeraObjectId, shortName }))
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
        let timestamp = 1_000_000_000_000
        mockGetCurrentTimestamp.mockImplementation(() => timestamp++)
        internalCache.clear()
        messageBus.clear()
        assetDBMock.getItems.mockResolvedValue([] as any)
        assetDBMock.query.mockResolvedValue([] as any)
        ephemeraDBMock.getItems.mockResolvedValue([] as any)
        ephemeraDBMock.getItem.mockImplementation(async ({ Key }: any) => {
            const graph = world.graphs[Key.EphemeraId]
            if (graph && ['Meta::Room', 'Meta::Object', 'Meta::Character'].includes(Key.DataCategory)) {
                return { ludicGraph: graph.toStored() }
            }
            return undefined
        })
        ephemeraDBMock.transactWrite.mockImplementation(async (items: any[]) => makeTransactWriteMock(world.graphs)(items))
        jest.spyOn(internalCache.Positions, 'getMembershipContainers').mockImplementation(async (id) => world.containers[id] ?? [])
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    /** "get <thing>" end to end: parse (no Bedrock), the bus crossing, then the real commit. Returns the commit's bus. */
    const get = async (command: string, labels: Array<[EphemeraObjectId, string]>): Promise<jest.Mock> => {
        const invokeBedrockParseCommandImpl = jest.fn()
        const parseResult = await parseCommand(
            {
                command,
                characterId: CHARACTER_ID,
                hostRoomId: ROOM_ID,
                roomObjectLabels: labels.map(([, label]) => label),
                roomObjectCatalog: labels.map(([objectId, normalizedShortName]) => ({ objectId, normalizedShortName })),
            },
            {
                invokeBedrockParseCommandImpl,
                objectManipulationPositionsReadDeps: {
                    getMembershipContainers: jest.fn().mockImplementation(async (id: string) => world.containers[id] ?? []),
                    getLudicGraph: jest.fn().mockImplementation(async (hostId: string) => world.graphs[hostId] ?? EphemeraLudicGraph.empty(hostId as EphemeraMembershipHostId)),
                },
            }
        )

        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
        expect(parseResult).toEqual(expect.objectContaining({ type: 'CommandAttempt' }))
        if (parseResult.type !== 'CommandAttempt') {
            throw new Error('unreachable: asserted above')
        }

        const attempt = CommandAttempt.fromJSON(JSON.parse(JSON.stringify(parseResult.attempt)) as CommandAttemptData)
        const publish = jest.fn()
        await commitAttempt({
            attempt,
            characterId: CHARACTER_ID,
            messageBus: { publish } as any,
            streamEvent: jest.fn().mockResolvedValue(undefined),
        })
        return publish
    }

    /** Every narration line the post-commit sweep reported, in delivery order, with who it reached. */
    const delivered = async (publish: jest.Mock): Promise<{ line: string, targets: string[] }[]> => {
        const reports = publish.mock.calls
            .map((call: any[]) => call[0])
            .filter((message: any) => message?.type === 'StreamingEvent' && message?.header?.type === 'Message Slot Reported')
        const contents = await Promise.all(reports.map((report: any) => report.getContent()))
        return contents.map((content: any) => ({ line: content.message.message.join(''), targets: [...content.message.targets].sort() }))
    }

    it('"get cup" tied across the table to the string in the room: unties both legs and the port, then takes the cup, narrating the untying first', async () => {
        // The string sits in the room; the cup on the table, which is bound into the room. The
        // room holds `string -> port`; the table holds the port and `port -> cup`.
        const tablePort = { owner: TABLE_ID, port: 'port-table' }
        seed({
            graphs: {
                [ROOM_ID]: EphemeraLudicGraph.empty(ROOM_ID)
                    .addCharacter(CHARACTER_ID)
                    .addObject(STRING_ID)
                    .addObject(TABLE_ID)
                    .addRelationalEdge(tied(STRING_ID, tablePort)),
                [TABLE_ID]: EphemeraLudicGraph.empty(TABLE_ID)
                    .addObject(CUP_ID)
                    .addPort(crossingPort('port-table', ROOM_ID))
                    .addPresenceNode(fullBinding('PRESENCE#table-in-bridge', ROOM_ID))
                    .addRelationalEdge({ from: CUP_ID, to: TABLE_ID, kind: 'On' })
                    .addRelationalEdge(tied(tablePort, CUP_ID)),
                [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID),
                [CUP_ID]: EphemeraLudicGraph.empty(CUP_ID),
                [STRING_ID]: EphemeraLudicGraph.empty(STRING_ID),
            },
            containers: { [CHARACTER_ID]: [ROOM_ID], [STRING_ID]: [ROOM_ID], [TABLE_ID]: [ROOM_ID], [CUP_ID]: [TABLE_ID] },
            names: { [STRING_ID]: 'string', [TABLE_ID]: 'table', [CUP_ID]: 'cup' },
        })

        const publish = await get('get cup', [[CUP_ID, 'cup'], [STRING_ID, 'string'], [TABLE_ID, 'table']])

        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)
        expect((await internalCache.Positions.getLudicGraph(CHARACTER_ID)).nodeIds.has(CUP_ID)).toBe(true)
        const tableGraph = await internalCache.Positions.getLudicGraph(TABLE_ID)
        expect(tableGraph.nodeIds.has(CUP_ID)).toBe(false)
        expect(tableGraph.relationalEdges).toEqual([])
        expect(tableGraph.ports).toEqual([])
        expect((await internalCache.Positions.getLudicGraph(ROOM_ID)).relationalEdges).toEqual([])

        // Action order: the untying is delivered before the take, and reaches the room (through the
        // table's binding, the bucket the cup is seen in).
        const lines = await delivered(publish)
        expect(lines[0]).toEqual({ line: expect.stringMatching(/ frees cup from string$/), targets: [CHARACTER_ID] })
        // The take's line is the one Plan's template authored, delivered once: a take from a table reads "picks up",
        // where the retired verb-from-delta bridge read "gives" (no room on either side).
        expect(lines.slice(1)).toEqual([{ line: expect.stringMatching(/ picks up cup$/), targets: [CHARACTER_ID] }])
    })

    it('"get string" tied through a wall to a hook seen from two rooms: the untying reaches both rooms, the take only the actor\'s', async () => {
        // The wall is bound into both rooms; the hook sits in the wall's own interior. The far
        // end's room comes from the wall's shard (where the hook's leg is), not from the room
        // the string is taken from.
        const wallPort = { owner: WALL_ID, port: 'port-wall' }
        seed({
            graphs: {
                [ROOM_ID]: EphemeraLudicGraph.empty(ROOM_ID)
                    .addCharacter(CHARACTER_ID)
                    .addObject(STRING_ID)
                    .addObject(WALL_ID)
                    .addRelationalEdge(tied(STRING_ID, wallPort)),
                [OTHER_ROOM_ID]: EphemeraLudicGraph.empty(OTHER_ROOM_ID)
                    .addCharacter(ONLOOKER_ID)
                    .addObject(WALL_ID),
                [WALL_ID]: EphemeraLudicGraph.empty(WALL_ID)
                    .addObject(HOOK_ID)
                    .addPort(crossingPort('port-wall', ROOM_ID))
                    .addPresenceNode(fullBinding('PRESENCE#wall-in-bridge', ROOM_ID))
                    .addPresenceNode(fullBinding('PRESENCE#wall-in-galley', OTHER_ROOM_ID))
                    .addRelationalEdge(tied(wallPort, HOOK_ID)),
                [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID),
                [STRING_ID]: EphemeraLudicGraph.empty(STRING_ID),
                [HOOK_ID]: EphemeraLudicGraph.empty(HOOK_ID),
            },
            containers: {
                [CHARACTER_ID]: [ROOM_ID],
                [ONLOOKER_ID]: [OTHER_ROOM_ID],
                [STRING_ID]: [ROOM_ID],
                [WALL_ID]: [ROOM_ID, OTHER_ROOM_ID],
                [HOOK_ID]: [WALL_ID],
            },
            names: { [STRING_ID]: 'string', [WALL_ID]: 'wall', [HOOK_ID]: 'hook' },
        })

        const publish = await get('get string', [[STRING_ID, 'string'], [WALL_ID, 'wall']])

        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)
        expect((await internalCache.Positions.getLudicGraph(CHARACTER_ID)).nodeIds.has(STRING_ID)).toBe(true)
        expect((await internalCache.Positions.getLudicGraph(WALL_ID)).relationalEdges).toEqual([])
        expect((await internalCache.Positions.getLudicGraph(ROOM_ID)).relationalEdges).toEqual([])

        const lines = await delivered(publish)
        expect(lines[0]).toEqual({ line: expect.stringMatching(/ frees string from hook$/), targets: [CHARACTER_ID, ONLOOKER_ID].sort() })
        expect(lines.slice(1)).toEqual([{ line: expect.stringMatching(/ picks up string$/), targets: [CHARACTER_ID] }])
    })
})
