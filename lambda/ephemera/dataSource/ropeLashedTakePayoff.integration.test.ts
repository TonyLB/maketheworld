/**
 * Payoff test for commandAttemptPhase slice 3 (corpus row 6): "get rope" when the rope is lashed
 * to a post by a `Custom` relation. Before slice 3 this failed silently: the dry run deferred to
 * the complexity LLM, and the commit side refused the undissolved `Custom` edge. Now Adjudicate
 * (actions-side, per candidate) records the lashing's challenge as met, the dry run lowers the
 * dissolve, and positions honors the met edge at commit. Terminates at the committed graphs.
 *
 * Real, in this order:
 *   1. `parseCommand` for "get rope", with no Bedrock call expected: the rope is in the room's
 *      labels, so the deterministic get check routes it straight to membership enrich, and the
 *      fast branch resolves it. Positions reads on the parse side are injected graphs, as in
 *      `parseCommand.test.ts`.
 *   2. The published attempt crosses the bus as data (`JSON.parse(JSON.stringify(...))`) and is
 *      rebuilt with `CommandAttempt.fromJSON`, as `positions/index.ts`'s dispatch does.
 *   3. The real `orchestrateObjectMove` -> `planObjectMoveTransfer` -> `commitStepSequence`,
 *      against a mocked `ephemeraDB` leaf, following `objectRehostInPayoff.integration.test.ts`'s
 *      harness (see its header for why a post-commit `getLudicGraph` sees the committed graph).
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
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { parseCommand } from './actions/parseCommand'
import { CommandAttempt, type CommandAttemptData } from './actions/commandAttempt'
import { orchestrateObjectMove } from './positions/manipulation/membership/orchestrateObjectMove'
import { testLudicGraph } from './positions/ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from './positions/ludicGraph'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const ROOM_ID = 'ROOM#Bridge' as EphemeraRoomId
const ROPE_ID = 'OBJECT#Rope' as EphemeraObjectId
const POST_ID = 'OBJECT#Post' as EphemeraObjectId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId

const lashedEdge = { from: ROPE_ID, to: POST_ID, kind: 'Custom' as const, relationLabel: 'is lashed to' }

/** Same stand-in as `objectRehostInPayoff.integration.test.ts`: runs the real reducer over the seeded graphs. */
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

describe('lashed rope take payoff (integration)', () => {
    const graphsByHost: Record<string, EphemeraLudicGraph> = {
        [ROOM_ID]: testLudicGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: ROPE_ID },
                { tag: 'Object', universalKey: POST_ID },
            ],
            edges: [{ tag: 'Relational', ...lashedEdge }],
        }),
        [CHARACTER_ID]: testLudicGraph(CHARACTER_ID, { nodes: [] }),
        [ROPE_ID]: testLudicGraph(ROPE_ID, { nodes: [{ tag: 'Object', universalKey: ROPE_ID }] }),
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
            const graph = graphsByHost[Key.EphemeraId]
            if (graph && ['Meta::Room', 'Meta::Object', 'Meta::Character'].includes(Key.DataCategory)) {
                return { ludicGraph: graph.toStored() }
            }
            return undefined
        })
        ephemeraDBMock.transactWrite.mockImplementation(makeTransactWriteMock(graphsByHost))
    })

    it('"get rope" unties the lashing and commits the rope into the character\'s hands', async () => {
        const invokeBedrockParseCommandImpl = jest.fn()
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
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
                invokeBedrockObjectManipulationComplexityImpl,
                objectManipulationPositionsReadDeps: {
                    getMembershipContainers: jest.fn().mockResolvedValue([ROOM_ID]),
                    getLudicGraph: jest.fn().mockImplementation(async (hostId: string) => graphsByHost[hostId]),
                },
            }
        )

        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
        expect(parseResult).toEqual(expect.objectContaining({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectIds: [ROPE_ID],
        }))
        if (parseResult.type !== 'ObjectManipulation' || !parseResult.attempt) {
            throw new Error('unreachable: asserted above')
        }

        // The bus crossing: plain data out, class rebuilt on the positions side.
        const published = JSON.parse(JSON.stringify(parseResult.attempt)) as CommandAttemptData
        const attempt = CommandAttempt.fromJSON(published)

        await orchestrateObjectMove({
            objectIds: parseResult.objectIds,
            fromHostId: ROOM_ID,
            toHostId: CHARACTER_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
            attempt,
            messageBus: { publish: jest.fn() } as any,
            streamEvent: jest.fn().mockResolvedValue(undefined),
        })

        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)
        const characterGraph = await internalCache.Positions.getLudicGraph(CHARACTER_ID)
        expect(characterGraph.nodeIds.has(ROPE_ID)).toBe(true)
        const roomGraph = await internalCache.Positions.getLudicGraph(ROOM_ID)
        expect(roomGraph.nodeIds.has(ROPE_ID)).toBe(false)
        expect(roomGraph.relationalEdges).toEqual([])
    })
})
