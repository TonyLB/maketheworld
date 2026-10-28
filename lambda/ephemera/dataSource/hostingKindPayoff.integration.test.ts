/**
 * Payoff test for hostingKindOnNode (Slice 4): a member's hosting kind lives on its node in the
 * host's graph and nowhere else, through a real take. Terminates at the committed graphs: the table
 * keeps no hosting residue once the cup is taken, the character holds the cup as `Held`, and a cup
 * `In` a box stays `In` the box when the box itself is taken. (The cache side, `hostingKind` on a
 * cover entry, is proven in `ludicCache/fold.test.ts`; the put-then-look render is proven by
 * `objectContainmentInPayoff.integration.test.ts`, which asserts the kind it commits.)
 *
 * Harness: `crossingTakePayoff.integration.test.ts` (real `parseCommand` with no Bedrock call, the
 * bus crossing as plain data, then the real `commitAttempt` against a mocked `ephemeraDB` leaf).
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

const ROOM_ID = 'ROOM#Bridge' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const BOX_ID = 'OBJECT#Box' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId

/** The entries a binding lists, each naming the member's own binding (a member without one is listed under `PRESENCE#Base`). */
const covering = (...members: ([EphemeraCharacterId | EphemeraObjectId, string?])[]) => ({
    members: members.map(([host, presence]) => ({ host, presence: (presence ?? 'PRESENCE#Base') as EphemeraPresenceNodeId })),
})
const fullBinding = (key: string, parentHost: EphemeraMembershipHostId, parentPresence?: string, cover: ReturnType<typeof covering> = { members: [] }) => ({ tag: 'Presence' as const, universalKey: key as EphemeraPresenceNodeId, fromHostPresences: [{ host: parentHost, presence: (parentPresence ?? parentRemainderKey(parentHost)) as EphemeraPresenceNodeId }], cover })
/** A hostless binding: the root a mover's presence write re-points. */
const rootBinding = (key: string, cover: ReturnType<typeof covering> = { members: [] }) => ({ tag: 'Presence' as const, universalKey: key as EphemeraPresenceNodeId, fromHostPresences: [], cover })

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

describe('hosting kind on the node, through a take (integration)', () => {
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

    /** "get <thing>" end to end: parse (no Bedrock), the bus crossing, then the real commit. Returns the commit's bus. */
    const get = async (command: string, labels: Array<[EphemeraObjectId, string]>): Promise<jest.Mock> => {
        const invokeBedrockParseCommandImpl = jest.fn()
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
            .filter((message: any) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')
            .sort((a: any, b: any) => a.createdTime - b.createdTime)
        const contents = reports.map((report: any) => ({ message: report }))
        return contents.map((content: any) => ({ line: content.message.message.join(''), targets: [...content.message.targets].sort() }))
    }

    it('"get cup" from the table: the table keeps no residue and the character holds the cup as Held', async () => {
        seed({
            graphs: {
                [ROOM_ID]: EphemeraLudicGraph.empty(ROOM_ID)
                    .addPresenceNode(rootBinding(parentRemainderKey(ROOM_ID), covering([CHARACTER_ID], [TABLE_ID, 'PRESENCE#table-in-bridge'])))
                    .addCharacter(CHARACTER_ID, 'In')
                    .addObject(TABLE_ID, 'In'),
                [TABLE_ID]: EphemeraLudicGraph.empty(TABLE_ID)
                    .addObject(CUP_ID, 'On')
                    .addPresenceNode(fullBinding('PRESENCE#table-in-bridge', ROOM_ID, undefined, covering([CUP_ID, 'PRESENCE#cup-on-table']))),
                [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID).addPresenceNode(rootBinding('PRESENCE#Base')),
                [CUP_ID]: EphemeraLudicGraph.empty(CUP_ID).addPresenceNode(fullBinding('PRESENCE#cup-on-table', TABLE_ID, 'PRESENCE#table-in-bridge')),
            },
            containers: { [CHARACTER_ID]: [ROOM_ID], [TABLE_ID]: [ROOM_ID], [CUP_ID]: [TABLE_ID] },
            names: { [TABLE_ID]: 'table', [CUP_ID]: 'cup' },
        })
        expect((await internalCache.Positions.getLudicGraph(TABLE_ID)).hostingKindOf(CUP_ID)).toBe('On')

        const publish = await get('get cup', [[CUP_ID, 'cup'], [TABLE_ID, 'table']])

        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)
        const tableGraph = await internalCache.Positions.getLudicGraph(TABLE_ID)
        expect(tableGraph.nodeIds.has(CUP_ID)).toBe(false)
        expect(tableGraph.relationalEdges).toEqual([])
        const characterGraph = await internalCache.Positions.getLudicGraph(CHARACTER_ID)
        expect(characterGraph.hostingKindOf(CUP_ID)).toBe('Held')
        expect(characterGraph.relationalEdges).toEqual([])
        expect(await delivered(publish)).toEqual([{ line: expect.stringMatching(/ picks up cup$/), targets: [CHARACTER_ID] }])
    })

    it('"get box" with a cup In it: the box is taken as Held and the cup stays In the box', async () => {
        seed({
            graphs: {
                [ROOM_ID]: EphemeraLudicGraph.empty(ROOM_ID)
                    .addPresenceNode(rootBinding(parentRemainderKey(ROOM_ID), covering([CHARACTER_ID], [BOX_ID, 'PRESENCE#box-in-bridge'])))
                    .addCharacter(CHARACTER_ID, 'In')
                    .addObject(BOX_ID, 'In'),
                [BOX_ID]: EphemeraLudicGraph.empty(BOX_ID)
                    .addObject(CUP_ID, 'In')
                    .addPresenceNode(fullBinding('PRESENCE#box-in-bridge', ROOM_ID, undefined, covering([CUP_ID, 'PRESENCE#cup-in-box']))),
                [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID).addPresenceNode(rootBinding('PRESENCE#Base')),
                [CUP_ID]: EphemeraLudicGraph.empty(CUP_ID).addPresenceNode(fullBinding('PRESENCE#cup-in-box', BOX_ID, 'PRESENCE#box-in-bridge')),
            },
            containers: { [CHARACTER_ID]: [ROOM_ID], [BOX_ID]: [ROOM_ID], [CUP_ID]: [BOX_ID] },
            names: { [BOX_ID]: 'box', [CUP_ID]: 'cup' },
        })

        await get('get box', [[BOX_ID, 'box'], [CUP_ID, 'cup']])

        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)
        const characterGraph = await internalCache.Positions.getLudicGraph(CHARACTER_ID)
        expect(characterGraph.hostingKindOf(BOX_ID)).toBe('Held')
        expect(characterGraph.nodeIds.has(CUP_ID)).toBe(false)
        const boxGraph = await internalCache.Positions.getLudicGraph(BOX_ID)
        expect(boxGraph.hostingKindOf(CUP_ID)).toBe('In')
        expect(boxGraph.relationalEdges).toEqual([])
    })
})
