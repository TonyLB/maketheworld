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
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId
const VIEWER = 'CHARACTER#viewer' as const
const PERSPECTIVE_KEY = 'PERSPECTIVE#v1#abc123'
const CACHE_ID = 'CACHE#fixture-cache-1' as const

const SHORT_NAMES: Record<string, string> = { [RUG_ID]: 'rug', [TABLE_ID]: 'table', [CLOTH_ID]: 'cloth', [PLATE_ID]: 'plate', [ROPE_ID]: 'rope' }

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
                    ...objects.map(([universalKey]) => ({ tag: 'Object' as const, universalKey })),
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
    const parseAny = async (command: string, tokens: string | undefined, containersOf: (id: string) => string[], catalog?: readonly RoomInPlayObjectCatalogEntry[]) => {
        return parseCommand(
            {
                command,
                characterId: CHARACTER_ID,
                hostRoomId: ROOM_ID,
                roomObjectLabels: objects.map(([, name]) => name),
                roomObjectCatalog: catalog ?? objects.map(([objectId, name]) => ({ objectId, normalizedShortName: name })),
            },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({ success: true, body: '{"type":"Command","confidence":0.9}' }),
                invokeBedrockObjectManipulationParseImpl: jest.fn().mockResolvedValue({ success: true, body: tokens ?? '{"tokens":[]}' }),
                objectManipulationPositionsReadDeps: {
                    getMembershipContainers: jest.fn().mockImplementation(async (id: string) => containersOf(id)),
                    getLudicGraph: (hostId: string) => internalCache.Positions.getLudicGraph(hostId as any),
                },
            }
        )
    }
    const parse = async (command: string, tokens: string | undefined, containersOf: (id: string) => string[], catalog?: readonly RoomInPlayObjectCatalogEntry[]) => {
        const parseResult = await parseAny(command, tokens, containersOf, catalog)
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

    return { parse, parseAny, commit, roomObjects, catalogFromCache }
}

