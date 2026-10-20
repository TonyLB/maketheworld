/**
 * Payoff test for the first sharing caller, a spread (presenceParentSets Slice 7(c), (d), (f);
 * PS-4): "spread the rug over the table" lays the rug partly onto the table while it stays on the
 * floor, so its one presence binding sits under both the room's and the table's. Terminates at what
 * a player sees: the line narrated, `look table`, and the room header's object list.
 *
 * Real, in this order, following `objectContainmentInPayoff.integration.test.ts`'s harness (see its
 * header for the conventions): `parseCommand` with its two Bedrock seams mocked, the bus crossing
 * as plain data, the real `commitAttempt` -> `commitStepSequence` against a mocked `ephemeraDB`
 * leaf, then `orchestrateRoomDescriptionStreams` for `look table`. The room's look is the room
 * header's read, `ludicCacheRoomObjectContents`, over a cold `buildLudicCache` of the committed
 * graphs (as `roomObjectContents.test.ts` stands in for the stored row).
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
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardObject from '@tonylb/mtw-wml/ts/standardize/components/object'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { parseCommand } from './actions/parseCommand'
import { isParseCommandCommandAttemptResult } from './actions/baseClasses'
import { CommandAttempt } from './actions/commandAttempt'
import type { CommandAttemptData } from './actions/commandAttempt'
import { commitAttempt } from './positions/manipulation/commitAttempt'
import { parentsOf } from './positions/ludicGraph/presenceParent'
import { presenceBindingNode, testLudicGraph } from './positions/ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from './positions/ludicGraph'
import { buildLudicCache } from './positions/ludicCache/fold'
import { ludicCacheRoomObjectContents } from './positions/ludicCache/roomObjectContents'
import { orchestrateRoomDescriptionStreams } from './perception/orchestrate'
import { newDirectIngressAddress, registerIngressSlot } from './messageOrchestration'
import type { EphemeraCacheDynamoItem } from './renderCache/baseClasses'
import { EPHEMERA_CACHE_PROVENANCE_AUTHORED } from './renderCache/baseClasses'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const ROOM_ID = 'ROOM#TestRoom' as EphemeraRoomId
const RUG_ID = 'OBJECT#Rug' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId
const VIEWER = 'CHARACTER#viewer' as const
const PERSPECTIVE_KEY = 'PERSPECTIVE#v1#abc123'
const CACHE_ID = 'CACHE#fixture-cache-1' as const

const SHORT_NAMES: Record<string, string> = { [RUG_ID]: 'rug', [TABLE_ID]: 'table' }

/** Names for the cache's stored nodes and for the viewer's labels: the same per-object shortName. */
const shortNameDeps = {
    getComponentAggregate: jest.fn(async ([perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]) => {
        const name = SHORT_NAMES[perspective.universalKey]
        return name
            ? [mergedComponentResult({
                universalKey: perspective.universalKey as EphemeraObjectId,
                merged: new StandardObject({ tag: 'Object', shortName: name }),
                mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
            })]
            : []
    }),
}

const tableTerminalCacheRecord = (): EphemeraCacheDynamoItem => ({
    EphemeraId: TABLE_ID,
    DataCategory: CACHE_ID,
    markState: { markValue: [] },
    renderedContent: { displayName: ['oak table'], description: [] },
    provenance: { type: EPHEMERA_CACHE_PROVENANCE_AUTHORED },
    perspectiveId: 'perspective-id',
    perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
})

/** Same stand-in as `objectContainmentInPayoff.integration.test.ts`: runs the real reducer over the seeded graphs. */
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

