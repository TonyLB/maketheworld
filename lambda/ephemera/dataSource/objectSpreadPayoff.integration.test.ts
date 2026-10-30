/**
 * Payoff test for the first sharing caller, a spread (the contract's
 * spread rule): "spread the rug over the table" lays the rug partly onto the table while it stays on the
 * floor, so its one presence binding sits under both the room's and the table's. Terminates at what
 * a player sees: the line narrated, `look table`, and the room header's object list. Then "take
 * rug" (the crude take rule) lifts it out of both hosts in one move.
 *
 * Real, in this order, following `objectContainmentInPayoff.integration.test.ts`'s harness (see its
 * header for the conventions): `parseCommand` with its two Bedrock seams mocked, the bus crossing
 * as plain data, the real `commitAttempt` -> `commitStepSequence` against a mocked `ephemeraDB`
 * leaf, then `orchestrateRoomDescriptionStreams` for `look table`. The room's look is the room
 * header's read, `ludicCacheRoomObjectContents`, over a cold `buildLudicCache` of the committed
 * graphs (as `roomObjectContents.test.ts` stands in for the stored row).
 *
 * It also carries `tie` and `untie` (the SecuredTo templates): the triple the tie writes, and the untie
 * that removes it, at the stored graph and the narrated line.
 *
 * The same harness carries the qualified-take payoffs ("get the cup on the table", "get the cloth on
 * the table", "get bag from table"): a phrase naming where an object is picks the object, or the part
 * of it, without asking, or refuses with a line that says why (the actions contract's "Qualifier").
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

import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
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
import { PositionAttemptAction } from './actions/commandAttempt/action'
import type { CommandAttemptData } from './actions/commandAttempt'
import { commitAttempt } from './positions/manipulation/commitAttempt'
import { parentsOf } from './positions/ludicGraph/presenceParent'
import { presenceBindingNode, testLudicGraph } from './positions/ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from './positions/ludicGraph'
import { buildLudicCache } from './positions/ludicCache/fold'
import { ludicCacheRoomObjectContents } from './positions/ludicCache/roomObjectContents'
import { ludicCacheRoomObjectHandles } from './positions/ludicCache/catalogHandles'
import { getHeldInventoryCatalogForCharacter } from './actions/heldInventoryCatalogForCharacter'
import type { RoomInPlayObjectCatalogEntry } from './actions/roomObjectCatalogForCharacter'
import { askRowPayload, selectQuestionFromConsult } from './actions/selectQuestion'
import { resumePersistentCommand } from './actions/persistentCommand/resume'
import { orchestrateRoomDescriptionStreams } from './perception/orchestrate'
import { newDirectIngressAddress, registerIngressSlot } from './messageOrchestration'
import type { EphemeraCacheDynamoItem } from './renderCache/baseClasses'
import { EPHEMERA_CACHE_PROVENANCE_AUTHORED } from './renderCache/baseClasses'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const ROOM_ID = 'ROOM#TestRoom' as EphemeraRoomId
const RUG_ID = 'OBJECT#Rug' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const NEXT_ROOM_ID = 'ROOM#NextRoom' as EphemeraRoomId
const ROPE_ID = 'OBJECT#Rope' as EphemeraObjectId
const CLOTH_ID = 'OBJECT#Cloth' as EphemeraObjectId
const PLATE_ID = 'OBJECT#Plate' as EphemeraObjectId
const CUP_ON_TABLE_ID = 'OBJECT#CupOnTable' as EphemeraObjectId
const CUP_ON_FLOOR_ID = 'OBJECT#CupOnFloor' as EphemeraObjectId
const BAG_ID = 'OBJECT#Bag' as EphemeraObjectId
const POLE_ID = 'OBJECT#Pole' as EphemeraObjectId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId
const VIEWER = 'CHARACTER#viewer' as const
const PERSPECTIVE_KEY = 'PERSPECTIVE#v1#abc123'
const CACHE_ID = 'CACHE#fixture-cache-1' as const

const SHORT_NAMES: Record<string, string> = { [RUG_ID]: 'rug', [TABLE_ID]: 'table', [CLOTH_ID]: 'cloth', [PLATE_ID]: 'plate', [ROPE_ID]: 'rope', [CUP_ON_TABLE_ID]: 'cup', [CUP_ON_FLOOR_ID]: 'cup', [BAG_ID]: 'bag', [POLE_ID]: 'pole' }

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

/**
 * Like `objectContainmentInPayoff.integration.test.ts`'s stand-in, it runs the real reducer, but
 * over each host's graph as of now (`internalCache`, which a commit updates), so a second command
 * sees the first one's writes.
 */
