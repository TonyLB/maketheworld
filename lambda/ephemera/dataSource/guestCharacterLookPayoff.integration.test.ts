/**
 * Payoff test for the guest-character-description iteration (Phase 3): terminates at the
 * observable output a player actually sees, not at the merged StandardCharacter or the pair-row
 * write --- the explicit lesson carried from the predecessor iteration's own Phase 5 follow-on.
 *
 * Real, unmocked: `confirmGuestCharacter`'s write (against a mocked `ephemeraDB`, same convention
 * every integration test in this codebase uses --- nothing here touches live infrastructure), the
 * real `internalCache.ImprovisationComponentData` read-through cache, and `dataSource/perception`'s
 * `orchestrateRoomDescriptionStreams` -> `handleCharacterRenderPertains` ->
 * `characterRenderWmlFromCacheRecord` fan-in (same entry point `orchestrate.characterStream.test.ts`
 * uses for its own synthetic-fixture cases).
 *
 * Deliberately out of scope: the authored-catalog merge internals (`ensureAuthoredCatalog` ->
 * `hydrateAuthoredCatalogDiff` -> the `ComponentExamples` gateway -> catalog-row / single-flight
 * coordination). Phase 1's `ensureAuthoredCatalog.test.ts` ("improvisation merge participation")
 * already proves a CHARACTER# host's mergeParticipationOrder includes ASSET#IMPROVISATION, and no
 * integration test anywhere in this codebase exercises that machinery unmocked --- duplicating it
 * here would be new, higher-risk territory disproportionate to what this test needs to prove. This
 * test instead builds the terminal `Render Pertains` cache record directly from the content
 * `confirmGuestCharacter` actually wrote (read back from the mocked `ephemeraDB.putItem` call, not
 * re-typed prose), so the merge step is a thin, content-faithful stand-in rather than a black box.
 *
 * The two real bugs this session hit --- `app.ts` routing a CHARACTER# look down a dead legacy path,
 * and a one-child <Render> the client could not reparse --- both sat outside the merge step (one
 * above it, one below it), which is exactly where this test's real, unmocked coverage sits.
 */
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@tonylb/mtw-base/ts/coyoteGame', () => ({
    coyoteGameEnabled: true,
}))

import { v4 as uuidv4 } from 'uuid'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { confirmGuestCharacter } from '../guestCharacter'
import { orchestrateRoomDescriptionStreams } from './perception/orchestrate'
import { sendMessageBundleDeclared } from './messageOrchestration/subscribedEvents'
import { registerIngressSlot } from './messageOrchestration'
import { EPHEMERA_CACHE_PROVENANCE_AUTHORED, type EphemeraCacheDynamoItem } from './renderCache/baseClasses'
import { queryAllRenderCacheDataCategoriesForComponent } from './renderCache/queryAllRenderCacheDataCategoriesForComponent'

jest.mock('./renderCache/queryAllRenderCacheDataCategoriesForComponent', () => ({
    queryAllRenderCacheDataCategoriesForComponent: jest.fn().mockResolvedValue([]),
}))

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const queryAllRenderCacheDataCategoriesForComponentMock = queryAllRenderCacheDataCategoriesForComponent as jest.Mock

const USER_NAME = 'player-one'
const GUEST_ID = 'guest-1'
const CHARACTER_ID = `CHARACTER#${GUEST_ID}` as const
const VIEWER = 'CHARACTER#viewer' as const
const PERSPECTIVE_KEY = 'PERSPECTIVE#v1#abc123'
const CACHE_ID = 'CACHE#fixture-cache-1' as const
const SLOT_ID = 'guest-look-slot'

function spyPublish() {
    return jest.spyOn(messageBus, 'publish')
}

async function registerLookSlot(): Promise<void> {
    const bundleId = uuidv4()
    sendMessageBundleDeclared(messageBus, bundleId, {
        bundleId,
        slots: [{ slotId: SLOT_ID, expectedPublishType: 'PerceptionMessage' }],
    })
    await registerIngressSlot(messageBus, bundleId, {
        slotId: SLOT_ID,
        expectedPublishType: 'PerceptionMessage',
        componentId: CHARACTER_ID,
        perspectiveKey: PERSPECTIVE_KEY,
        targets: [VIEWER],
        contentStream: 'render',
        format: 'full',
    })
}