describe('object spread payoff (integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        let timestamp = 1_000_000_000_000
        mockGetCurrentTimestamp.mockImplementation(() => timestamp++)
        internalCache.clear()
        messageBus.clear()
        assetDBMock.getItems.mockResolvedValue([] as any)
        assetDBMock.query.mockResolvedValue([] as any)
        ephemeraDBMock.getItems.mockResolvedValue([] as any)

        for (const [objectId, shortName] of [[RUG_ID, 'rug'], [TABLE_ID, 'table']] as const) {
            internalCache.ImprovisationComponentData.set(objectId, IMPROVISATION_ASSET_ID, new StandardObject({
                tag: 'Object',
                universalKey: objectId,
                shortName,
            }))
        }

        // The rug, the table and the actor are on the floor: each object's Base sits under the
        // room's Base, whose cover lists both. Neither object hosts anything yet.
        const initialGraphsByHost: Record<string, EphemeraLudicGraph> = {
            [ROOM_ID]: testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: RUG_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                    { tag: 'Character', universalKey: CHARACTER_ID },
                    presenceBindingNode(BASE_PRESENCE_ID, undefined, { members: [
                        { host: RUG_ID, presence: BASE_PRESENCE_ID },
                        { host: TABLE_ID, presence: BASE_PRESENCE_ID },
                    ] }),
                ],
                edges: [],
            }),
            [TABLE_ID]: testLudicGraph(TABLE_ID, { nodes: [{ tag: 'Object', universalKey: TABLE_ID }, presenceBindingNode(BASE_PRESENCE_ID, ROOM_ID)] }),
            [RUG_ID]: testLudicGraph(RUG_ID, { nodes: [{ tag: 'Object', universalKey: RUG_ID }, presenceBindingNode(BASE_PRESENCE_ID, ROOM_ID)] }),
        }

        ephemeraDBMock.getItem.mockImplementation(async ({ Key }: any) => {
            const graph = initialGraphsByHost[Key.EphemeraId]
            if (graph && Key.DataCategory === 'LudicCache::Characters') {
                return Object.fromEntries([...graph.characterIds].map((characterId) => [characterId, []]))
            }
            if (graph && (Key.DataCategory === 'Meta::Room' || Key.DataCategory === 'Meta::Object')) {
                return { ludicGraph: graph.toStored() }
            }
            return undefined
        })
        ephemeraDBMock.transactWrite.mockImplementation(makeTransactWriteMock(initialGraphsByHost))
    })

    it('a real "spread the rug over the table" leaves the rug in both hosts, and shows it from both', async () => {
        // Step A: real parse.
        const parseResult = await parseCommand(
            {
                command: 'spread the rug over the table',
                hostRoomId: ROOM_ID,
                roomObjectLabels: ['rug', 'table'],
                roomObjectCatalog: [
                    { objectId: RUG_ID, normalizedShortName: 'rug' },
                    { objectId: TABLE_ID, normalizedShortName: 'table' },
                ],
            },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({ success: true, body: '{"type":"Command","confidence":0.9}' }),
                invokeBedrockObjectManipulationParseImpl: jest.fn().mockResolvedValue({
                    success: true,
                    body: '{"tokens":[{"type":"text","text":"spread"},{"type":"objectSpan","span":"rug"},{"type":"text","text":"over"},{"type":"objectSpan","span":"table"}]}',
                }),
                objectManipulationPositionsReadDeps: {
                    getMembershipContainers: jest.fn().mockImplementation(async (id: string) => (
                        id === RUG_ID || id === TABLE_ID ? [ROOM_ID] : []
                    )),
                    getLudicGraph: (hostId: string) => internalCache.Positions.getLudicGraph(hostId as any),
                },
            }
        )

        expect(isParseCommandCommandAttemptResult(parseResult)).toBe(true)
        if (!isParseCommandCommandAttemptResult(parseResult)) {
            throw new Error('unreachable: asserted above')
        }
        const transfer = CommandAttempt.fromJSON(parseResult.attempt).actions().map((action) => action.desiredResult).find((step) => step?.kind === 'change')
        expect(transfer).toMatchObject({
            primitive: 'transferMembership',
            containment: 'On',
            keepFrom: true,
            object: { groundedId: RUG_ID },
            to: { groundedId: TABLE_ID },
        })

        // Step B: real commit, the attempt crossing the bus as plain data.
        const writeMessageBus = { publish: jest.fn() }
        const published = JSON.parse(JSON.stringify(parseResult.attempt)) as CommandAttemptData
        jest.spyOn(internalCache.Positions, 'getMembershipContainers').mockResolvedValue([ROOM_ID] as any)
        await commitAttempt({
            attempt: CommandAttempt.fromJSON(published),
            characterId: CHARACTER_ID,
            messageBus: writeMessageBus as any,
            streamEvent: jest.fn().mockResolvedValue(undefined),
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)

        const lines = writeMessageBus.publish.mock.calls
            .map((call: any[]) => call[0])
            .filter((message: any) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')
            .map((message: any) => message.message.join(''))
        expect(lines).toEqual([expect.stringMatching(/ spreads rug over table$/)])

        // The rug is in both hosts, through one binding under both.
        const [roomGraph, tableGraph, rugGraph] = await Promise.all([ROOM_ID, TABLE_ID, RUG_ID].map((hostId) => internalCache.Positions.getLudicGraph(hostId)))
        expect(roomGraph.nodeIds.has(RUG_ID)).toBe(true)
        expect(tableGraph.nodeIds.has(RUG_ID)).toBe(true)
        const rugBindings = rugGraph.presenceNodes
        expect(rugBindings).toHaveLength(1)
        expect(parentsOf(rugBindings[0]!).map(({ host }) => host).sort()).toEqual([ROOM_ID, TABLE_ID].sort())

        // Step C: `look table` names the rug.
        const publishSpy = jest.spyOn(messageBus, 'publish')
        await registerIngressSlot(messageBus, newDirectIngressAddress(), {
            componentId: TABLE_ID,
            perspectiveKey: PERSPECTIVE_KEY,
            targets: [VIEWER],
            contentStream: 'render',
            format: 'full',
        })
        await orchestrateRoomDescriptionStreams(
            {
                type: 'Render Pertains',
                componentId: TABLE_ID,
                perspectiveKey: PERSPECTIVE_KEY,
                cacheId: CACHE_ID,
                cacheRecord: tableTerminalCacheRecord(),
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()
        const tableLook = publishSpy.mock.calls.map((call) => call[0] as any).find((message) => message?.type === 'PublishMessage')
        expect(tableLook).toBeDefined()
        const tableWml = tableLook!.wmlContent as string
        const table = new StandardForm(tableWml, { standardizeMode: 'ephemeraWire' }).byUniversalId[TABLE_ID] as StandardObject
        expect(table.ludicGraph.nodes.componentRefs.payload.map((ref) => ref.universalKey)).toContain(RUG_ID)
        expect(tableWml).toContain('<ShortName>rug</ShortName>')

        // Step D: the room's look, the header's object list over the committed graphs.
        const { objects } = await ludicCacheRoomObjectContents(ROOM_ID, ['ASSET#viewer'], {
            readLudicCache: async (roomId) => ({
                cache: (await buildLudicCache(roomId, [], { getLudicGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId), ...shortNameDeps })).cache,
                outcome: 'hit' as const,
            }),
            ...shortNameDeps,
        })
        // Slice 7(f) finding, recorded for the user's call and not fixed here: the room lists the
        // rug twice, as a room-level object and as the table's content. Both parent bindings'
        // covers list its one binding, and the header reads each cover forward.
        expect(objects).toEqual([
            { objectId: RUG_ID, shortName: 'rug', contents: [] },
            { objectId: TABLE_ID, shortName: 'table', contents: [{ objectId: RUG_ID, shortName: 'rug' }] },
        ])
    })
})