const makeTransactWriteMock = () => (
    jest.fn(async (items: any[]): Promise<void> => {
        const multiKeyItem = items.find((item) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
        if (!multiKeyItem) {
            return
        }
        const draft: Record<string, any> = {}
        for (const key of multiKeyItem.Keys as { EphemeraId: string; DataCategory: string }[]) {
            const graph = await internalCache.Positions.getLudicGraph(key.EphemeraId as any)
            draft[`${key.EphemeraId}#${key.DataCategory}`] = {
                EphemeraId: key.EphemeraId,
                DataCategory: key.DataCategory,
                ludicGraph: graph.toStored(),
            }
        }
        multiKeyItem.reducer(draft)
    })
)

type WorldObjects = readonly (readonly [EphemeraObjectId, string])[]

/**
 * A world of one room holding `objects` and the actor, each object's Base under the room's Base (whose
 * cover lists them all). Installs the mocks per test and returns the real parse, commit and room look.
 */
const useWorld = (objects: WorldObjects) => {
    beforeEach(() => {
        jest.clearAllMocks()
        let timestamp = 1_000_000_000_000
        mockGetCurrentTimestamp.mockImplementation(() => timestamp++)
        internalCache.clear()
        messageBus.clear()
        assetDBMock.getItems.mockResolvedValue([] as any)
        assetDBMock.query.mockResolvedValue([] as any)
        ephemeraDBMock.getItems.mockResolvedValue([] as any)

        for (const [objectId, shortName] of objects) {
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
                    ...objects.map(([universalKey]) => ({ tag: 'Object' as const, universalKey, hostingKind: 'In' as const })),
                    { tag: 'Character', universalKey: CHARACTER_ID },
                    presenceBindingNode(BASE_PRESENCE_ID, undefined, { members: objects.map(([host]) => ({ host, presence: BASE_PRESENCE_ID })) }),
                ],
                edges: [],
            }),
            ...Object.fromEntries(objects.map(([objectId]) => [
                objectId,
                testLudicGraph(objectId, { nodes: [{ tag: 'Object', universalKey: objectId }, presenceBindingNode(BASE_PRESENCE_ID, ROOM_ID)] }),
            ])),
            [CHARACTER_ID]: testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode(BASE_PRESENCE_ID)] }),
            [NEXT_ROOM_ID]: testLudicGraph(NEXT_ROOM_ID, { nodes: [presenceBindingNode(BASE_PRESENCE_ID)] }),
        }

        ephemeraDBMock.getItem.mockImplementation(async ({ Key }: any) => {
            const graph = initialGraphsByHost[Key.EphemeraId]
            if (graph && Key.DataCategory === 'LudicCache::Characters') {
                return Object.fromEntries([...graph.characterIds].map((characterId) => [characterId, []]))
            }
            if (graph && ['Meta::Room', 'Meta::Object', 'Meta::Character'].includes(Key.DataCategory)) {
                return { ludicGraph: graph.toStored() }
            }
            return undefined
        })
        ephemeraDBMock.transactWrite.mockImplementation(makeTransactWriteMock())
    })

    /**
     * A real parse, its positions reads answered by `containersOf` and the live graphs. `catalog` stands in for the
     * production one (`catalogFromCache`); the default carries no `presence` or `placement`, so nothing is ever asked by position.
     */
    const parseAny = async (command: string, containersOf: (id: string) => string[], catalog?: readonly RoomInPlayObjectCatalogEntry[], heldCatalog: readonly RoomInPlayObjectCatalogEntry[] = []) => {
        return parseCommand(
            {
                command,
                characterId: CHARACTER_ID,
                hostRoomId: ROOM_ID,
                roomObjectCatalog: catalog ?? objects.map(([objectId, name]) => ({ objectId, normalizedShortName: name })),
                heldInventoryCatalog: heldCatalog,
            },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({ success: true, body: '{"type":"Command","confidence":0.9}' }),
                objectManipulationPositionsReadDeps: {
                    getMembershipContainers: jest.fn().mockImplementation(async (id: string) => containersOf(id)),
                    getLudicGraph: (hostId: string) => internalCache.Positions.getLudicGraph(hostId as any),
                },
            }
        )
    }
    const parse = async (command: string, containersOf: (id: string) => string[], catalog?: readonly RoomInPlayObjectCatalogEntry[]) => {
        const parseResult = await parseAny(command, containersOf, catalog)
        if (!isParseCommandCommandAttemptResult(parseResult)) {
            throw new Error(`"${command}" did not parse to an attempt: ${JSON.stringify(parseResult)}`)
        }
        return parseResult
    }

    /** The room catalog as production builds it: the handles of a cold fold over the committed graphs, which carry `presence` and `placement`. */
    const catalogFromCache = async (): Promise<RoomInPlayObjectCatalogEntry[]> => (await ludicCacheRoomObjectHandles(ROOM_ID, {
        readLudicCache: async (roomId) => ({
            cache: (await buildLudicCache(roomId, [], { getLudicGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId), ...shortNameDeps })).cache,
            outcome: 'hit' as const,
        }),
    })).map(({ objectId, shortName, gloss, presence, placement }) => ({
        objectId,
        normalizedShortName: shortName,
        ...(gloss !== undefined ? { gloss } : {}),
        ...(presence !== undefined ? { presence } : {}),
        ...(placement !== undefined ? { placement } : {}),
    }))

    /** The held catalog as production builds it: what the character holds, read from its own graph, with the part in hand. */
    const heldCatalogFromCache = async (): Promise<RoomInPlayObjectCatalogEntry[]> => (await getHeldInventoryCatalogForCharacter(CHARACTER_ID, {
        getLudicGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId),
        getCharacterAssets: async () => [],
        getComponentAggregate: shortNameDeps.getComponentAggregate as any,
    })).entries

    /** The real commit, the attempt crossing the bus as plain data; positions' live hosts answered by `containersOf`. */
    const commit = async (attempt: CommandAttemptData, containersOf: (id: string) => string[]) => {
        const writeMessageBus = { publish: jest.fn() }
        const published = JSON.parse(JSON.stringify(attempt)) as CommandAttemptData
        jest.spyOn(internalCache.Positions, 'getMembershipContainers').mockImplementation(async (id) => containersOf(id) as any)
        await commitAttempt({
            attempt: CommandAttempt.fromJSON(published),
            characterId: CHARACTER_ID,
            messageBus: writeMessageBus as any,
            streamEvent: jest.fn().mockResolvedValue(undefined),
        })
        return writeMessageBus
    }

    /** The room header's object list over the committed graphs. */
    const roomObjects = async (roomId: EphemeraRoomId = ROOM_ID) => (await ludicCacheRoomObjectContents(roomId, ['ASSET#viewer'], {
        readLudicCache: async (roomId) => ({
            cache: (await buildLudicCache(roomId, [], { getLudicGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId), ...shortNameDeps })).cache,
            outcome: 'hit' as const,
        }),
        ...shortNameDeps,
    })).objects

    /** A command as production parses it (the catalog built from the committed graphs), whatever it answers: an attempt, or a question. */
    const ask = async (command: string, containersOf: (id: string) => string[]) => {
        const catalog = await catalogFromCache()
        return { catalog, consult: await parseAny(command, containersOf, catalog) }
    }
    /** What answering the option at `index` stores, applied to the row the question left (as `answerPending` merges it). */
    const answered = (consult: Awaited<ReturnType<typeof parseAny>>, index: number, command: string) => {
        let next = 0
        const question = selectQuestionFromConsult(consult as any, () => `option-${next++}`)!
        const row = askRowPayload(question, { messageId: 'MESSAGE#1', createdTime: 1, command, sessionId: 's' })
        const { pending, ...rest } = row
        const optionId = `option-${index}`
        return { question, payload: { ...rest, referentAnswers: pending!.options[optionId]!, viewAnswers: pending!.views?.[optionId] } }
    }
    /** The question's option labels, then the command resumed at the option at `index`: the attempt the player's answer makes. */
    const resumeAt = async (consult: Awaited<ReturnType<typeof parseAny>>, index: number, command: string, catalog: readonly RoomInPlayObjectCatalogEntry[], containersOf: (id: string) => string[]) => {
        const { payload } = answered(consult, index, command)
        const resumed = await resumePersistentCommand(payload as any, { characterId: CHARACTER_ID, hostRoomId: ROOM_ID, roomObjectCatalog: catalog, heldInventoryCatalog: [] }, {
            positionsReadDeps: {
                getMembershipContainers: async (id: string) => containersOf(id) as any,
                getLudicGraph: (hostId: string) => internalCache.Positions.getLudicGraph(hostId as any),
            } as any,
        })
        if (resumed.type !== 'CommandAttempt') {
            throw new Error(`"${command}" did not resume to an attempt: ${JSON.stringify(resumed)}`)
        }
        return resumed as unknown as { attempt: CommandAttemptData }
    }
    const optionLabels = (consult: Awaited<ReturnType<typeof parseAny>>, command: string) => answered(consult, 0, command).question.outcome.Options.map(({ Label }) => Label)

    return { parse, parseAny, commit, roomObjects, catalogFromCache, heldCatalogFromCache, ask, resumeAt, optionLabels }
}