/**
 * The content `confirmGuestCharacter` actually persisted --- read back from the mocked
 * `ephemeraDB.putItem` call, not re-derived by calling `guestCoyoteSituations` a second time. That
 * distinction is the point: it proves the write path and this test agree on what was written,
 * rather than both independently agreeing with the same source function.
 */
function writtenGuestPairRowPayload(): { displayName: string; summary: string[]; description: string[] } {
    const call = ephemeraDBMock.putItem.mock.calls
        .map((c) => c[0] as any)
        .find((item) => item?.DataCategory === 'ASSET#IMPROVISATION')
    expect(call).toBeDefined()
    const [facet] = call!.situations
    expect(facet.reference).toBe('SITUATION#DEFAULT')
    return facet.payload
}

describe('guest character look payoff (integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        internalCache.clear()
        messageBus.clear()
        ephemeraDBMock.getItem.mockImplementation(async ({ Key }: any) => {
            if (Key?.DataCategory === 'Meta::Player') {
                return { guestId: GUEST_ID, guestName: 'Coyote Guest' }
            }
            // No existing ASSET#IMPROVISATION pair row: fresh guest.
            return undefined
        })
        ephemeraDBMock.optimisticUpdate.mockResolvedValue(undefined)
        ephemeraDBMock.putItem.mockResolvedValue(undefined)
        ;(ephemeraDBMock as any).getItems.mockResolvedValue([])
        queryAllRenderCacheDataCategoriesForComponentMock.mockResolvedValue([])
    })

    it('a guest confirm reaches rendered, reparseable coyote prose --- not just the merged StandardCharacter', async () => {
        // Step A: real write.
        await confirmGuestCharacter(USER_NAME, messageBus as any)
        const written = writtenGuestPairRowPayload()

        // Confirm the real internalCache read-through cache agrees with what was written (the
        // memo-patch `writeGuestSituationFacet` performs after `putItem`), not just the raw call args.
        const { component } = await internalCache.ImprovisationComponentData.get(CHARACTER_ID, 'ASSET#IMPROVISATION')
        expect(component).toBeInstanceOf(StandardCharacter)

        // Step B: stand-in merge, content-faithful to the real write (not hand-typed fixture prose).
        const cacheRecord: EphemeraCacheDynamoItem = {
            EphemeraId: CHARACTER_ID,
            DataCategory: CACHE_ID,
            markState: { markValue: [] },
            renderedContent: {
                displayName: [written.displayName],
                summary: written.summary,
                description: written.description,
            },
            provenance: { type: EPHEMERA_CACHE_PROVENANCE_AUTHORED },
            perspectiveId: 'perspective-id',
            perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
        }

        // Step C: real delivery --- register the slot, then run the real, unmocked perception fan-in.
        const publishSpy = spyPublish()
        await registerLookSlot()
        await orchestrateRoomDescriptionStreams(
            {
                type: 'Render Pertains',
                componentId: CHARACTER_ID,
                perspectiveKey: PERSPECTIVE_KEY,
                cacheId: CACHE_ID,
                cacheRecord,
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()

        // Step D: assertions on observable output only.
        const publishes = publishSpy.mock.calls
            .map((c) => c[0] as any)
            .filter((m) => m?.type === 'PublishMessage')
        expect(publishes).toHaveLength(1)
        const [publish] = publishes
        expect(publish.targets).toEqual([VIEWER])
        expect(publish.displayProtocol).toBe('PerceptionMessage')

        const wmlContent = publish.wmlContent as string
        // The literal assertion the 2b show-stopper (`Render tag must contain exactly three
        // children`) would have failed: the client parses this same wmlContent the same way.
        const parsed = new StandardForm(wmlContent, { standardizeMode: 'ephemeraWire' })
        const character = parsed.byUniversalId[CHARACTER_ID]
        expect(character).toBeInstanceOf(StandardCharacter)

        expect(wmlContent).toContain(written.description[0])

        // Guards the Unknown-fallback regression recorded as GD-1 / GD-2: displayName is the only
        // source of the character's name on this channel, so it must survive the round trip intact.
        expect(wmlContent).toContain(`<DisplayName>${written.displayName}</DisplayName>`)
    })
})
