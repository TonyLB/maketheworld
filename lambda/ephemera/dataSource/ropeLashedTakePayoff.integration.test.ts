/**
 * Payoff test for commandAttemptPhase slice 3 (corpus row 6): "get rope" when the rope is lashed
 * to a post by a `Custom` relation. Adjudicate (actions-side, per candidate) records the lashing's
 * challenge as met, so the attempt carries the dissolve as its own action, ahead of the take, and
 * positions commits exactly the attempt's actions: the dissolve once, then the transfer. Also the
 * regression test for a take that committed a facilitating dissolve twice (once from the
 * attempt's action, once derived by positions itself), which threw on the second. Terminates at
 * the committed graphs, and at the narration the commit delivers: Expansion's own dissolve line,
 * then the take's (RN-2, `AGENT.attemptNarration.planning.md`).
 *
 * Real, in this order:
 *   1. `parseCommand` for "get rope", with no Bedrock call expected: the rope is in the room's
 *      labels, so the deterministic get check routes it straight to membership enrich, and the
 *      fast branch resolves it. Positions reads on the parse side are injected graphs, as in
 *      `parseCommand.test.ts`.
 *   2. The published attempt crosses the bus as data (`JSON.parse(JSON.stringify(...))`) and is
 *      rebuilt with `CommandAttempt.fromJSON`, as `positions/index.ts`'s dispatch does.
 *   3. The real `commitAttempt` (the generic per-attempt commit `positions/index.ts` dispatches
 *      to) -> `commitStepSequence`, against a mocked `ephemeraDB` leaf, following
 *      `objectContainmentInPayoff.integration.test.ts`'s harness (see its header for why a
 *      post-commit `getLudicGraph` sees the committed graph). Live hosts are read through a spy on
 *      `getMembershipContainers`, as the adjacency read's own query leaf is not modelled here.
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
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { parseCommand } from './actions/parseCommand'
import { CommandAttempt, type CommandAttemptData } from './actions/commandAttempt'
import { commitAttempt } from './positions/manipulation/commitAttempt'
import { testLudicGraph } from './positions/ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from './positions/ludicGraph'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const ROOM_ID = 'ROOM#Bridge' as EphemeraRoomId
const ROPE_ID = 'OBJECT#Rope' as EphemeraObjectId
const POST_ID = 'OBJECT#Post' as EphemeraObjectId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId

const lashedEdge = { from: ROPE_ID, to: POST_ID, kind: 'Custom' as const, relationLabel: 'is lashed to' }

type EphemeraLudicGraphEdgeInput =
    | typeof lashedEdge
    | { from: EphemeraObjectId; to: EphemeraObjectId; kind: 'Custom', relationLabel: 'against' }

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

/** The room, with the rope bound to the post by `edge`; the moved rope's own shard. */
const seedGraphs = (edge: EphemeraLudicGraphEdgeInput): Record<string, EphemeraLudicGraph> => ({
    [ROOM_ID]: testLudicGraph(ROOM_ID, {
        nodes: [
            { tag: 'Object', universalKey: ROPE_ID },
            { tag: 'Object', universalKey: POST_ID },
        ],
        edges: [{ tag: 'Relational', ...edge }],
    }),
    [CHARACTER_ID]: testLudicGraph(CHARACTER_ID, { nodes: [] }),
    [ROPE_ID]: testLudicGraph(ROPE_ID, { nodes: [{ tag: 'Object', universalKey: ROPE_ID }] }),
})