/** The world lines a commit narrated, from the bus it published to. */
const narratedLines = (writeMessageBus: { publish: jest.Mock }): string[] => writeMessageBus.publish.mock.calls
    .map((call: any[]) => call[0])
    .filter((message: any) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')
    .map((message: any) => message.message.join(''))

describe('object spread payoff (integration)', () => {
    const { parse, commit, roomObjects, ask, resumeAt, optionLabels } = useWorld([[RUG_ID, 'rug'], [TABLE_ID, 'table']])

    const beforeSpread = (id: string) => (id === RUG_ID || id === TABLE_ID || id === CHARACTER_ID ? [ROOM_ID] : [])
    const afterSpread = (id: string) => (id === RUG_ID ? [ROOM_ID, TABLE_ID] : beforeSpread(id))

    it('a real "spread the rug over the table" leaves the rug in both hosts, and shows it from both', async () => {
        // Step A: real parse.
        const parseResult = await parse('spread the rug over the table', beforeSpread)
        const [extend, transfer] = CommandAttempt.fromJSON(parseResult.attempt).actions().map((action) => action.desiredResult)
        expect(extend).toMatchObject({ primitive: 'extend', object: { groundedId: RUG_ID } })
        expect(transfer).toMatchObject({
            primitive: 'transferMembership',
            containment: 'On',
            object: { groundedId: RUG_ID, view: [PresenceKey((extend as { presenceUuid: string }).presenceUuid)] },
            to: { groundedId: TABLE_ID },
        })

        // Step B: real commit, the attempt crossing the bus as plain data.
        const writeMessageBus = await commit(parseResult.attempt, beforeSpread)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)

        const lines = writeMessageBus.publish.mock.calls
            .map((call: any[]) => call[0])
            .filter((message: any) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')
            .map((message: any) => message.message.join(''))
        expect(lines).toEqual([expect.stringMatching(/ spreads rug over table$/)])

        // The rug is in both hosts, through two connected bindings: one under the room, one under the table.
        const [roomGraph, tableGraph, rugGraph] = await Promise.all([ROOM_ID, TABLE_ID, RUG_ID].map((hostId) => internalCache.Positions.getLudicGraph(hostId)))
        expect(roomGraph.nodeIds.has(RUG_ID)).toBe(true)
        expect(tableGraph.nodeIds.has(RUG_ID)).toBe(true)
        const rugBindings = rugGraph.presenceNodes
        expect(rugBindings).toHaveLength(2)
        expect(rugBindings.flatMap((binding) => parentsOf(binding).map(({ host }) => host)).sort()).toEqual([ROOM_ID, TABLE_ID].sort())
        expect(rugGraph.relationalEdges.map(({ kind }) => kind)).toEqual(['ConnectedTo'])

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
        // The rug is listed twice, as a room-level object and as the table's content: its two
        // bindings sit under the room and under the table, and the header reads each cover forward.
        expect(await roomObjects()).toEqual([
            { objectId: RUG_ID, shortName: 'rug', contents: [] },
            { objectId: TABLE_ID, shortName: 'table', contents: [{ objectId: RUG_ID, shortName: 'rug' }] },
        ])
    })

    /** The rug spread over the table, then `take rug` asked (both parts reach the room) and answered at `index`. */
    const takeRugAnswering = async (index: number) => {
        await commit((await parse('spread the rug over the table', beforeSpread)).attempt, beforeSpread)
        const { catalog, consult } = await ask('take rug', afterSpread)
        const labels = optionLabels(consult, 'take rug')
        const resumed = await resumeAt(consult, index, 'take rug', catalog, afterSpread)
        await commit(resumed.attempt, afterSpread)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(2)
        return labels
    }

    it('then "take rug" asks which part, and "both parts" lifts it out of both hosts in one move', async () => {
        expect(await takeRugAnswering(2)).toEqual([['the rug in the room'], ['the rug on the table'], ['both parts of the rug']])

        // Out of the room and off the table, and in hand, its two bindings joined into one.
        const [roomGraph, tableGraph, rugGraph, characterGraph] = await Promise.all([ROOM_ID, TABLE_ID, RUG_ID, CHARACTER_ID].map((hostId) => internalCache.Positions.getLudicGraph(hostId)))
        expect(roomGraph.nodeIds.has(RUG_ID)).toBe(false)
        expect(tableGraph.nodeIds.has(RUG_ID)).toBe(false)
        expect(characterGraph.nodeIds.has(RUG_ID)).toBe(true)
        expect(tableGraph.relationalEdges).toEqual([])
        expect(rugGraph.relationalEdges).toEqual([])
        expect(rugGraph.presenceNodes).toHaveLength(1)
        expect(parentsOf(rugGraph.presenceNodes[0]!).map(({ host }) => host)).toEqual([CHARACTER_ID])

        // Both of the room header's rug entries are gone.
        expect(await roomObjects()).toEqual([{ objectId: TABLE_ID, shortName: 'table', contents: [] }])
    })

    it('then taking the part in the room leaves the part on the table, still connected (PR-5)', async () => {
        await takeRugAnswering(0)

        const [roomGraph, tableGraph, rugGraph, characterGraph] = await Promise.all([ROOM_ID, TABLE_ID, RUG_ID, CHARACTER_ID].map((hostId) => internalCache.Positions.getLudicGraph(hostId)))
        expect(roomGraph.nodeIds.has(RUG_ID)).toBe(false)
        expect(tableGraph.nodeIds.has(RUG_ID)).toBe(true)
        expect(characterGraph.nodeIds.has(RUG_ID)).toBe(true)
        expect(rugGraph.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host)).sort()).toEqual([CHARACTER_ID, TABLE_ID].sort())
        expect(rugGraph.relationalEdges.map(({ kind }) => kind)).toEqual(['ConnectedTo'])

        // The room's look: the rug is no longer on the floor, and is still the table's content.
        expect(await roomObjects()).toEqual([{ objectId: TABLE_ID, shortName: 'table', contents: [{ objectId: RUG_ID, shortName: 'rug' }] }])
    })

    it('then taking the part on the table leaves the part in the room, still connected (PR-5)', async () => {
        await takeRugAnswering(1)

        const [roomGraph, tableGraph, rugGraph] = await Promise.all([ROOM_ID, TABLE_ID, RUG_ID].map((hostId) => internalCache.Positions.getLudicGraph(hostId)))
        expect(roomGraph.nodeIds.has(RUG_ID)).toBe(true)
        expect(tableGraph.nodeIds.has(RUG_ID)).toBe(false)
        expect(rugGraph.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host)).sort()).toEqual([CHARACTER_ID, ROOM_ID].sort())
        expect(rugGraph.relationalEdges.map(({ kind }) => kind)).toEqual(['ConnectedTo'])
        expect(await roomObjects()).toEqual([
            { objectId: RUG_ID, shortName: 'rug', contents: [] },
            { objectId: TABLE_ID, shortName: 'table', contents: [] },
        ])
    })
})

