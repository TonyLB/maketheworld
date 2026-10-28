/**
 * Payoff test for templates written once as skeleton patterns (`actions/AGENT.implementation.md`,
 * "`DeterministicTemplate` module"; rules in `actions/AGENT.contract.md` "Qualifier"): the fast
 * path is the membership verbs and an object phrase matched against the command text, and the
 * templates matched against the flat skeleton return every reading, each its own attempt.
 *
 * - A qualified take on the fast path picks the object its phrase names (`take cup from table`,
 *   and the canonical `out` in `take coin out box`), with no pattern of the fast path's own. The
 *   bare `get` and `drop` shapes end at a line and a commit in `crossingTakePayoff`,
 *   `ropeLashedTakePayoff` and `objectSpreadPayoff`.
 * - A chained take (`take cup on saucer on table`) reads its chain right-nested, and its checks
 *   pick the cup on the table's saucer over the floor's, without asking.
 * - A flat skeleton reaches the same readings: `put cup on saucer on table` on the fast path (the
 *   containment template's own pattern, no Bedrock call) yields both bracketings from its exact
 *   segmentation, and the world chooses the one that can happen.
 *
 * Real, in this order, following `crossingTakePayoff.integration.test.ts`'s harness (see its
 * header): `parseCommand` (Bedrock mocked at its two seams, and asserted unused on the fast path),
 * the bus crossing as plain data, then the real `commitAttempt` -> `commitStepSequence` against a
 * mocked `ephemeraDB` leaf, terminating at the committed graphs and the delivered narration.
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
import { parentRemainderKey } from './positions/ludicGraph/testFixtures'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const ROOM_ID = 'ROOM#Parlour' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const TABLE_SAUCER_ID = 'OBJECT#TableSaucer' as EphemeraObjectId
const TABLE_CUP_ID = 'OBJECT#TableCup' as EphemeraObjectId
const FLOOR_SAUCER_ID = 'OBJECT#FloorSaucer' as EphemeraObjectId
const FLOOR_CUP_ID = 'OBJECT#FloorCup' as EphemeraObjectId
const BOX_ID = 'OBJECT#Box' as EphemeraObjectId
const BOX_COIN_ID = 'OBJECT#BoxCoin' as EphemeraObjectId
const FLOOR_COIN_ID = 'OBJECT#FloorCoin' as EphemeraObjectId

/** The entries a binding lists, each naming the member's own binding. */
const covering = (...members: ([EphemeraCharacterId | EphemeraObjectId, string?])[]) => ({
    members: members.map(([host, presence]) => ({ host, presence: (presence ?? 'PRESENCE#Base') as EphemeraPresenceNodeId })),
})
const fullBinding = (key: string, parentHost: EphemeraMembershipHostId, parentPresence?: string, cover: ReturnType<typeof covering> = { members: [] }) => ({ tag: 'Presence' as const, universalKey: key as EphemeraPresenceNodeId, fromHostPresences: [{ host: parentHost, presence: (parentPresence ?? parentRemainderKey(parentHost)) as EphemeraPresenceNodeId }], cover })
/** A hostless binding: the root a mover's presence write re-points. */
const rootBinding = (key: string, cover: ReturnType<typeof covering> = { members: [] }) => ({ tag: 'Presence' as const, universalKey: key as EphemeraPresenceNodeId, fromHostPresences: [], cover })

type Member = [EphemeraObjectId, string]
/** The room's graph: the actor, and each object directly in the room under its own binding. */
const roomGraph = (members: Member[]) => (
    members.reduce(
        (graph, [member]) => graph.addObject(member, 'In'),
        EphemeraLudicGraph.empty(ROOM_ID)
            .addPresenceNode(rootBinding(parentRemainderKey(ROOM_ID), covering([CHARACTER_ID], ...members)))
            .addCharacter(CHARACTER_ID, 'In')
    )
)
/** An object's own graph: its binding under its parent's, covering whatever rests on or in it. */
const objectGraph = (objectId: EphemeraObjectId, presence: string, parentHost: EphemeraMembershipHostId, parentPresence?: string, members: Member[] = [], kind: 'On' | 'In' = 'On') => (
    members.reduce(
        (graph, [member]) => graph.addObject(member, kind),
        EphemeraLudicGraph.empty(objectId).addPresenceNode(fullBinding(presence, parentHost, parentPresence, covering(...members)))
    )
)

