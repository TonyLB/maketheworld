jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
const mockGetCurrentTimestamp = jest.fn()
jest.mock('../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: () => mockGetCurrentTimestamp(),
}))

import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardObject from '@tonylb/mtw-wml/ts/standardize/components/object'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import { EPHEMERA_CACHE_PROVENANCE_AUTHORED } from '../renderCache/baseClasses'
import { orchestrateRoomDescriptionStreams } from './orchestrate'

const OBJECT_ID = 'OBJECT#test-tray' as const
const PERSPECTIVE = { assetStack: ['ASSET#one'] } as const
const PERSPECTIVE_KEY = 'PERSPECTIVE#v1#abc123'
const CACHE_ID = 'CACHE#fixture-cache-1' as const
const VIEWER = 'CHARACTER#viewer' as const

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

function makeBusStub(): MessageBus {
    return { publish: jest.fn() } as unknown as MessageBus
}

function assertObjectShortName(wmlContent: string, objectId: string, expectedShortName: string): void {
    const parsed = new StandardForm(wmlContent, { standardizeMode: 'ephemeraWire' })
    const object = parsed.byUniversalId[objectId]
    expect(object).toBeInstanceOf(StandardObject)
    expect((object as StandardObject).shortName?._payload?.plain?.toJSON()).toBe(expectedShortName)
}

function findPublishMessage(
    bus: MessageBus,
    predicate: (msg: any) => boolean
): any {
    const publish = bus.publish as jest.Mock
    const match = publish.mock.calls.find((call) => {
        const msg = call[0]
        return msg?.type === 'PublishMessage' && predicate(msg)
    })
    return match ? match[0] : undefined
}

describe('orchestrateRoomDescriptionStreams object fan-in (PK-6 stub)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        let timestamp = 1_000_000_000_000
        mockGetCurrentTimestamp.mockImplementation(() => timestamp++)
        internalCache.clear()
    })

    it('objectDescription Generation Started publishes a valid Generating placeholder and updates thread', async () => {
        const bus = makeBusStub()
        internalCache.PerceptionThreads.register({
            threadKind: 'objectDescription',
            componentId: OBJECT_ID,
            perspectiveKey: PERSPECTIVE_KEY,
            characterId: VIEWER,
        })

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: OBJECT_ID,
                perspective: PERSPECTIVE,
                perspectiveKey: PERSPECTIVE_KEY,
                phase: 'generating',
            } as any,
            bus
        )

        const genPublish = findPublishMessage(bus, (m) => m.metaData?.status === 'generating')
        expect(genPublish).toBeDefined()
        expect(genPublish?.metaData).toEqual({ componentUUID: OBJECT_ID, status: 'generating' })
        expect(genPublish?.targets).toEqual([VIEWER])
        // Must round-trip as valid WML even though this is a placeholder --- Object structurally
        // requires a non-empty ShortName.
        expect(() => new StandardForm(genPublish!.wmlContent as string, { standardizeMode: 'ephemeraWire' })).not.toThrow()

        const listed = internalCache.PerceptionThreads.list(OBJECT_ID, PERSPECTIVE_KEY)
        expect(listed[0]?.thread).toMatchObject({ status: 'Generating', createdTime: 1_000_000_000_000 })
    })

    it('objectDescription Render Pertains terminal delivers the resolved shortName and removes thread', async () => {
        const bus = makeBusStub()
        internalCache.PerceptionThreads.register({
            threadKind: 'objectDescription',
            componentId: OBJECT_ID,
            perspectiveKey: PERSPECTIVE_KEY,
            characterId: VIEWER,
        })

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Render Pertains',
                componentId: OBJECT_ID,
                perspectiveKey: PERSPECTIVE_KEY,
                cacheId: CACHE_ID,
                cacheRecord: objectTerminalCacheRecord(),
            } as any,
            bus
        )

        const terminalPublish = findPublishMessage(bus, () => true)
        expect(terminalPublish).toBeDefined()
        expect(terminalPublish?.metaData).toEqual({ componentUUID: OBJECT_ID })
        expect(terminalPublish?.targets).toEqual([VIEWER])
        assertObjectShortName(terminalPublish!.wmlContent as string, OBJECT_ID, 'serving tray')
        expect(internalCache.PerceptionThreads.list(OBJECT_ID, PERSPECTIVE_KEY)).toEqual([])
    })

    it('objectDescription Orchestration Error publishes a valid Error placeholder and removes thread', async () => {
        const bus = makeBusStub()
        internalCache.PerceptionThreads.register({
            threadKind: 'objectDescription',
            componentId: OBJECT_ID,
            perspectiveKey: PERSPECTIVE_KEY,
            characterId: VIEWER,
        })

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Orchestration Error',
                componentId: OBJECT_ID,
                perspective: PERSPECTIVE,
                perspectiveKey: PERSPECTIVE_KEY,
                errorCode: 'CONTEXT_REQUIRED',
                errorMessage: 'Generation context required',
            } as any,
            bus
        )

        const errPublish = findPublishMessage(bus, () => true)
        expect(errPublish).toBeDefined()
        expect(() => new StandardForm(errPublish!.wmlContent as string, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        expect(internalCache.PerceptionThreads.list(OBJECT_ID, PERSPECTIVE_KEY)).toEqual([])
    })

    it('skips Generation Started when objectDescription thread is already Terminal', async () => {
        const bus = makeBusStub()
        internalCache.PerceptionThreads.register({
            threadKind: 'objectDescription',
            componentId: OBJECT_ID,
            perspectiveKey: PERSPECTIVE_KEY,
            characterId: VIEWER,
            registrationId: 'reg-terminal',
        })
        internalCache.PerceptionThreads.update(
            { componentId: OBJECT_ID, perspectiveKey: PERSPECTIVE_KEY, registrationId: 'reg-terminal' },
            { threadKind: 'objectDescription', status: 'Terminal', messageId: 'MESSAGE#prior' }
        )

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: OBJECT_ID,
                perspective: PERSPECTIVE,
                perspectiveKey: PERSPECTIVE_KEY,
                phase: 'generating',
            } as any,
            bus
        )

        expect((bus.publish as jest.Mock).mock.calls).toHaveLength(0)
    })
})