describe('cloth draped over a table (integration)', () => {
    const { parse, commit, ask, resumeAt, optionLabels } = useWorld([[CLOTH_ID, 'cloth'], [TABLE_ID, 'table'], [PLATE_ID, 'plate']])

    const beforeDrape = (id: string) => (id === CLOTH_ID || id === TABLE_ID || id === PLATE_ID || id === CHARACTER_ID ? [ROOM_ID] : [])
    const afterDrape = (id: string) => (id === CLOTH_ID ? [ROOM_ID, TABLE_ID] : beforeDrape(id))

    /** The cloth draped, then `put the plate on the cloth` asked (the cloth has two parts) and answered at `index`. */
    const putPlateAnswering = async (index: number) => {
        await commit((await parse('drape the cloth over the table', beforeDrape)).attempt, beforeDrape)

        const { catalog, consult } = await ask('put the plate on the cloth', afterDrape)
        const labels = optionLabels(consult, 'put the plate on the cloth')
        const resumed = await resumeAt(consult, index, 'put the plate on the cloth', catalog, afterDrape)
        await commit(resumed.attempt, afterDrape)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(2)

        const clothGraph = await internalCache.Positions.getLudicGraph(CLOTH_ID)
        const [onFloor, onTable] = [ROOM_ID, TABLE_ID].map((host) => clothGraph.presenceNodes.find((binding) => parentsOf(binding).some((parent) => parent.host === host))!)
        return { labels, onFloor, onTable }
    }

    it('asks which part of the cloth the plate goes on, offering the parts and not the whole', async () => {
        const { labels } = await putPlateAnswering(1)

        expect(labels).toEqual([['the cloth in the room'], ['the cloth on the table']])
    })

    it('puts the plate in the cover of the part on the table when that part is chosen', async () => {
        const { onFloor, onTable } = await putPlateAnswering(1)

        expect(onTable.cover.members.map(({ host }) => host)).toEqual([PLATE_ID])
        expect(onFloor.cover.members).toEqual([])
    })

    it('puts the plate in the cover of the part in the room when that part is chosen', async () => {
        const { onFloor, onTable } = await putPlateAnswering(0)

        expect(onFloor.cover.members.map(({ host }) => host)).toEqual([PLATE_ID])
        expect(onTable.cover.members).toEqual([])
    })
})

