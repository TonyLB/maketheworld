/**
 * Payoff test for phrase coverage (rung 13 of the iteration ladder, rules in `actions/AGENT.contract.md`):
 * phrasings a player types that used to miss, or cost a Bedrock call, are read correctly.
 *
 * - Articles: Identify matches a span as given, then with its leading article peeled
 *   (`actions/AGENT.contract.md` "Grounding"). `get the cup` takes the cup beside a teacup, without
 *   asking, whether the model keeps "the" on the span (the LLM route) or the fast path passes the
 *   span through as typed.
 *
 * - Abstain hands the command on (`actions/AGENT.contract.md` "Outcomes climb the ladder"): a take of
 *   something absent is not understood on the fast path, so it climbs to the LLM route (classify and
 *   Parse called) and ends at the top rung's Abstain ("I couldn't understand that command."). A
 *   refusal the world gives ("The table has no cup.") is an answer on the fast path, with no Bedrock call.
 *   These stop at the parse result: `actions/index.test.ts` pins the line each outcome reads.
 *
 * - A drop's tail as a destination: `drop` is a containment verb too, moving only what the actor
 *   holds, so `drop the cup in the box` reads the box as where the cup goes as well as which cup is
 *   meant. With the cup held, the dry run refuses the second reading, and the first commits.
 *
 * Harness copied from `qualifiedTakePayoff.integration.test.ts` (see its header): the real
 * `parseCommand` (Bedrock mocked at its two seams, and asserted unused on the fast path), the bus
 * crossing as plain data, then the real `commitAttempt` against a mocked `ephemeraDB` leaf,
 * terminating at the committed graphs and the delivered narration.
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
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'

import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { parseCommand } from './actions/parseCommand'
import { getHeldInventoryCatalogForCharacter } from './actions/heldInventoryCatalogForCharacter'
import { CommandAttempt, type CommandAttemptData } from './actions/commandAttempt'
import { commitAttempt } from './positions/manipulation/commitAttempt'
import { EphemeraLudicGraph } from './positions/ludicGraph'
import { parentRemainderKey } from './positions/ludicGraph/testFixtures'
import { lookedAtObjectIdOf } from './actions/commandAttempt/lookedAtObjectId'
import { embeddingAtCosineSimilarity, makeEmbeddingFromAxis } from './actions/enrich/objectManipulation/embeddingMatch/testing/mockVectors'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const ROOM_ID = 'ROOM#Parlour' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const TEACUP_ID = 'OBJECT#Teacup' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const FLOOR_CUP_ID = 'OBJECT#FloorCup' as EphemeraObjectId
const MAN_IN_THE_MOON_ID = 'OBJECT#ManInTheMoon' as EphemeraObjectId
const MOON_ID = 'OBJECT#Moon' as EphemeraObjectId
const BOX_ID = 'OBJECT#Box' as EphemeraObjectId

/**
 * Live Titan cosines for unrelated short phrases sit around 0.15-0.25 (calibration snapshot
 * embedding-identity-v1-2026-07-07): every span embeds along one axis, every object at 0.25 to it.
 */
