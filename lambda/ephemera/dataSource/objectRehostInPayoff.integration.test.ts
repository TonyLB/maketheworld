/**
 * Payoff test for nestedObjectLook Phase 4: routing the `In` containment kind through the real
 * mutation kernel, alongside the pre-existing `On` kind. Terminates at the observable output a
 * player actually sees (`look box` naming "ball"), not at an intermediate `StandardObjectData`/
 * cache row/graph shape --- same bar `guestCharacterLookPayoff.integration.test.ts` sets for this
 * repo's payoff tests.
 *
 * Real, unmocked, in this order:
 *   1. `parseCommand` (mocking only its two Bedrock impls, as `parseCommand.test.ts` does) turning
 *      the player phrase "put the ball in the box" into a real `ObjectRehost` parse result with
 *      `containment: 'In'`.
 *   2. `orchestrateObjectMove` (the real mutation-kernel entry point for take/drop/give/rehost ---
 *      not mocked, unlike `receivePaths.integration.test.ts`'s convention) driving
 *      `planObjectMoveTransfer` -> `commitAndPresentStepSequence` -> `commitStepSequence` for real,
 *      against a mocked `ephemeraDB` leaf (this repo's standard integration-test boundary). Called
 *      directly with the resolved ids/containment rather than via `positions/index.ts`'s
 *      `receiveEvents`, since the object under test is this kernel's real execution, not the
 *      envelope-routing layer `receivePaths.integration.test.ts` already covers.
 *   3. `dataSource/perception`'s `orchestrateRoomDescriptionStreams` -> `handleObjectRenderPertains`
 *      -> `resolveHostedNodeWmlData` fan-in for `look box` (the same entry point
 *      `orchestrate.objectStream.test.ts` proves for all three containment kinds via
 *      kernel-*constructed* fixtures) --- here reading back whatever the real kernel commit in step
 *      2 actually wrote to `internalCache.Positions`, not a hand-built `testLudicGraph`.
 *
 * The write side (`orchestrateObjectMove`) is given a bare `{ publish: jest.fn() }` stand-in for
 * `messageBus` and a no-op `streamEvent`, matching `orchestrateObjectMove.test.ts`'s own harness ---
 * the object-move narration/fact-streaming those two args drive (`Object Moved`, "Alice picks up
 * ball", catalog-bump fan-out) is proven elsewhere (Phase 2's
 * `objectMovedCatalogBump.integration.test.ts`, `orchestrateObjectMove.test.ts`) and is not the
 * subject of this test, which is real ludicGraph commit + real render. The read side
 * (`orchestrateRoomDescriptionStreams`) uses the process's real singleton `messageBus`, matching
 * `guestCharacterLookPayoff.integration.test.ts`'s convention for delivering the final
 * `PerceptionMessage`.
 *
 * Crux finding: `commitStepSequence`'s `seedGraphMemos` calls `internalCache.Positions.set(graph)`
 * synchronously, in-process, immediately after `transactWrite` resolves --- see
 * `commitStepSequence.ts` and `PositionsCacheHandler.set` (`mtw-gateways/ts/ephemera/positions/factory.ts`),
 * which writes the store with an `Infinity` TTL. A subsequent `internalCache.Positions.getLudicGraph`
 * read in the same test process therefore sees the committed graph with no explicit
 * invalidate/refetch step required; this test relies on that and never calls
 * `internalCache.Positions.invalidate`.
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

import { v4 as uuidv4 } from 'uuid'
import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardObject from '@tonylb/mtw-wml/ts/standardize/components/object'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { parseCommand } from './actions/parseCommand'
import { isParseCommandObjectRehostResult } from './actions/baseClasses'
import { orchestrateObjectMove } from './positions/manipulation/membership/orchestrateObjectMove'
import { testLudicGraph } from './positions/ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from './positions/ludicGraph'
import { orchestrateRoomDescriptionStreams } from './perception/orchestrate'
import { sendMessageBundleDeclared } from './messageOrchestration/subscribedEvents'
import { registerIngressSlot } from './messageOrchestration'
import type { EphemeraCacheDynamoItem } from './renderCache/baseClasses'
import { EPHEMERA_CACHE_PROVENANCE_AUTHORED } from './renderCache/baseClasses'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const ROOM_ID = 'ROOM#TestRoom' as EphemeraRoomId
const BALL_ID = 'OBJECT#Ball' as EphemeraObjectId
const BOX_ID = 'OBJECT#Box' as EphemeraObjectId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId
const VIEWER = 'CHARACTER#viewer' as const
const PERSPECTIVE_KEY = 'PERSPECTIVE#v1#abc123'
const CACHE_ID = 'CACHE#fixture-cache-1' as const
const SLOT_ID = 'box-look-slot'

const boxTerminalCacheRecord = (): EphemeraCacheDynamoItem => ({
    EphemeraId: BOX_ID,
    DataCategory: CACHE_ID,
    markState: { markValue: [] },
    renderedContent: { displayName: ['wooden box'], description: [] },
    provenance: { type: EPHEMERA_CACHE_PROVENANCE_AUTHORED },
    perspectiveId: 'perspective-id',
    perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
})

function spyPublish() {
    return jest.spyOn(messageBus, 'publish')
}

async function registerBoxLookSlot(): Promise<void> {
    const bundleId = uuidv4()
    sendMessageBundleDeclared(messageBus, bundleId, {
        bundleId,
        slots: [{ slotId: SLOT_ID, expectedPublishType: 'PerceptionMessage' }],
    })
    await registerIngressSlot(messageBus, bundleId, {
        slotId: SLOT_ID,
        expectedPublishType: 'PerceptionMessage',
        componentId: BOX_ID,
        perspectiveKey: PERSPECTIVE_KEY,
        targets: [VIEWER],
        contentStream: 'render',
        format: 'full',
    })
}

/**
 * Reuses `commitStepSequence.test.ts`'s established `MultiKeyUpdate` unit-test pattern: builds a
 * draft `Record` from the currently-seeded `graphsByHost` map and invokes the reducer directly,
 * standing in for whatever is actually in the database at commit time. `graphsByHost` starts out
 * as this test's initial fixtures (ball+box both in the room, box and ball each hosting nothing of
 * their own yet) and is never mutated by this mock afterward --- the real commit path's own
 * `internalCache.Positions.set` write-through, not a second copy kept here, is what a post-commit
 * read actually sees.
 */
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