describe('rope carried into the next room (integration)', () => {
    const { commit, roomObjects, ask, parseAny, catalogFromCache, heldCatalogFromCache } = useWorld([[ROPE_ID, 'rope']])

    /**
     * `[extend rope, move the new end into the next room]`, as the plan layer will state it once a
     * command can name the far room: no template reaches it yet, so the attempt is built by hand and
     * crosses the bus as plain data like any other.
     */
    const carryEndAttempt = (): CommandAttemptData => CommandAttempt.create('spread', 'carry the rope end into the next room', [
        new PositionAttemptAction('extend-rope', [], {
            kind: 'change',
            primitive: 'extend',
            object: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef', groundedId: ROPE_ID, shortName: 'rope' },
            presenceUuid: 'far-end',
        }),
        new PositionAttemptAction('move-end', [], {
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef', groundedId: ROPE_ID, shortName: 'rope', view: [PresenceKey('far-end')] },
            from: { referentType: 'graphNode', groundedId: ROOM_ID },
            to: { referentType: 'graphNode', groundedId: NEXT_ROOM_ID },
        }),
    ]).toJSON()
    const containersOf = (id: string) => (id === ROPE_ID || id === CHARACTER_ID ? [ROOM_ID] : [])

    it('shows the rope in both rooms, with its two ends connected', async () => {
        await commit(carryEndAttempt(), containersOf)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)

        expect((await roomObjects(ROOM_ID)).map(({ objectId }) => objectId)).toEqual([ROPE_ID])
        expect((await roomObjects(NEXT_ROOM_ID)).map(({ objectId }) => objectId)).toEqual([ROPE_ID])

        const ropeGraph = await internalCache.Positions.getLudicGraph(ROPE_ID)
        expect(ropeGraph.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host)).sort()).toEqual([ROOM_ID, NEXT_ROOM_ID].sort())
        expect(ropeGraph.relationalEdges.map(({ kind }) => kind)).toEqual(['ConnectedTo'])
    })

    it('then a real "take rope" takes the end in the actor\'s room unasked, and leaves the far end connected (PR-2, PR-5)', async () => {
        await commit(carryEndAttempt(), containersOf)

        const afterCarry = (id: string) => (id === ROPE_ID ? [ROOM_ID, NEXT_ROOM_ID] : containersOf(id))
        const { catalog, consult } = await ask('take rope', afterCarry)
        expect(consult).toMatchObject({ type: 'CommandAttempt' })
        await commit((consult as any).attempt, afterCarry)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(2)
        expect(catalog.find(({ objectId }) => objectId === ROPE_ID)?.placement).toBeDefined()

        const ropeGraph = await internalCache.Positions.getLudicGraph(ROPE_ID)
        expect(ropeGraph.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host)).sort()).toEqual([CHARACTER_ID, NEXT_ROOM_ID].sort())
        expect(ropeGraph.relationalEdges.map(({ kind }) => kind)).toEqual(['ConnectedTo'])
        expect((await roomObjects(ROOM_ID)).map(({ objectId }) => objectId)).toEqual([])
        expect((await roomObjects(NEXT_ROOM_ID)).map(({ objectId }) => objectId)).toEqual([ROPE_ID])
    })

    it('then "drop rope" drops the end in hand where the actor stands, and the far end stays connected (PR-5)', async () => {
        await commit(carryEndAttempt(), containersOf)
        const afterCarry = (id: string) => (id === ROPE_ID ? [ROOM_ID, NEXT_ROOM_ID] : containersOf(id))
        const taken = await ask('take rope', afterCarry)
        await commit((taken.consult as any).attempt, afterCarry)

        // The end in hand is the held catalog's; the room's catalog no longer reaches the rope at all.
        const afterTake = (id: string) => (id === ROPE_ID ? [CHARACTER_ID, NEXT_ROOM_ID] : containersOf(id))
        const dropped = await parseAny('drop rope', afterTake, await catalogFromCache(), await heldCatalogFromCache())
        expect(dropped).toMatchObject({ type: 'CommandAttempt' })
        await commit((dropped as any).attempt, afterTake)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(3)

        const ropeGraph = await internalCache.Positions.getLudicGraph(ROPE_ID)
        expect(ropeGraph.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host)).sort()).toEqual([ROOM_ID, NEXT_ROOM_ID].sort())
        expect(ropeGraph.relationalEdges.map(({ kind }) => kind)).toEqual(['ConnectedTo'])
        expect((await roomObjects(ROOM_ID)).map(({ objectId }) => objectId)).toEqual([ROPE_ID])
        expect((await roomObjects(NEXT_ROOM_ID)).map(({ objectId }) => objectId)).toEqual([ROPE_ID])
    })
})