const SPAN_EMBEDDING = makeEmbeddingFromAxis(0)
const UNRELATED_OBJECT_EMBEDDING = embeddingAtCosineSimilarity(SPAN_EMBEDDING, 0.25)

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
        (graph, [member]) => graph.addObject(member),
        EphemeraLudicGraph.empty(ROOM_ID)
            .addPresenceNode(rootBinding(parentRemainderKey(ROOM_ID), covering([CHARACTER_ID], ...members)))
            .addCharacter(CHARACTER_ID)
    )
)
/** An object's own graph: its binding under its parent's, covering whatever rests on or in it. */
const objectGraph = (objectId: EphemeraObjectId, presence: string, parentHost: EphemeraMembershipHostId, parentPresence?: string, members: Member[] = [], kind: 'On' | 'In' = 'On') => (
    members.reduce(
        (graph, [member]) => graph.addObject(member).addRelationalEdge({ from: member, to: objectId, kind }),
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

describe('phrase coverage payoff (integration)', () => {
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

    /** Each object's shortName from the seeded names, as the merged component aggregate answers it. */
    const getComponentAggregate = async ([perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]) => {
        const shortName = world.names[perspective.universalKey]
        return shortName
            ? [mergedComponentResult({
                universalKey: perspective.universalKey as EphemeraObjectId,
                merged: new StandardObject({ tag: 'Object', shortName }),
                mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
            })]
            : []
    }

    /** The real `parseCommand` over the seeded world, the model returning `tokens`; with the two Bedrock seams, to assert on. */
    const parse = async (command: string, tokens?: string, { embeddings = false }: { embeddings?: boolean } = {}) => {
        const labels = Object.entries(world.names) as Array<[EphemeraObjectId, string]>
        const isHeld = (objectId: EphemeraObjectId) => (world.containers[objectId] ?? []).includes(CHARACTER_ID)
        // The held catalog as production builds it: what the character holds, read from its own graph.
        const heldInventoryCatalog = (await getHeldInventoryCatalogForCharacter(CHARACTER_ID, {
            getLudicGraph: async (hostId) => world.graphs[hostId] ?? EphemeraLudicGraph.empty(hostId),
            getCharacterAssets: async () => [],
            getComponentAggregate: getComponentAggregate as any,
        })).entries
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({ success: true, body: '{"type":"Command","confidence":0.9}' })
        const invokeBedrockObjectManipulationParseImpl = jest.fn().mockResolvedValue({ success: true, body: tokens ?? '{"tokens":[]}' })
        const parseResult = await parseCommand(
            {
                command,
                characterId: CHARACTER_ID,
                hostRoomId: ROOM_ID,
                roomObjectCatalog: labels.filter(([objectId]) => !isHeld(objectId)).map(([objectId, normalizedShortName]) => ({
                    objectId,
                    normalizedShortName,
                    ...(embeddings ? { embedding: UNRELATED_OBJECT_EMBEDDING } : {}),
                })),
                heldInventoryCatalog,
            },
            {
                invokeBedrockParseCommandImpl,
                invokeBedrockObjectManipulationParseImpl,
                ...(embeddings ? { embedSpan: jest.fn().mockResolvedValue({ success: true, embedding: SPAN_EMBEDDING }) } : {}),
                objectManipulationPositionsReadDeps: {
                    getMembershipContainers: jest.fn().mockImplementation(async (id: string) => world.containers[id] ?? []),
                    getLudicGraph: jest.fn().mockImplementation(async (hostId: string) => world.graphs[hostId] ?? EphemeraLudicGraph.empty(hostId as EphemeraMembershipHostId)),
                },
            }
        )
        return { parseResult, invokeBedrockParseCommandImpl, invokeBedrockObjectManipulationParseImpl }
    }

    /**
     * A command end to end: parse, the bus crossing, then the real commit. With no `tokens` the
     * fast path must claim the command (Bedrock is asserted unused); with `tokens` the model
     * returns that skeleton. Returns the commit's bus.
     */
    const run = async (command: string, tokens?: string): Promise<jest.Mock> => {
        const { parseResult, invokeBedrockParseCommandImpl, invokeBedrockObjectManipulationParseImpl } = await parse(command, tokens)

        if (tokens === undefined) {
            expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
            expect(invokeBedrockObjectManipulationParseImpl).not.toHaveBeenCalled()
        } else {
            expect(invokeBedrockObjectManipulationParseImpl).toHaveBeenCalledTimes(1)
        }
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

    /** A cup and a teacup, each directly in the room. */
    const seedCupAndTeacup = () => seed({
        graphs: {
            [ROOM_ID]: roomGraph([[CUP_ID, 'PRESENCE#cup-in-room'], [TEACUP_ID, 'PRESENCE#teacup-in-room']]),
            [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID).addPresenceNode(rootBinding('PRESENCE#Base')),
            [CUP_ID]: objectGraph(CUP_ID, 'PRESENCE#cup-in-room', ROOM_ID),
            [TEACUP_ID]: objectGraph(TEACUP_ID, 'PRESENCE#teacup-in-room', ROOM_ID),
        },
        containers: { [CHARACTER_ID]: [ROOM_ID], [CUP_ID]: [ROOM_ID], [TEACUP_ID]: [ROOM_ID] },
        names: { [CUP_ID]: 'cup', [TEACUP_ID]: 'teacup' },
    })

    it('"get the cup" on the LLM route, the model keeping "the" on the span, takes the cup by its name without asking', async () => {
        seedCupAndTeacup()

        // A manner word keeps the fast path out; the model keeps the article, as Nova Micro does after `get`.
        const publish = await run(
            'carefully get the cup',
            '{"tokens":[{"type":"text","text":"get"},{"type":"objectSpan","span":"the cup"}]}'
        )

        expect(await holds(CHARACTER_ID, CUP_ID)).toBe(true)
        expect(await holds(ROOM_ID, TEACUP_ID)).toBe(true)
        expect(delivered(publish)).toEqual([expect.stringMatching(/ picks up cup$/)])
    })

    it('"get the cup" on the fast path, the span passed through as typed, takes the cup without asking', async () => {
        seedCupAndTeacup()

        const publish = await run('get the cup')

        expect(await holds(CHARACTER_ID, CUP_ID)).toBe(true)
        expect(await holds(ROOM_ID, TEACUP_ID)).toBe(true)
        expect(delivered(publish)).toEqual([expect.stringMatching(/ picks up cup$/)])
    })

    /** A cup on the floor beside a table. */
    const seedCupBesideTable = () => seed({
        graphs: {
            [ROOM_ID]: roomGraph([[CUP_ID, 'PRESENCE#cup-in-room'], [TABLE_ID, 'PRESENCE#table-in-room']]),
            [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID).addPresenceNode(rootBinding('PRESENCE#Base')),
            [CUP_ID]: objectGraph(CUP_ID, 'PRESENCE#cup-in-room', ROOM_ID),
            [TABLE_ID]: objectGraph(TABLE_ID, 'PRESENCE#table-in-room', ROOM_ID),
        },
        containers: { [CHARACTER_ID]: [ROOM_ID], [CUP_ID]: [ROOM_ID], [TABLE_ID]: [ROOM_ID] },
        names: { [CUP_ID]: 'cup', [TABLE_ID]: 'table' },
    })

    it('"take unicorn", with no unicorn, is not understood on the fast path: it climbs to the LLM route and ends at the top rung\'s Abstain', async () => {
        seedCupAndTeacup()

        const { parseResult, invokeBedrockParseCommandImpl, invokeBedrockObjectManipulationParseImpl } = await parse(
            'take unicorn',
            '{"tokens":[{"type":"text","text":"take"},{"type":"objectSpan","span":"unicorn"}]}'
        )

        expect(parseResult).toEqual(expect.objectContaining({ type: 'Abstain' }))
        expect(invokeBedrockParseCommandImpl).toHaveBeenCalledTimes(1)
        expect(invokeBedrockObjectManipulationParseImpl).toHaveBeenCalledTimes(1)
    })

    it('"take cup from table", with the cup on the floor, is a refusal the world gives: answered on the fast path, with no Bedrock call', async () => {
        seedCupBesideTable()

        const { parseResult, invokeBedrockParseCommandImpl, invokeBedrockObjectManipulationParseImpl } = await parse('take cup from table')

        expect(parseResult).toEqual({ type: 'Error', errorMessage: 'The table has no cup.' })
        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationParseImpl).not.toHaveBeenCalled()
        expect(await holds(ROOM_ID, CUP_ID)).toBe(true)
    })

    /** The man in the moon on the table, and a moon in the room: a decoy for the readings that cut at "in". */
    const seedManInTheMoonOnTable = () => seed({
        graphs: {
            [ROOM_ID]: roomGraph([[TABLE_ID, 'PRESENCE#table-in-room'], [MOON_ID, 'PRESENCE#moon-in-room']]),
            [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID).addPresenceNode(rootBinding('PRESENCE#Base')),
            [TABLE_ID]: objectGraph(TABLE_ID, 'PRESENCE#table-in-room', ROOM_ID, undefined, [[MAN_IN_THE_MOON_ID, 'PRESENCE#man-on-table']]),
            [MAN_IN_THE_MOON_ID]: objectGraph(MAN_IN_THE_MOON_ID, 'PRESENCE#man-on-table', TABLE_ID, 'PRESENCE#table-in-room'),
            [MOON_ID]: objectGraph(MOON_ID, 'PRESENCE#moon-in-room', ROOM_ID),
        },
        containers: { [CHARACTER_ID]: [ROOM_ID], [TABLE_ID]: [ROOM_ID], [MAN_IN_THE_MOON_ID]: [TABLE_ID], [MOON_ID]: [ROOM_ID] },
        names: { [TABLE_ID]: 'table', [MAN_IN_THE_MOON_ID]: 'man in the moon', [MOON_ID]: 'moon' },
    })

    it('"take man in the moon from table" takes the man in the moon on the fast path: every fill goes to Plan, and the one whose spans all match exactly is read', async () => {
        seedManInTheMoonOnTable()

        const publish = await run('take man in the moon from table')

        expect(await holds(CHARACTER_ID, MAN_IN_THE_MOON_ID)).toBe(true)
        expect(await holds(ROOM_ID, MOON_ID)).toBe(true)
        expect(delivered(publish)).toEqual([expect.stringMatching(/ picks up man in the moon$/)])
    })

    it('"look at the cup on the table" on the LLM route looks at the table\'s cup, not the floor\'s, without asking', async () => {
        seed({
            graphs: {
                [ROOM_ID]: roomGraph([[TABLE_ID, 'PRESENCE#table-in-room'], [FLOOR_CUP_ID, 'PRESENCE#floor-cup']]),
                [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID).addPresenceNode(rootBinding('PRESENCE#Base')),
                [TABLE_ID]: objectGraph(TABLE_ID, 'PRESENCE#table-in-room', ROOM_ID, undefined, [[CUP_ID, 'PRESENCE#cup-on-table']]),
                [CUP_ID]: objectGraph(CUP_ID, 'PRESENCE#cup-on-table', TABLE_ID, 'PRESENCE#table-in-room'),
                [FLOOR_CUP_ID]: objectGraph(FLOOR_CUP_ID, 'PRESENCE#floor-cup', ROOM_ID),
            },
            containers: { [CHARACTER_ID]: [ROOM_ID], [TABLE_ID]: [ROOM_ID], [CUP_ID]: [TABLE_ID], [FLOOR_CUP_ID]: [ROOM_ID] },
            names: { [TABLE_ID]: 'table', [CUP_ID]: 'cup', [FLOOR_CUP_ID]: 'cup' },
        })

        const { parseResult, invokeBedrockObjectManipulationParseImpl } = await parse(
            'look at the cup on the table',
            '{"tokens":[{"type":"text","text":"look"},{"type":"text","text":"at"},{"type":"objectSpan","span":"cup"},{"type":"text","text":"on"},{"type":"objectSpan","span":"table"}]}'
        )

        expect(invokeBedrockObjectManipulationParseImpl).toHaveBeenCalledTimes(1)
        expect(parseResult).toEqual(expect.objectContaining({ type: 'CommandAttempt' }))
        // The dispatch describes the object `lookedAtObjectIdOf` names; the rendered describe is the perception stack's.
        expect(parseResult.type === 'CommandAttempt' ? lookedAtObjectIdOf(parseResult.attempt) : undefined).toBe(CUP_ID)
    })

    /** The cup in the actor's hand, and a box in the room. */
    const seedHeldCupBesideBox = () => seed({
        graphs: {
            [ROOM_ID]: roomGraph([[BOX_ID, 'PRESENCE#box-in-room']]),
            [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID).addPresenceNode(rootBinding('PRESENCE#Base', covering([CUP_ID, 'PRESENCE#cup-held']))).addObject(CUP_ID),
            [CUP_ID]: objectGraph(CUP_ID, 'PRESENCE#cup-held', CHARACTER_ID, 'PRESENCE#Base'),
            [BOX_ID]: objectGraph(BOX_ID, 'PRESENCE#box-in-room', ROOM_ID, undefined, [], 'In'),
        },
        containers: { [CHARACTER_ID]: [ROOM_ID], [CUP_ID]: [CHARACTER_ID], [BOX_ID]: [ROOM_ID] },
        names: { [CUP_ID]: 'cup', [BOX_ID]: 'box' },
    })

    it('"drop the cup in the box", the cup held, drops it in the box on the fast path: the qualifier reading finds the held cup in no box, so the destination reading is the one left', async () => {
        seedHeldCupBesideBox()

        const publish = await run('drop the cup in the box')

        expect(await holds(BOX_ID, CUP_ID)).toBe(true)
        expect(await holds(CHARACTER_ID, CUP_ID)).toBe(false)
        expect(delivered(publish)).toEqual([expect.stringMatching(/ drops cup in box$/)])
    })

    it('"drop cup", the cup held, still drops it where the actor stands', async () => {
        seedHeldCupBesideBox()

        const publish = await run('drop cup')

        expect(await holds(ROOM_ID, CUP_ID)).toBe(true)
        expect(await holds(BOX_ID, CUP_ID)).toBe(false)
        expect(delivered(publish)).toEqual([expect.stringMatching(/ drops cup$/)])
    })

    // No fill's spans all match exactly ("man in moon" lacks "the"), so every reading competes. The
    // merged span pairs word for word with "man in the moon", the name's "the" an interior word skipped
    // free (skeletonMatcher 4d), so it outscores every cut reading, which once left the player asked.
    it('"take man in moon from table", no fill matching exactly, takes the man in the moon', async () => {
        seedManInTheMoonOnTable()

        const { parseResult } = await parse('take man in moon from table', undefined, { embeddings: true })

        expect(parseResult).toEqual(expect.objectContaining({ type: 'CommandAttempt' }))
        expect(JSON.stringify(parseResult)).toContain('"groundedId":"OBJECT#ManInTheMoon","shortName":"man in the moon"')
    })
})