/** Same stand-in as `crossingTakePayoff.integration.test.ts`: runs the real reducer over the seeded graphs. */
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

describe('qualified take payoff (integration)', () => {
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
            // the room's characters row, standing in for what the fixtures' room graphs name
            if (graph && Key.DataCategory === 'LudicCache::Characters') {
                return Object.fromEntries([...graph.characterIds].map((characterId) => [characterId, []]))
            }
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

    /**
     * A command end to end: parse, the bus crossing, then the real commit. The fast path must
     * claim the command (Bedrock is asserted unused). Returns the commit's bus.
     */
    const run = async (command: string): Promise<jest.Mock> => {
        const labels = Object.entries(world.names) as Array<[EphemeraObjectId, string]>
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({ success: true, body: '{"type":"Command","confidence":0.9}' })
        const parseResult = await parseCommand(
            {
                command,
                characterId: CHARACTER_ID,
                hostRoomId: ROOM_ID,
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
        // A CommandAttempt, not a Select: the command is understood without asking.
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

    /** Every narration line the post-commit sweep reported, in delivery order. */
    const delivered = (publish: jest.Mock): string[] => (
        publish.mock.calls
            .map((call: any[]) => call[0])
            .filter((message: any) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')
            .sort((a: any, b: any) => a.createdTime - b.createdTime)
            .map((message: any) => message.message.join(''))
    )

    const holds = async (hostId: string, objectId: EphemeraObjectId): Promise<boolean> => (
        (await internalCache.Positions.getLudicGraph(hostId as EphemeraMembershipHostId)).nodeIds.has(objectId)
    )

    /** A cup on a saucer on the table, and another cup on a saucer on the floor. */
    const seedTwoStacks = (tableName = 'table') => seed({
        graphs: {
            [ROOM_ID]: roomGraph([[TABLE_ID, 'PRESENCE#table-in-room'], [FLOOR_SAUCER_ID, 'PRESENCE#floor-saucer-in-room']]),
            [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID).addPresenceNode(rootBinding('PRESENCE#Base')),
            [TABLE_ID]: objectGraph(TABLE_ID, 'PRESENCE#table-in-room', ROOM_ID, undefined, [[TABLE_SAUCER_ID, 'PRESENCE#table-saucer-on-table']]),
            [TABLE_SAUCER_ID]: objectGraph(TABLE_SAUCER_ID, 'PRESENCE#table-saucer-on-table', TABLE_ID, 'PRESENCE#table-in-room', [[TABLE_CUP_ID, 'PRESENCE#table-cup-on-saucer']]),
            [TABLE_CUP_ID]: objectGraph(TABLE_CUP_ID, 'PRESENCE#table-cup-on-saucer', TABLE_SAUCER_ID, 'PRESENCE#table-saucer-on-table'),
            [FLOOR_SAUCER_ID]: objectGraph(FLOOR_SAUCER_ID, 'PRESENCE#floor-saucer-in-room', ROOM_ID, undefined, [[FLOOR_CUP_ID, 'PRESENCE#floor-cup-on-saucer']]),
            [FLOOR_CUP_ID]: objectGraph(FLOOR_CUP_ID, 'PRESENCE#floor-cup-on-saucer', FLOOR_SAUCER_ID, 'PRESENCE#floor-saucer-in-room'),
        },
        containers: {
            [CHARACTER_ID]: [ROOM_ID],
            [TABLE_ID]: [ROOM_ID],
            [TABLE_SAUCER_ID]: [TABLE_ID],
            [TABLE_CUP_ID]: [TABLE_SAUCER_ID],
            [FLOOR_SAUCER_ID]: [ROOM_ID],
            [FLOOR_CUP_ID]: [FLOOR_SAUCER_ID],
        },
        names: { [TABLE_ID]: tableName, [TABLE_SAUCER_ID]: 'saucer', [TABLE_CUP_ID]: 'cup', [FLOOR_SAUCER_ID]: 'saucer', [FLOOR_CUP_ID]: 'cup' },
    })

    it('"take cup on saucer on table" takes the cup on the table\'s saucer, not the floor\'s, without asking', async () => {
        seedTwoStacks()

        const publish = await run('take cup on saucer on table')

        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)
        expect(await holds(CHARACTER_ID, TABLE_CUP_ID)).toBe(true)
        expect(await holds(TABLE_SAUCER_ID, TABLE_CUP_ID)).toBe(false)
        expect(await holds(FLOOR_SAUCER_ID, FLOOR_CUP_ID)).toBe(true)
        expect(await holds(TABLE_ID, TABLE_SAUCER_ID)).toBe(true)
        expect(await holds(ROOM_ID, FLOOR_SAUCER_ID)).toBe(true)
        expect(delivered(publish)).toEqual([expect.stringMatching(/ picks up cup$/)])
    })

    // No span names the table exactly, so exact-fill precedence prunes nothing and every merged
    // reading competes: a span's own extra words must cost it (the span's own extra words cost it).
    it('"take cup on saucer on table" with a "kitchen table" takes the cup on the table\'s saucer without asking', async () => {
        seedTwoStacks('kitchen table')

        const publish = await run('take cup on saucer on table')

        expect(await holds(CHARACTER_ID, TABLE_CUP_ID)).toBe(true)
        expect(await holds(TABLE_SAUCER_ID, TABLE_CUP_ID)).toBe(false)
        expect(await holds(FLOOR_SAUCER_ID, FLOOR_CUP_ID)).toBe(true)
        expect(delivered(publish)).toEqual([expect.stringMatching(/ picks up cup$/)])
    })

    it('"take cup from table" takes the cup on the table, not the one on the floor, on the fast path', async () => {
        seed({
            graphs: {
                [ROOM_ID]: roomGraph([[TABLE_ID, 'PRESENCE#table-in-room'], [FLOOR_CUP_ID, 'PRESENCE#floor-cup-in-room']]),
                [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID).addPresenceNode(rootBinding('PRESENCE#Base')),
                [TABLE_ID]: objectGraph(TABLE_ID, 'PRESENCE#table-in-room', ROOM_ID, undefined, [[TABLE_CUP_ID, 'PRESENCE#table-cup-on-table']]),
                [TABLE_CUP_ID]: objectGraph(TABLE_CUP_ID, 'PRESENCE#table-cup-on-table', TABLE_ID, 'PRESENCE#table-in-room'),
                [FLOOR_CUP_ID]: objectGraph(FLOOR_CUP_ID, 'PRESENCE#floor-cup-in-room', ROOM_ID),
            },
            containers: { [CHARACTER_ID]: [ROOM_ID], [TABLE_ID]: [ROOM_ID], [TABLE_CUP_ID]: [TABLE_ID], [FLOOR_CUP_ID]: [ROOM_ID] },
            names: { [TABLE_ID]: 'table', [TABLE_CUP_ID]: 'cup', [FLOOR_CUP_ID]: 'cup' },
        })

        const publish = await run('take cup from table')

        expect(await holds(CHARACTER_ID, TABLE_CUP_ID)).toBe(true)
        expect(await holds(TABLE_ID, TABLE_CUP_ID)).toBe(false)
        expect(await holds(ROOM_ID, FLOOR_CUP_ID)).toBe(true)
        expect(delivered(publish)).toEqual([expect.stringMatching(/ picks up cup$/)])
    })

    it('"take coin out box" reads the bare "out" as "out of" and takes the coin in the box', async () => {
        seed({
            graphs: {
                [ROOM_ID]: roomGraph([[BOX_ID, 'PRESENCE#box-in-room'], [FLOOR_COIN_ID, 'PRESENCE#floor-coin-in-room']]),
                [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID).addPresenceNode(rootBinding('PRESENCE#Base')),
                [BOX_ID]: objectGraph(BOX_ID, 'PRESENCE#box-in-room', ROOM_ID, undefined, [[BOX_COIN_ID, 'PRESENCE#box-coin-in-box']], 'In'),
                [BOX_COIN_ID]: objectGraph(BOX_COIN_ID, 'PRESENCE#box-coin-in-box', BOX_ID, 'PRESENCE#box-in-room'),
                [FLOOR_COIN_ID]: objectGraph(FLOOR_COIN_ID, 'PRESENCE#floor-coin-in-room', ROOM_ID),
            },
            containers: { [CHARACTER_ID]: [ROOM_ID], [BOX_ID]: [ROOM_ID], [BOX_COIN_ID]: [BOX_ID], [FLOOR_COIN_ID]: [ROOM_ID] },
            names: { [BOX_ID]: 'box', [BOX_COIN_ID]: 'coin', [FLOOR_COIN_ID]: 'coin' },
        })

        const publish = await run('take coin out box')

        expect(await holds(CHARACTER_ID, BOX_COIN_ID)).toBe(true)
        expect(await holds(BOX_ID, BOX_COIN_ID)).toBe(false)
        expect(await holds(ROOM_ID, FLOOR_COIN_ID)).toBe(true)
        expect(delivered(publish)).toEqual([expect.stringMatching(/ picks up coin$/)])
    })

    it('"put cup on saucer on table" on the fast path, with no Bedrock call: the cup is on no saucer, so the reading that puts it on the saucer on the table commits', async () => {
        const CUP_ID = FLOOR_CUP_ID
        seed({
            graphs: {
                [ROOM_ID]: roomGraph([[TABLE_ID, 'PRESENCE#table-in-room'], [CUP_ID, 'PRESENCE#cup-in-room']]),
                [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID).addPresenceNode(rootBinding('PRESENCE#Base')),
                [TABLE_ID]: objectGraph(TABLE_ID, 'PRESENCE#table-in-room', ROOM_ID, undefined, [[TABLE_SAUCER_ID, 'PRESENCE#saucer-on-table']]),
                [TABLE_SAUCER_ID]: objectGraph(TABLE_SAUCER_ID, 'PRESENCE#saucer-on-table', TABLE_ID, 'PRESENCE#table-in-room'),
                [CUP_ID]: objectGraph(CUP_ID, 'PRESENCE#cup-in-room', ROOM_ID),
            },
            containers: { [CHARACTER_ID]: [ROOM_ID], [TABLE_ID]: [ROOM_ID], [TABLE_SAUCER_ID]: [TABLE_ID], [CUP_ID]: [ROOM_ID] },
            names: { [TABLE_ID]: 'table', [TABLE_SAUCER_ID]: 'saucer', [CUP_ID]: 'cup' },
        })

        // The fast path runs the containment template's own pattern: every segmentation goes to Plan, the
        // one whose spans all match exactly is read, and Plan finds both readings of its flat skeleton.
        const publish = await run('put cup on saucer on table')

        expect(await holds(TABLE_SAUCER_ID, CUP_ID)).toBe(true)
        expect(await holds(ROOM_ID, CUP_ID)).toBe(false)
        expect(await holds(TABLE_ID, TABLE_SAUCER_ID)).toBe(true)
        expect(delivered(publish)).toEqual([expect.stringMatching(/ puts cup on saucer$/)])
    })
})