describe('rope held at one end, the other on the floor of the same room (integration)', () => {
    const { commit, ask, parseAny, catalogFromCache, heldCatalogFromCache } = useWorld([[ROPE_ID, 'rope']])

    /** `[extend rope, move the new end into the actor's hands]`, built by hand as the carry into the next room is. */
    const holdEndAttempt = (): CommandAttemptData => CommandAttempt.create('spread', 'pick up one end of the rope', [
        new PositionAttemptAction('extend-rope', [], {
            kind: 'change',
            primitive: 'extend',
            object: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef', groundedId: ROPE_ID, shortName: 'rope' },
            presenceUuid: 'held-end',
        }),
        new PositionAttemptAction('hold-end', [], {
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef', groundedId: ROPE_ID, shortName: 'rope', view: [PresenceKey('held-end')] },
            from: { referentType: 'graphNode', groundedId: ROOM_ID },
            to: { referentType: 'graphNode', groundedId: CHARACTER_ID },
        }),
    ]).toJSON()
    const beforeHold = (id: string) => (id === ROPE_ID || id === CHARACTER_ID ? [ROOM_ID] : [])
    const holding = (id: string) => (id === ROPE_ID ? [ROOM_ID, CHARACTER_ID] : beforeHold(id))
    const movedView = (result: unknown) => CommandAttempt.fromJSON((result as { attempt: CommandAttemptData }).attempt).actions()
        .map((action) => action.desiredResult)
        .flatMap((step) => (step?.kind === 'change' && step.primitive === 'transferMembership' && step.object.referentType === 'objectSpan' ? [step.object.view] : []))

    beforeEach(async () => {
        await commit(holdEndAttempt(), beforeHold)
        const ropeGraph = await internalCache.Positions.getLudicGraph(ROPE_ID)
        expect(ropeGraph.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host)).sort()).toEqual([CHARACTER_ID, ROOM_ID].sort())
    })

    it('"take rope" takes the end on the floor without asking: taking the end in hand is not something the take can do', async () => {
        const { consult } = await ask('take rope', holding)

        expect(consult).toMatchObject({ type: 'CommandAttempt' })
        expect(movedView(consult)).toEqual([[PresenceKey('Base')]])
    })

    it('"drop rope" drops the end in hand without asking: dropping the end on the floor is not something the drop can do', async () => {
        const dropped = await parseAny('drop rope', holding, await catalogFromCache(), await heldCatalogFromCache())

        expect(dropped).toMatchObject({ type: 'CommandAttempt' })
        expect(movedView(dropped)).toEqual([[PresenceKey('held-end')]])
    })
})