describe('object rehost In payoff (integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        let timestamp = 1_000_000_000_000
        mockGetCurrentTimestamp.mockImplementation(() => timestamp++)
        internalCache.clear()
        messageBus.clear()
        assetDBMock.getItems.mockResolvedValue([] as any)
        assetDBMock.query.mockResolvedValue([] as any)
        ephemeraDBMock.getItems.mockResolvedValue([] as any)

        // The ball's own resolvable shortName --- used both by the render-side stub component
        // (this test's actual assertion) and, incidentally, by `resolveObjectMovePresentationLabels`'s
        // fallback during the move's own narration (not asserted on here).
        internalCache.ImprovisationComponentData.set(BALL_ID, IMPROVISATION_ASSET_ID, new StandardObject({
            tag: 'Object',
            universalKey: BALL_ID,
            shortName: 'ball',
        }))

        // Initial world state: ball and box both sitting directly in the room; box and ball each
        // host nothing of their own yet. `ephemeraDB.getItem` serves this for every pre-commit read
        // (the dry run in `planObjectMoveTransfer`, and `resolveObjectMovePresentationLabels`'s own
        // degrade-gracefully reads, which return `undefined` here and fall back harmlessly).
        const initialGraphsByHost: Record<string, EphemeraLudicGraph> = {
            [ROOM_ID]: testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: BALL_ID },
                    { tag: 'Object', universalKey: BOX_ID },
                ],
                edges: [],
            }),
            // The box's own graph must list itself as a node (its own root) --- a real Dynamo
            // read normalizes this in automatically (`normalizeStoredLudicGraph`), but this
            // fixture is handed straight to the transactWrite mock's draft, bypassing that
            // normalization. Required here because `establishRelation`'s target is the box
            // itself (`In`'s containment edge targets its own host): `confirmCarriedHost` checks
            // that the box is a member of its own graph.
            [BOX_ID]: testLudicGraph(BOX_ID, { nodes: [{ tag: 'Object', universalKey: BOX_ID }] }),
            [BALL_ID]: testLudicGraph(BALL_ID, { nodes: [{ tag: 'Object', universalKey: BALL_ID }] }),
        }

        ephemeraDBMock.getItem.mockImplementation(async ({ Key }: any) => {
            const graph = initialGraphsByHost[Key.EphemeraId]
            if (graph && (Key.DataCategory === 'Meta::Room' || Key.DataCategory === 'Meta::Object')) {
                return { ludicGraph: graph.toStored() }
            }
            return undefined
        })
        ephemeraDBMock.transactWrite.mockImplementation(makeTransactWriteMock(initialGraphsByHost))
    })

    it('a real "put the ball in the box" reaches a real kernel commit and a real rendered "look box"', async () => {
        // Step A: real parse. Bedrock mocked at its two seams only, same as parseCommand.test.ts.
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"Command","confidence":0.9}',
        })
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const invokeBedrockObjectManipulationParseImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"tokens":[{"type":"text","text":"put"},{"type":"objectSpan","span":"ball"},{"type":"text","text":"in"},{"type":"objectSpan","span":"box"}]}',
        })

        const parseResult = await parseCommand(
            {
                command: 'put the ball in the box',
                hostRoomId: ROOM_ID,
                roomObjectLabels: ['ball', 'box'],
                roomObjectCatalog: [
                    { objectId: BALL_ID, normalizedShortName: 'ball' },
                    { objectId: BOX_ID, normalizedShortName: 'box' },
                ],
            },
            {
                invokeBedrockParseCommandImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                invokeBedrockObjectManipulationParseImpl,
            }
        )

        expect(isParseCommandObjectRehostResult(parseResult)).toBe(true)
        if (!isParseCommandObjectRehostResult(parseResult)) {
            throw new Error('unreachable: asserted above')
        }
        expect(parseResult).toEqual({
            type: 'ObjectRehost',
            subjectId: BALL_ID,
            targetId: BOX_ID,
            hostId: ROOM_ID,
            containment: 'In',
            confidence: 0.9,
        })

        // Step B: real mutation-kernel commit. `orchestrateObjectMove` itself runs unmocked; only
        // its `messageBus`/`streamEvent` dependencies are bare stand-ins (see file header).
        const writeMessageBus = { publish: jest.fn() }
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await orchestrateObjectMove({
            objectIds: [parseResult.subjectId],
            fromHostId: ROOM_ID,
            toHostId: parseResult.targetId,
            roomId: parseResult.hostId,
            characterId: CHARACTER_ID,
            containment: parseResult.containment,
            messageBus: writeMessageBus as any,
            streamEvent,
        })

        // The real commit happened (not refused as illegal/stale).
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)

        // Crux check: the committed graph is visible to a fresh real `getLudicGraph` read with no
        // invalidate/refetch step --- `commitStepSequence`'s `seedGraphMemos` already wrote it
        // through synchronously. If this were false, the render step below would see an empty box.
        const boxGraphAfterCommit = await internalCache.Positions.getLudicGraph(BOX_ID)
        expect(boxGraphAfterCommit.nodeIds.has(BALL_ID)).toBe(true)

        // Step C: real render of "look box", via the real global messageBus (same convention as
        // guestCharacterLookPayoff.integration.test.ts).
        const publishSpy = spyPublish()
        await registerBoxLookSlot()

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Render Pertains',
                componentId: BOX_ID,
                perspectiveKey: PERSPECTIVE_KEY,
                cacheId: CACHE_ID,
                cacheRecord: boxTerminalCacheRecord(),
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()

        const terminalPublish = publishSpy.mock.calls
            .map((c) => c[0] as any)
            .find((m) => m?.type === 'PublishMessage')
        expect(terminalPublish).toBeDefined()

        const wmlContent = terminalPublish!.wmlContent as string
        const parsed = new StandardForm(wmlContent, { standardizeMode: 'ephemeraWire' })

        const box = parsed.byUniversalId[BOX_ID] as StandardObject
        expect(box).toBeInstanceOf(StandardObject)
        expect(box.ludicGraph.toJSON()).toBeDefined()
        const referencedKeys = box.ludicGraph.nodes.componentRefs.payload.map((ref) => ref.universalKey)
        expect(referencedKeys).toContain(BALL_ID)

        const ballStub = parsed.byUniversalId[BALL_ID] as StandardObject
        expect(ballStub).toBeInstanceOf(StandardObject)
        expect(ballStub.shortName?._payload?.plain?.toJSON()).toBe('ball')

        // As close to the final rendered prose as this channel gets: the raw wml the client parses
        // does actually carry the ball's name in the box's rendered payload.
        expect(wmlContent).toContain('<ShortName>ball</ShortName>')
    })
})