describe('object spread payoff (integration)', () => {
    const { parse, commit, roomObjects } = useWorld([[RUG_ID, 'rug'], [TABLE_ID, 'table']])

    const spreadTokens = '{"tokens":[{"type":"text","text":"spread"},{"type":"objectSpan","span":"rug"},{"type":"text","text":"over"},{"type":"objectSpan","span":"table"}]}'
    const beforeSpread = (id: string) => (id === RUG_ID || id === TABLE_ID || id === CHARACTER_ID ? [ROOM_ID] : [])
    const afterSpread = (id: string) => (id === RUG_ID ? [ROOM_ID, TABLE_ID] : beforeSpread(id))

    it('a real "spread the rug over the table" leaves the rug in both hosts, and shows it from both', async () => {
        // Step A: real parse.
        const parseResult = await parse('spread the rug over the table', spreadTokens, beforeSpread)
        const [extend, transfer] = CommandAttempt.fromJSON(parseResult.attempt).actions().map((action) => action.desiredResult)
        expect(extend).toMatchObject({ primitive: 'extend', object: { groundedId: RUG_ID } })
        expect(transfer).toMatchObject({
            primitive: 'transferMembership',
            containment: 'On',
            object: { groundedId: RUG_ID, view: [PresenceKey((extend as { presenceUuid: string }).presenceUuid)] },
            to: { groundedId: TABLE_ID },
        })
        expect(transfer).not.toHaveProperty('keepFrom')

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

    it('then a real "take rug" lifts it out of both hosts in one move (the take rule)', async () => {
        await commit((await parse('spread the rug over the table', spreadTokens, beforeSpread)).attempt, beforeSpread)

        const takeResult = await parse('take rug', undefined, afterSpread)
        await commit(takeResult.attempt, afterSpread)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(2)

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
})

describe('cloth draped over a table (integration)', () => {
    const { parse, commit } = useWorld([[CLOTH_ID, 'cloth'], [TABLE_ID, 'table'], [PLATE_ID, 'plate']])

    const drapeTokens = '{"tokens":[{"type":"text","text":"drape"},{"type":"objectSpan","span":"cloth"},{"type":"text","text":"over"},{"type":"objectSpan","span":"table"}]}'
    const putTokens = '{"tokens":[{"type":"text","text":"put"},{"type":"objectSpan","span":"plate"},{"type":"text","text":"on"},{"type":"objectSpan","span":"cloth"}]}'
    const beforeDrape = (id: string) => (id === CLOTH_ID || id === TABLE_ID || id === PLATE_ID || id === CHARACTER_ID ? [ROOM_ID] : [])
    const afterDrape = (id: string) => (id === CLOTH_ID ? [ROOM_ID, TABLE_ID] : beforeDrape(id))

    it('a plate put on the cloth lands in the cover of the part on the table', async () => {
        await commit((await parse('drape the cloth over the table', drapeTokens, beforeDrape)).attempt, beforeDrape)

        const putResult = await parse('put the plate on the cloth', putTokens, afterDrape)
        await commit(putResult.attempt, afterDrape)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(2)

        const clothGraph = await internalCache.Positions.getLudicGraph(CLOTH_ID)
        const [onFloor, onTable] = ['floor', 'table'].map((where) => clothGraph.presenceNodes.find((binding) => parentsOf(binding).some(({ host }) => host === (where === 'floor' ? ROOM_ID : TABLE_ID)))!)
        expect(onTable.cover.members.map(({ host }) => host)).toEqual([PLATE_ID])
        expect(onFloor.cover.members).toEqual([])
    })
})

describe('rope carried into the next room (integration)', () => {
    const { parse, commit, roomObjects } = useWorld([[ROPE_ID, 'rope']])

    /**
     * `[extend rope, move the new end into the next room]`, as the plan layer will state it once a
     * command can name the far room: no template reaches it yet, so the attempt is built by hand and
     * crosses the bus as plain data like any other.
     */
    const carryEndAttempt = (): CommandAttemptData => CommandAttempt.create('carry the rope end into the next room', [
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

    it('then a real "take rope" takes the whole rope, both ends (the take rule, a shim until a take can say which part)', async () => {
        await commit(carryEndAttempt(), containersOf)

        const afterCarry = (id: string) => (id === ROPE_ID ? [ROOM_ID, NEXT_ROOM_ID] : containersOf(id))
        const takeResult = await parse('take rope', undefined, afterCarry)
        await commit(takeResult.attempt, afterCarry)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(2)

        const ropeGraph = await internalCache.Positions.getLudicGraph(ROPE_ID)
        expect(ropeGraph.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host))).toEqual([CHARACTER_ID])
        expect(ropeGraph.relationalEdges).toEqual([])
        expect((await roomObjects(ROOM_ID)).map(({ objectId }) => objectId)).toEqual([])
        expect((await roomObjects(NEXT_ROOM_ID)).map(({ objectId }) => objectId)).toEqual([])
    })
})

describe('asking which part of a draped cloth (integration)', () => {
    const { parse, parseAny, commit, catalogFromCache } = useWorld([[CLOTH_ID, 'cloth'], [TABLE_ID, 'table']])

    const drapeTokens = '{"tokens":[{"type":"text","text":"drape"},{"type":"objectSpan","span":"cloth"},{"type":"text","text":"over"},{"type":"objectSpan","span":"table"}]}'
    const beforeDrape = (id: string) => (id === CLOTH_ID || id === TABLE_ID || id === CHARACTER_ID ? [ROOM_ID] : [])
    const afterDrape = (id: string) => (id === CLOTH_ID ? [ROOM_ID, TABLE_ID] : beforeDrape(id))
    const positionsReadDeps = {
        getMembershipContainers: async (id: string) => afterDrape(id) as any,
        getLudicGraph: (hostId: string) => internalCache.Positions.getLudicGraph(hostId as any),
    }

    const askTake = async () => {
        await commit((await parse('drape the cloth over the table', drapeTokens, beforeDrape)).attempt, beforeDrape)
        const catalog = await catalogFromCache()
        const consult = await parseAny('take cloth', undefined, afterDrape, catalog)
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

    it.each([0, 1, 2])('resumes the answer at option %i as a take of the cloth, with the part stamped as its view', async (index) => {
        const { catalog, consult } = await askTake()
        const { payload } = answered(consult, index)

        const resumed = await resumePersistentCommand(payload as any, { characterId: CHARACTER_ID, hostRoomId: ROOM_ID, roomObjectCatalog: catalog, heldInventoryCatalog: [] }, { positionsReadDeps: positionsReadDeps as any })

        expect(resumed).toMatchObject({ type: 'CommandAttempt' })
        const [step] = CommandAttempt.fromJSON((resumed as any).attempt).actions().map((action) => action.desiredResult)
        expect(step).toMatchObject({ primitive: 'transferMembership', object: { groundedId: CLOTH_ID } })
        if (index === 2) {
            expect((step as any).object).not.toHaveProperty('view')
        } else {
            expect((step as any).object.view).toHaveLength(1)
        }

        // Slice 3 only asks: whatever part was chosen, the take still lifts the whole cloth (Slice 4 reads the view).
        await commit((resumed as any).attempt, afterDrape)
        const clothGraph = await internalCache.Positions.getLudicGraph(CLOTH_ID)
        expect(clothGraph.presenceNodes.flatMap((binding) => parentsOf(binding).map(({ host }) => host))).toEqual([CHARACTER_ID])
    })

    it('does not ask when only one position of the cloth reaches the actor\'s room', async () => {
        // A catalog entry whose second position sits in another room: the actor's own position picks the first.
        const { catalog } = await askTake()
        const cloth = catalog.find(({ objectId }) => objectId === CLOTH_ID)!
        const [first, second] = cloth.placement!.find(({ host }) => host === CLOTH_ID)!.bindings
        const oneEnd = catalog.map((entry) => (entry.objectId === CLOTH_ID
            ? { ...entry, placement: [{ host: CLOTH_ID, bindings: [first!, { ...second!, rooms: [NEXT_ROOM_ID] }] }] }
            : entry))

        const result = await parseAny('take cloth', undefined, afterDrape, oneEnd as RoomInPlayObjectCatalogEntry[])

        expect(result).toMatchObject({ type: 'CommandAttempt' })
    })
})