describe('asking which part of a draped cloth (integration)', () => {
    const { parse, parseAny, commit, catalogFromCache } = useWorld([[CLOTH_ID, 'cloth'], [TABLE_ID, 'table']])

    const beforeDrape = (id: string) => (id === CLOTH_ID || id === TABLE_ID || id === CHARACTER_ID ? [ROOM_ID] : [])
    const afterDrape = (id: string) => (id === CLOTH_ID ? [ROOM_ID, TABLE_ID] : beforeDrape(id))
    const positionsReadDeps = {
        getMembershipContainers: async (id: string) => afterDrape(id) as any,
        getLudicGraph: (hostId: string) => internalCache.Positions.getLudicGraph(hostId as any),
    }

    const askTake = async () => {
        await commit((await parse('drape the cloth over the table', beforeDrape)).attempt, beforeDrape)
        const catalog = await catalogFromCache()
        const consult = await parseAny('take cloth', afterDrape, catalog)
        return { catalog, consult }
    }
    /** What answering the option at `index` stores, applied to the row the question left (as `answerPending` merges it). */
    const answered = (consult: Awaited<ReturnType<typeof parseAny>>, index: number) => {
        let next = 0
        const question = selectQuestionFromConsult(consult as any, () => `option-${next++}`)!
        const row = askRowPayload(question, { messageId: 'MESSAGE#1', createdTime: 1, command: 'take cloth', sessionId: 's' })
        const { pending, ...rest } = row
        const optionId = `option-${index}`
        return { question, payload: { ...rest, referentAnswers: pending!.options[optionId]!, viewAnswers: pending!.views?.[optionId] } }
    }

    it('asks which part of the cloth, by position, with the whole as the last option', async () => {
        const { consult } = await askTake()

        expect(consult).toMatchObject({ type: 'Consult' })
        const { question } = answered(consult, 0)
        expect(question.outcome.Options.map(({ Label }) => Label)).toEqual([['the cloth in the room'], ['the cloth on the table'], ['both parts of the cloth']])
    })

    it.each([
        [0, [TABLE_ID]],
        [1, [ROOM_ID]],
        [2, []],
    ])('resumes the answer at option %i as a take of that part, which leaves where the rest stays', async (index, staysIn) => {
        const { catalog, consult } = await askTake()
        const { payload } = answered(consult, index)

        const resumed = await resumePersistentCommand(payload as any, { characterId: CHARACTER_ID, hostRoomId: ROOM_ID, roomObjectCatalog: catalog, heldInventoryCatalog: [] }, { positionsReadDeps: positionsReadDeps as any })

        expect(resumed).toMatchObject({ type: 'CommandAttempt' })
        const [step] = CommandAttempt.fromJSON((resumed as any).attempt).actions().map((action) => action.desiredResult)
        expect(step).toMatchObject({ primitive: 'transferMembership', object: { groundedId: CLOTH_ID } })
        // The whole is every own binding of the cloth.
        expect((step as any).object.view).toHaveLength(index === 2 ? 2 : 1)

        // The take moves the part chosen into the hand and leaves the rest where it was.
        await commit((resumed as any).attempt, afterDrape)
        const clothGraph = await internalCache.Positions.getLudicGraph(CLOTH_ID)
        expect(clothGraph.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host)).sort()).toEqual([CHARACTER_ID, ...staysIn].sort())
    })

    it('"get the cloth on the table" takes the part on the table without asking, and the hanging part stays', async () => {
        await commit((await parse('drape the cloth over the table', beforeDrape)).attempt, beforeDrape)

        // The fast path claims it, and the dry run's check rules out the hanging part and the whole.
        const result = await parseAny('get the cloth on the table', afterDrape, await catalogFromCache())
        expect(result).toMatchObject({ type: 'CommandAttempt' })

        const writeMessageBus = await commit((result as any).attempt, afterDrape)
        expect(narratedLines(writeMessageBus)).toEqual([expect.stringMatching(/ picks up cloth$/)])
        const clothGraph = await internalCache.Positions.getLudicGraph(CLOTH_ID)
        expect(clothGraph.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host)).sort()).toEqual([CHARACTER_ID, ROOM_ID].sort())
        expect(clothGraph.relationalEdges.map(({ kind }) => kind)).toEqual(['ConnectedTo'])
    })

    it('does not ask when only one position of the cloth reaches the actor\'s room', async () => {
        // A catalog entry whose second position sits in another room: the actor's own position picks the first.
        const { catalog } = await askTake()
        const cloth = catalog.find(({ objectId }) => objectId === CLOTH_ID)!
        const [first, second] = cloth.placement!.find(({ host }) => host === CLOTH_ID)!.bindings
        const oneEnd = catalog.map((entry) => (entry.objectId === CLOTH_ID
            ? { ...entry, placement: [{ host: CLOTH_ID, bindings: [first!, { ...second!, rooms: [NEXT_ROOM_ID] }] }] }
            : entry))

        const result = await parseAny('take cloth', afterDrape, oneEnd as RoomInPlayObjectCatalogEntry[])

        expect(result).toMatchObject({ type: 'CommandAttempt' })
    })
})

describe('two cups, one on the table: a qualified take (integration)', () => {
    const { parse, parseAny, commit, roomObjects, catalogFromCache } = useWorld([[CUP_ON_TABLE_ID, 'cup'], [CUP_ON_FLOOR_ID, 'cup'], [TABLE_ID, 'table']])

    const beforePut = (id: string) => ([CUP_ON_TABLE_ID, CUP_ON_FLOOR_ID, TABLE_ID, CHARACTER_ID].includes(id as any) ? [ROOM_ID] : [])
    const afterPut = (id: string) => (id === CUP_ON_TABLE_ID ? [TABLE_ID] : beforePut(id))

    /** Setup: one cup put on the table for real (the put's catalog holds only that cup, so the setup does not ask). */
    beforeEach(async () => {
        const onlyThatCup = [{ objectId: CUP_ON_TABLE_ID, normalizedShortName: 'cup' }, { objectId: TABLE_ID, normalizedShortName: 'table' }]
        await commit((await parse('put the cup on the table', beforePut, onlyThatCup)).attempt, beforePut)
        expect(await roomObjects()).toEqual([
            { objectId: CUP_ON_FLOOR_ID, shortName: 'cup', contents: [] },
            { objectId: TABLE_ID, shortName: 'table', contents: [{ objectId: CUP_ON_TABLE_ID, shortName: 'cup' }] },
        ])
    })

    it('"get the cup on the table" picks up the cup on the table without asking', async () => {
        const result = await parseAny('get the cup on the table', afterPut, await catalogFromCache())
        expect(result).toMatchObject({ type: 'CommandAttempt' })

        const writeMessageBus = await commit((result as any).attempt, afterPut)
        expect(narratedLines(writeMessageBus)).toEqual([expect.stringMatching(/ picks up cup$/)])
        const [cupOnTable, cupOnFloor] = await Promise.all([CUP_ON_TABLE_ID, CUP_ON_FLOOR_ID].map((id) => internalCache.Positions.getLudicGraph(id)))
        expect(cupOnTable.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host))).toEqual([CHARACTER_ID])
        expect(cupOnFloor.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host))).toEqual([ROOM_ID])

        // The room's look: the cup on the floor stays, and the table is empty.
        expect(await roomObjects()).toEqual([
            { objectId: CUP_ON_FLOOR_ID, shortName: 'cup', contents: [] },
            { objectId: TABLE_ID, shortName: 'table', contents: [] },
        ])
    })
})

