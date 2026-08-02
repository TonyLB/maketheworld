jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
const mockGetCurrentTimestamp = jest.fn()
jest.mock('../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: () => mockGetCurrentTimestamp(),
}))
jest.mock('../../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardObject from '@tonylb/mtw-wml/ts/standardize/components/object'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { v4 as uuidv4 } from 'uuid'
import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import { EPHEMERA_CACHE_PROVENANCE_AUTHORED } from '../renderCache/baseClasses'
import { orchestrateRoomDescriptionStreams } from './orchestrate'
import { sendMessageBundleDeclared } from '../messageOrchestration/subscribedEvents'
import { registerIngressSlot } from '../messageOrchestration'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const OBJECT_ID = 'OBJECT#test-tray' as const
const PERSPECTIVE = { assetStack: ['ASSET#one'] } as const
const PERSPECTIVE_KEY = 'PERSPECTIVE#v1#abc123'
const CACHE_ID = 'CACHE#fixture-cache-1' as const
const VIEWER = 'CHARACTER#viewer' as const
const SLOT_ID = 'object-slot'

function objectTerminalCacheRecord(): EphemeraCacheDynamoItem {
    return {
        EphemeraId: OBJECT_ID,
        DataCategory: CACHE_ID,
        markState: { markValue: [] },
        renderedContent: { displayName: ['serving tray'], description: [] },
        provenance: { type: EPHEMERA_CACHE_PROVENANCE_AUTHORED },
        perspectiveId: 'perspective-id',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#one'], forbiddenAssetIds: [] },
    }
}

/** No authored SITUATION#DEFAULT facet content yet (Phase 4: Object rides the real ensureAuthoredCatalog). */
function objectEmptyTerminalCacheRecord(): EphemeraCacheDynamoItem {
    return {
        EphemeraId: OBJECT_ID,
        DataCategory: CACHE_ID,
        markState: { markValue: [] },
        renderedContent: { description: [] },
        provenance: { type: EPHEMERA_CACHE_PROVENANCE_AUTHORED },
        perspectiveId: 'perspective-id',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#one'], forbiddenAssetIds: [] },
    }
}

function assertObjectShortName(wmlContent: string, objectId: string, expectedShortName: string): void {
    const parsed = new StandardForm(wmlContent, { standardizeMode: 'ephemeraWire' })
    const object = parsed.byUniversalId[objectId]
    expect(object).toBeInstanceOf(StandardObject)
    expect((object as StandardObject).shortName?._payload?.plain?.toJSON()).toBe(expectedShortName)
}

function spyPublish() {
    return jest.spyOn(messageBus, 'publish')
}

/** Declares a one-slot bundle and registers its ingress listener --- the Phase 7 object-description equivalent of dataSource/perception/index.test.ts's declareCharacterMoveBundle/registerCharacterMoveIngress. */
async function registerObjectDescriptionSlot(targets: string[] = [VIEWER]): Promise<string> {
    const bundleId = uuidv4()
    sendMessageBundleDeclared(messageBus, bundleId, {
        bundleId,
        slots: [{ slotId: SLOT_ID, expectedPublishType: 'PerceptionMessage' }],
    })
    await registerIngressSlot(messageBus, bundleId, {
        slotId: SLOT_ID,
        expectedPublishType: 'PerceptionMessage',
        componentId: OBJECT_ID,
        perspectiveKey: PERSPECTIVE_KEY,
        targets: targets as any,
        contentStream: 'render',
        format: 'full',
    })
    return bundleId
}

describe('orchestrateRoomDescriptionStreams object fan-in', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        let timestamp = 1_000_000_000_000
        mockGetCurrentTimestamp.mockImplementation(() => timestamp++)
        internalCache.clear()
        messageBus.clear()
        assetDBMock.getItems.mockResolvedValue([] as any)
        assetDBMock.query.mockResolvedValue([] as any)
        ephemeraDBMock.getItems.mockResolvedValue([] as any)
    })

    it('objectDescription Generation Started reports a valid Generating placeholder to the registered listener', async () => {
        const publishSpy = spyPublish()
        await registerObjectDescriptionSlot()

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: OBJECT_ID,
                perspective: PERSPECTIVE,
                perspectiveKey: PERSPECTIVE_KEY,
                phase: 'generating',
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()

        const genPublish = publishSpy.mock.calls
            .map((c) => c[0] as any)
            .find((m) => m?.type === 'PublishMessage' && m.metaData?.status === 'generating')
        expect(genPublish).toBeDefined()
        expect(genPublish?.metaData).toEqual({ componentUUID: OBJECT_ID, status: 'generating' })
        expect(genPublish?.targets).toEqual([VIEWER])
        // Must round-trip as valid WML even though this is a placeholder --- Object structurally
        // requires a non-empty ShortName.
        expect(() => new StandardForm(genPublish!.wmlContent as string, { standardizeMode: 'ephemeraWire' })).not.toThrow()
    })

    it('objectDescription Render Pertains terminal delivers the resolved shortName', async () => {
        const publishSpy = spyPublish()
        await registerObjectDescriptionSlot()

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Render Pertains',
                componentId: OBJECT_ID,
                perspectiveKey: PERSPECTIVE_KEY,
                cacheId: CACHE_ID,
                cacheRecord: objectTerminalCacheRecord(),
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()

        const terminalPublish = publishSpy.mock.calls
            .map((c) => c[0] as any)
            .find((m) => m?.type === 'PublishMessage')
        expect(terminalPublish).toBeDefined()
        expect(terminalPublish?.metaData).toEqual({ componentUUID: OBJECT_ID })
        expect(terminalPublish?.targets).toEqual([VIEWER])
        assertObjectShortName(terminalPublish!.wmlContent as string, OBJECT_ID, 'serving tray')
    })

    it('objectDescription Render Pertains with no authored facet content falls back to the live shortName (Phase 4)', async () => {
        internalCache.ImprovisationComponentData.set(OBJECT_ID, IMPROVISATION_ASSET_ID, new StandardObject({
            tag: 'Object',
            universalKey: OBJECT_ID,
            shortName: 'a small brass key',
        }))

        const publishSpy = spyPublish()
        await registerObjectDescriptionSlot()

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Render Pertains',
                componentId: OBJECT_ID,
                perspectiveKey: PERSPECTIVE_KEY,
                cacheId: CACHE_ID,
                cacheRecord: objectEmptyTerminalCacheRecord(),
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()

        const terminalPublish = publishSpy.mock.calls
            .map((c) => c[0] as any)
            .find((m) => m?.type === 'PublishMessage')
        expect(terminalPublish).toBeDefined()
        assertObjectShortName(terminalPublish!.wmlContent as string, OBJECT_ID, 'a small brass key')
    })

    it('objectDescription Orchestration Error delivers a valid Error placeholder', async () => {
        const publishSpy = spyPublish()
        await registerObjectDescriptionSlot()

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Orchestration Error',
                componentId: OBJECT_ID,
                perspective: PERSPECTIVE,
                perspectiveKey: PERSPECTIVE_KEY,
                errorCode: 'CONTEXT_REQUIRED',
                errorMessage: 'Generation context required',
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()

        const errPublish = publishSpy.mock.calls
            .map((c) => c[0] as any)
            .find((m) => m?.type === 'PublishMessage')
        expect(errPublish).toBeDefined()
        expect(() => new StandardForm(errPublish!.wmlContent as string, { standardizeMode: 'ephemeraWire' })).not.toThrow()
    })

    it('with no registered listener, reports content to zero listeners and publishes nothing', async () => {
        const publishSpy = spyPublish()

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: OBJECT_ID,
                perspective: PERSPECTIVE,
                perspectiveKey: PERSPECTIVE_KEY,
                phase: 'generating',
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()

        expect(publishSpy.mock.calls.map((c) => c[0]).filter((m: any) => m?.type === 'PublishMessage')).toHaveLength(0)
    })
})