describe('lashed rope take payoff (integration)', () => {
    let graphsByHost: Record<string, EphemeraLudicGraph> = {}

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
            const graph = graphsByHost[Key.EphemeraId]
            if (graph && ['Meta::Room', 'Meta::Object', 'Meta::Character'].includes(Key.DataCategory)) {
                return { ludicGraph: graph.toStored() }
            }
            return undefined
        })
        ephemeraDBMock.transactWrite.mockImplementation(async (items: any[]) => makeTransactWriteMock(graphsByHost)(items))
        // Resolvable short names, so the delivered lines read as words rather than fallbacks.
        for (const [objectId, shortName] of [[ROPE_ID, 'rope'], [POST_ID, 'post']] as const) {
            internalCache.ImprovisationComponentData.set(objectId, IMPROVISATION_ASSET_ID, new StandardObject({ tag: 'Object', universalKey: objectId, shortName }))
        }
        jest.spyOn(internalCache.Positions, 'getMembershipContainers').mockImplementation(async (id) => (
            id === CHARACTER_ID || id === ROPE_ID || id === POST_ID ? [ROOM_ID] : []
        ))
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    /** "get rope" end to end: parse (no Bedrock), the bus crossing, then the real commit. Returns the commit's bus. */
    const getRope = async (): Promise<jest.Mock> => {
        const invokeBedrockParseCommandImpl = jest.fn()
        const parseResult = await parseCommand(
            {
                command: 'get rope',
                characterId: CHARACTER_ID,
                hostRoomId: ROOM_ID,
                roomObjectLabels: ['rope', 'post'],
                roomObjectCatalog: [
                    { objectId: ROPE_ID, normalizedShortName: 'rope' },
                    { objectId: POST_ID, normalizedShortName: 'post' },
                ],
            },
            {
                invokeBedrockParseCommandImpl,
                objectManipulationPositionsReadDeps: {
                    getMembershipContainers: jest.fn().mockResolvedValue([ROOM_ID]),
                    getLudicGraph: jest.fn().mockImplementation(async (hostId: string) => graphsByHost[hostId]),
                },
            }
        )

        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
        expect(parseResult).toEqual(expect.objectContaining({ type: 'CommandAttempt' }))
        if (parseResult.type !== 'CommandAttempt') {
            throw new Error('unreachable: asserted above')
        }

        // The bus crossing: plain data out, class rebuilt on the positions side.
        const published = JSON.parse(JSON.stringify(parseResult.attempt)) as CommandAttemptData
        const attempt = CommandAttempt.fromJSON(published)

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
    const deliveredLines = async (publish: jest.Mock): Promise<string[]> => {
        const reports = publish.mock.calls
            .map((call: any[]) => call[0])
            .filter((message: any) => message?.type === 'StreamingEvent' && message?.header?.type === 'Message Slot Reported')
        const contents = await Promise.all(reports.map((report: any) => report.getContent()))
        return contents.map((content: any) => content.message.message.join(''))
    }

    const expectRopeHeldAndUnbound = async (): Promise<void> => {
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)
        const characterGraph = await internalCache.Positions.getLudicGraph(CHARACTER_ID)
        expect(characterGraph.nodeIds.has(ROPE_ID)).toBe(true)
        const roomGraph = await internalCache.Positions.getLudicGraph(ROOM_ID)
        expect(roomGraph.nodeIds.has(ROPE_ID)).toBe(false)
        expect(roomGraph.relationalEdges).toEqual([])
    }

    it('"get rope" unties the lashing and commits the rope into the character\'s hands', async () => {
        graphsByHost = seedGraphs(lashedEdge)

        const publish = await getRope()

        await expectRopeHeldAndUnbound()
        // RN-2: Expansion's line for the dissolve is delivered before the take's (whose two
        // witness variants, before and after, each deliver the take's line).
        const lines = await deliveredLines(publish)
        expect(lines[0]).toMatch(/ frees rope from post$/)
        expect(lines.slice(1)).toEqual([expect.stringMatching(/ picks up rope$/), expect.stringMatching(/ picks up rope$/)])
    })

    it('"get rope" leaning against the post: an unchallenged (dissolve-classified) edge is dissolved once, too', async () => {
        graphsByHost = seedGraphs({ from: ROPE_ID, to: POST_ID, kind: 'Custom', relationLabel: 'against' })

        await getRope()

        await expectRopeHeldAndUnbound()
    })
})