describe('one bag, on the floor: a qualifier that matches nothing (integration)', () => {
    const { parseAny, roomObjects, catalogFromCache } = useWorld([[BAG_ID, 'bag'], [TABLE_ID, 'table']])
    const onTheFloor = (id: string) => ([BAG_ID, TABLE_ID, CHARACTER_ID].includes(id as any) ? [ROOM_ID] : [])

    it('"get bag from table" refuses with a line that says why, and changes nothing', async () => {
        const before = await roomObjects()

        const result = await parseAny('get bag from table', onTheFloor, await catalogFromCache())

        expect(result).toEqual({ type: 'Error', errorMessage: 'The table has no bag.' })
        expect(ephemeraDBMock.transactWrite).not.toHaveBeenCalled()
        expect(await roomObjects()).toEqual(before)
    })
})

describe('tie and untie (integration)', () => {
    const { parse, parseAny, commit } = useWorld([[ROPE_ID, 'rope'], [POLE_ID, 'pole']])
    const onTheFloor = (id: string) => (id === ROPE_ID || id === POLE_ID || id === CHARACTER_ID ? [ROOM_ID] : [])
    const roomEdges = async () => (await internalCache.Positions.getLudicGraph(ROOM_ID)).relationalEdges

    it('"tie the rope to the pole" leaves exactly the tie triple, under the ids the attempt minted; "untie" leaves nothing', async () => {
        const tie = await parse('tie the rope to the pole', onTheFloor)
        const [assign] = CommandAttempt.fromJSON(tie.attempt).actions().map((action) => action.desiredResult)
        if (assign?.kind !== 'change' || assign.primitive !== 'assignEdgeRelations') {
            throw new Error('expected an assignEdgeRelations')
        }
        const { tyingEdge, secureEdge } = assign.mintedEdgeIds

        expect(narratedLines(await commit(tie.attempt, onTheFloor))).toEqual([expect.stringMatching(/ ties rope to pole$/)])
        expect(await roomEdges()).toEqual([
            { from: ROPE_ID, to: POLE_ID, kind: 'Custom', relationLabel: 'tied to', edgeId: tyingEdge },
            { from: ROPE_ID, to: POLE_ID, kind: 'SecuredTo', edgeId: secureEdge },
            { from: { edgeId: tyingEdge }, to: { edgeId: secureEdge }, kind: 'Justifies' },
        ])

        expect(await parseAny('tie the rope to the pole', onTheFloor)).toEqual({ type: 'Error', errorMessage: 'The rope is already tied to the pole.' })
        expect(await parseAny('untie the pole from the rope', onTheFloor)).toEqual({ type: 'Error', errorMessage: 'The pole is not tied to the rope.' })

        const untie = await parse('untie the rope from the pole', onTheFloor)
        expect(narratedLines(await commit(untie.attempt, onTheFloor))).toEqual([expect.stringMatching(/ unties rope from pole$/)])
        expect(await roomEdges()).toEqual([])
        expect(await parseAny('untie the rope from the pole', onTheFloor)).toEqual({ type: 'Error', errorMessage: 'The rope is not tied to the pole.' })
    })

    it('a tied thing cannot be taken (either end), and an untie frees it: "take the rope" is refused with the secured wording, then succeeds', async () => {
        const catalog = await (async () => [
            { objectId: ROPE_ID, normalizedShortName: 'rope' },
            { objectId: POLE_ID, normalizedShortName: 'pole' },
        ])()
        await commit((await parse('tie the rope to the pole', onTheFloor)).attempt, onTheFloor)
        const tiedEdges = await roomEdges()
        ephemeraDBMock.transactWrite.mockClear()

        for (const command of ['take the rope', 'take the pole']) {
            const refused = await parseAny(command, onTheFloor, catalog)
            expect(refused).toMatchObject({ type: 'Abstain', reason: expect.stringMatching(/^Secured: /) })
        }
        expect(ephemeraDBMock.transactWrite).not.toHaveBeenCalled()
        expect(await roomEdges()).toEqual(tiedEdges)

        await commit((await parse('untie the rope from the pole', onTheFloor)).attempt, onTheFloor)
        const taken = await parseAny('take the rope', onTheFloor, catalog)
        expect(taken).toMatchObject({ type: 'CommandAttempt' })
        expect(narratedLines(await commit((taken as any).attempt, onTheFloor))).toEqual([expect.stringMatching(/ picks up rope$/)])
    })
})
