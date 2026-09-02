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

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'
import * as hydrateRoomRoster from '../../internalCache/hydrateRoomRoster'
import messageBus from '../../messageBus'
import * as schemaModule from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import {
    affordancePassThroughFixtureRouting,
    makePassThroughGenerationDeferredPayload,
    makePassThroughGenerationStartedPayload,
    makePassThroughOrchestrationErrorPayload,
    passThroughFixtureMinimalDynamoItem,
    passThroughFixturePerspectiveKey,
    passThroughFixtureRoomId,
} from '../passThroughContractFixtures'
import { RENDER_CACHE_DATA_SOURCE_KEY } from '../renderCache/baseClasses'
import { RENDER_ORCHESTRATION_DATA_SOURCE_KEY } from '../renderOrchestration/publishedEvents'
import { EPHEMERA_OBJECTS_DATA_SOURCE_KEY } from '../objects/events'
import { AFFORDANCE_CACHE_DATA_SOURCE_KEY } from '../affordanceCache/publishedEvents'
import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import { roomHeaderGeneratingPlaceholderWml } from './roomHeaderPlaceholderWml'
import { EPHEMERA_ACTIONS_DATA_SOURCE_KEY } from '../actions/publishedEvents'
import { EPHEMERA_POSITIONS_DATA_SOURCE_KEY } from '../positions/publishedEvents'
import { sendPerceptionThreadRegistered } from './subscribedEvents'
import { sendMessageBundleDeclared } from '../messageOrchestration/subscribedEvents'
import { registerIngressSlot } from '../messageOrchestration'
import { ephemeraPerceptionDataSource } from './index'
import * as orchestrateModule from './orchestrate'
import * as roomHeaderBroadcastModule from './kickRoomHeaderBroadcast'

const TAKE_HOLD_CHARACTER = 'CHARACTER#Alice' as const
const TAKE_HOLD_OBJECT = 'OBJECT#Broom' as const
const TAKE_HOLD_ROOM = 'ROOM#Cafe' as const
const TAKE_HOLD_ANCHOR_TIME = 1_700_000_000_100

function publishObjectManipulationStreamingEvent(
    dataSourceKey: string,
    type: string,
    content: object,
    streamKey: string
): void {
    const ts = Date.now()
    messageBus.publish({
        type: 'StreamingEvent',
        dataSourceKey,
        streamKey,
        timestamp: ts,
        header: {
            dataSourceKey,
            streamKey,
            timestamp: ts,
            type,
        },
        getContent: () => Promise.resolve(content),
    })
}

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const originalMessageBusPublish = messageBus.publish.bind(messageBus)

describe('mtw.ephemera.perception DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        let timestamp = 1000000000000
        mockGetCurrentTimestamp.mockImplementation(() => timestamp++)
        messageBus.clear()
        internalCache.clear()
        ephemeraDBMock.getItem.mockResolvedValue({
            Name: 'Test',
            Pronouns: 'they/them',
        })
    })

    function spyPublish() {
        return jest.spyOn(messageBus, 'publish').mockImplementation((payload) => {
            originalMessageBusPublish(payload)
        })
    }

    it('registers subscription and flush completes without error when queue is empty', async () => {
        expect(ephemeraPerceptionDataSource.dataSourceKey).toBe('mtw.ephemera.perception')
        await expect(messageBus.flushAndSettle()).resolves.toBeUndefined()
    })

    it('receiveEvents stores Perception Thread Registered in internalCache.PerceptionThreads without PublishMessage', async () => {
        const publishSpy = spyPublish()

        sendPerceptionThreadRegistered(messageBus, 'ROOM#REG', {
            threadKind: 'roomHeaderBroadcast',
            componentId: 'ROOM#REG',
            perspectiveKey: 'view-1',
            targets: ['CHARACTER#viewer'],
        })
        await messageBus.flushAndSettle()

        const listed = internalCache.PerceptionThreads.list('ROOM#REG', 'view-1')
        expect(listed).toHaveLength(1)
        const entry = listed[0]
        expect(entry.thread).toMatchObject({
            kind: 'roomHeaderBroadcast',
            status: 'Initial',
        })
        expect(entry.registration).toMatchObject({
            threadKind: 'roomHeaderBroadcast',
            componentId: 'ROOM#REG',
            perspectiveKey: 'view-1',
            targets: ['CHARACTER#viewer'],
        })
        expect(publishSpy.mock.calls.some((call) => call[0]?.type === 'PublishMessage')).toBe(false)
        publishSpy.mockRestore()
    })

    function assertFullRoomRenderPlaceholderWml(wmlContent: string, roomId: string, expectedDescription: string): void {
        const parsed = new StandardForm(wmlContent, { standardizeMode: 'ephemeraWire' })
        expect(Object.keys(parsed.byUniversalId).filter((k) => k.startsWith('EXAMPLE#'))).toHaveLength(0)
        const room = parsed.byUniversalId[roomId]
        expect(room).toBeInstanceOf(StandardRoom)
        const r = room as StandardRoom
        expect(r.render?.description).toEqual([expectedDescription])
    }

    async function sendOrchestrationStreamingEvent(
        payload:
            | ReturnType<typeof makePassThroughGenerationStartedPayload>
            | ReturnType<typeof makePassThroughOrchestrationErrorPayload>
            | ReturnType<typeof makePassThroughGenerationDeferredPayload>
    ): Promise<void> {
        const tsOrch = Date.now()
        messageBus.publish({
            type: 'StreamingEvent',
            dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
            streamKey: passThroughFixtureRoomId,
            timestamp: tsOrch,
            header: {
                dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: tsOrch,
                type: payload.type,
            },
            getContent: () => Promise.resolve(payload),
        })
        await messageBus.flushAndSettle()
    }

    async function sendRenderPertainsStreamingEvent(): Promise<void> {
        const tsCache = Date.now()
        messageBus.publish({
            type: 'StreamingEvent',
            dataSourceKey: RENDER_CACHE_DATA_SOURCE_KEY,
            streamKey: passThroughFixtureRoomId,
            timestamp: tsCache,
            header: {
                dataSourceKey: RENDER_CACHE_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: tsCache,
                type: 'Render Pertains',
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Render Pertains',
                    componentId: passThroughFixtureRoomId,
                    perspectiveKey: passThroughFixturePerspectiveKey,
                    cacheId: passThroughFixtureMinimalDynamoItem.DataCategory,
                    cacheRecord: passThroughFixtureMinimalDynamoItem,
                }),
        })
        await messageBus.flushAndSettle()
    }

    /**
     * Deliberately does NOT flush --- messageOrchestration's deferral tail force-settles (and
     * evicts) any still-open, incomplete bundle partial on every flushAndSettle() call, per its
     * own "tolerantly failed" settle design. Declaring a bundle and then separately flushing
     * before its slots have reported would prematurely evict it, orphaning every later
     * slot-report leg. Production never does this (orchestrateNavigate.ts declares, registers,
     * and kicks off resolution all within one invocation, with exactly one flush at the very
     * end) --- these test helpers mirror that: call declareCharacterMoveBundle/
     * registerCharacterMoveIngress for setup, then let the first real trigger event's own flush
     * (e.g. sendOrchestrationStreamingEvent/sendRenderPertainsStreamingEvent) process everything
     * queued so far together.
     */
    function declareCharacterMoveBundle(bundleId: string, slotId: string): void {
        sendMessageBundleDeclared(messageBus, bundleId, {
            bundleId,
            slots: [{
                slotId,
                expectedPublishType: 'PerceptionMessage',
                componentId: passThroughFixtureRoomId,
                perspectiveKey: passThroughFixturePerspectiveKey,
                targets: ['CHARACTER#viewer'],
                contentStream: 'render',
                format: 'header',
            }],
        })
    }

    /**
     * Ingress-side registration for a characterMove header slot --- mirrors what
     * orchestrateNavigate.ts does in production (always paired with declareCharacterMoveBundle,
     * since every real characterMove header render goes through both the Delivery bundle and the
     * Ingress listener registration together). Deliberately does not flush --- see
     * declareCharacterMoveBundle's comment above.
     */
    async function registerCharacterMoveIngress(bundleId: string, slotId: string, targets: string[] = ['CHARACTER#viewer']): Promise<void> {
        await registerIngressSlot(messageBus, bundleId, {
            slotId,
            expectedPublishType: 'PerceptionMessage',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            targets: targets as any,
            contentStream: 'render',
            format: 'header',
        })
    }

    /**
     * Phase 7: roomDescription/featureDescription/knowledgeDescription/objectDescription/
     * sessionOrientationRender all register against messageOrchestration's ingress registry now
     * instead of PerceptionThreads --- roomDescription shares the exact same
     * (componentId, perspectiveKey, 'render') bucket characterMove/sessionOrientationRender use,
     * differing only by `format:'full'`. Same declare-then-register, don't-flush-until-the-real-
     * trigger-event pattern as declareCharacterMoveBundle/registerCharacterMoveIngress above.
     */
    function declareRoomDescriptionBundle(bundleId: string, slotId: string): void {
        sendMessageBundleDeclared(messageBus, bundleId, {
            bundleId,
            slots: [{
                slotId,
                expectedPublishType: 'PerceptionMessage',
                componentId: passThroughFixtureRoomId,
                perspectiveKey: passThroughFixturePerspectiveKey,
                targets: ['CHARACTER#viewer'],
                contentStream: 'render',
                format: 'full',
            }],
        })
    }

    async function registerRoomDescriptionIngress(bundleId: string, slotId: string, targets: string[] = ['CHARACTER#viewer']): Promise<void> {
        await registerIngressSlot(messageBus, bundleId, {
            slotId,
            expectedPublishType: 'PerceptionMessage',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            targets: targets as any,
            contentStream: 'render',
            format: 'full',
        })
    }

    it('roomDescription Generation Started publishes render-channel full-room WML with Render placeholder (no Example)', async () => {
        const publishSpy = spyPublish()

        declareRoomDescriptionBundle('BUNDLE#roomDescription', 'full')
        await registerRoomDescriptionIngress('BUNDLE#roomDescription', 'full')

        await sendOrchestrationStreamingEvent(makePassThroughGenerationStartedPayload())

        const genPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { status?: string; displayMode?: string }; wmlContent?: string }
            return (
                m?.type === 'PublishMessage'
                && m?.metaData?.status === 'generating'
                && m?.metaData?.displayMode === 'full'
                && typeof m.wmlContent === 'string'
            )
        })
        expect(genPublish).toBeDefined()
        assertFullRoomRenderPlaceholderWml(
            (genPublish![0] as { wmlContent: string }).wmlContent,
            passThroughFixtureRoomId,
            'Generating'
        )
        publishSpy.mockRestore()
    })

    it('roomDescription Orchestration Error publishes full-room Render placeholder', async () => {
        const publishSpy = spyPublish()

        declareRoomDescriptionBundle('BUNDLE#roomDescription', 'full')
        await registerRoomDescriptionIngress('BUNDLE#roomDescription', 'full')

        await sendOrchestrationStreamingEvent(makePassThroughOrchestrationErrorPayload())

        const errPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { displayMode?: string }; wmlContent?: string }
            return m?.type === 'PublishMessage' && m?.metaData?.displayMode === 'full' && typeof m.wmlContent === 'string'
        })
        expect(errPublish).toBeDefined()
        assertFullRoomRenderPlaceholderWml(
            (errPublish![0] as { wmlContent: string }).wmlContent,
            passThroughFixtureRoomId,
            'Error'
        )
        publishSpy.mockRestore()
    })

    it('roomDescription Generation Deferred publishes full-room Render placeholder', async () => {
        const publishSpy = spyPublish()

        declareRoomDescriptionBundle('BUNDLE#roomDescription', 'full')
        await registerRoomDescriptionIngress('BUNDLE#roomDescription', 'full')

        await sendOrchestrationStreamingEvent(makePassThroughGenerationDeferredPayload())

        const defPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { displayMode?: string }; wmlContent?: string }
            return m?.type === 'PublishMessage' && m?.metaData?.displayMode === 'full' && typeof m.wmlContent === 'string'
        })
        expect(defPublish).toBeDefined()
        assertFullRoomRenderPlaceholderWml(
            (defPublish![0] as { wmlContent: string }).wmlContent,
            passThroughFixtureRoomId,
            'Error'
        )
        publishSpy.mockRestore()
    })

    it('room slot receives Generation Started then terminal Render Pertains with stable messageId', async () => {
        const publishSpy = spyPublish()

        declareRoomDescriptionBundle('BUNDLE#roomDescription', 'full')
        await registerRoomDescriptionIngress('BUNDLE#roomDescription', 'full')

        const genStarted = makePassThroughGenerationStartedPayload()
        const tsOrch = Date.now()
        messageBus.publish({
            type: 'StreamingEvent',
            dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
            streamKey: passThroughFixtureRoomId,
            timestamp: tsOrch,
            header: {
                dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: tsOrch,
                type: 'Generation Started',
            },
            getContent: () => Promise.resolve(genStarted),
        })
        await messageBus.flushAndSettle()

        const genPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { status?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.status === 'generating'
        })
        expect(genPublish).toBeDefined()
        expect((genPublish![0] as { metaData?: { roomChannel?: string } }).metaData?.roomChannel).toBe('render')
        const mid = (genPublish![0] as { messageId?: string }).messageId
        expect(mid).toMatch(/^MESSAGE#/)
        const genCreatedTime = (genPublish![0] as { createdTime?: number }).createdTime
        expect(genCreatedTime).toBe(1000000000000)

        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<RoomTerminal />')
        const tsCache = Date.now()
        messageBus.publish({
            type: 'StreamingEvent',
            dataSourceKey: RENDER_CACHE_DATA_SOURCE_KEY,
            streamKey: passThroughFixtureRoomId,
            timestamp: tsCache,
            header: {
                dataSourceKey: RENDER_CACHE_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: tsCache,
                type: 'Render Pertains',
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Render Pertains',
                    componentId: passThroughFixtureRoomId,
                    perspectiveKey: passThroughFixturePerspectiveKey,
                    cacheId: passThroughFixtureMinimalDynamoItem.DataCategory,
                    cacheRecord: passThroughFixtureMinimalDynamoItem,
                }),
        })
        await messageBus.flushAndSettle()

        const terminalPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string; metaData?: { status?: string } }
            return (
                m?.type === 'PublishMessage'
                && m?.wmlContent === '<RoomTerminal />'
                && m?.metaData?.status !== 'generating'
            )
        })
        expect(terminalPublish).toBeDefined()
        expect((terminalPublish![0] as { metaData?: { roomChannel?: string } }).metaData?.roomChannel).toBe('render')
        expect((terminalPublish![0] as { messageId?: string }).messageId).toBe(mid)
        expect((terminalPublish![0] as { createdTime?: number }).createdTime).toBeGreaterThan(genCreatedTime!)

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('roomHeaderBroadcast receives Generation Started then terminal Render Pertains with stable messageId', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderTerminal />')

        const targets = ['CHARACTER#viewer', 'CHARACTER#other'] as const
        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'roomHeaderBroadcast',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            targets: [...targets],
        })
        await messageBus.flushAndSettle()

        const genStarted = makePassThroughGenerationStartedPayload()
        const tsOrch = Date.now()
        messageBus.publish({
            type: 'StreamingEvent',
            dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
            streamKey: passThroughFixtureRoomId,
            timestamp: tsOrch,
            header: {
                dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: tsOrch,
                type: 'Generation Started',
            },
            getContent: () => Promise.resolve(genStarted),
        })
        await messageBus.flushAndSettle()

        const genPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { displayMode?: string; status?: string }; targets?: string[] }
            return (
                m?.type === 'PublishMessage'
                && m?.metaData?.displayMode === 'header'
                && m?.metaData?.status === 'generating'
                && Array.isArray(m.targets)
                && m.targets.length === 2
            )
        })
        expect(genPublish).toBeDefined()
        expect((genPublish![0] as { metaData?: { roomChannel?: string } }).metaData?.roomChannel).toBe('render')
        expect((genPublish![0] as { wmlContent?: string }).wmlContent).toBe(
            roomHeaderGeneratingPlaceholderWml(passThroughFixtureRoomId)
        )
        const mid = (genPublish![0] as { messageId?: string }).messageId
        expect(mid).toMatch(/^MESSAGE#/)

        const tsCache = Date.now()
        messageBus.publish({
            type: 'StreamingEvent',
            dataSourceKey: RENDER_CACHE_DATA_SOURCE_KEY,
            streamKey: passThroughFixtureRoomId,
            timestamp: tsCache,
            header: {
                dataSourceKey: RENDER_CACHE_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: tsCache,
                type: 'Render Pertains',
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Render Pertains',
                    componentId: passThroughFixtureRoomId,
                    perspectiveKey: passThroughFixturePerspectiveKey,
                    cacheId: passThroughFixtureMinimalDynamoItem.DataCategory,
                    cacheRecord: passThroughFixtureMinimalDynamoItem,
                }),
        })
        await messageBus.flushAndSettle()

        const terminalPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string; metaData?: { displayMode?: string } }
            return m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderTerminal />' && m?.metaData?.displayMode === 'header'
        })
        expect(terminalPublish).toBeDefined()
        expect((terminalPublish![0] as { metaData?: { roomChannel?: string } }).metaData?.roomChannel).toBe('render')
        expect((terminalPublish![0] as { messageId?: string }).messageId).toBe(mid)
        expect(
            internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)
        ).toEqual([])

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('sessionOrientationRender receives Generation Started then terminal Render Pertains with stable messageId and CHARACTER# targets', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderTerminal />')

        declareCharacterMoveBundle('BUNDLE#sessionOrientationRender', 'header')
        await registerCharacterMoveIngress('BUNDLE#sessionOrientationRender', 'header')

        const genStarted = makePassThroughGenerationStartedPayload()
        const tsOrch = Date.now()
        messageBus.publish({
            type: 'StreamingEvent',
            dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
            streamKey: passThroughFixtureRoomId,
            timestamp: tsOrch,
            header: {
                dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: tsOrch,
                type: 'Generation Started',
            },
            getContent: () => Promise.resolve(genStarted),
        })
        await messageBus.flushAndSettle()

        const genPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { displayMode?: string; status?: string }; targets?: string[] }
            return (
                m?.type === 'PublishMessage'
                && m?.metaData?.displayMode === 'header'
                && m?.metaData?.status === 'generating'
                && Array.isArray(m.targets)
                && m.targets.length === 1
                && m.targets[0] === 'CHARACTER#viewer'
            )
        })
        expect(genPublish).toBeDefined()
        expect((genPublish![0] as { metaData?: { roomChannel?: string } }).metaData?.roomChannel).toBe('render')
        const mid = (genPublish![0] as { messageId?: string }).messageId
        expect(mid).toMatch(/^MESSAGE#/)

        const tsCache = Date.now()
        messageBus.publish({
            type: 'StreamingEvent',
            dataSourceKey: RENDER_CACHE_DATA_SOURCE_KEY,
            streamKey: passThroughFixtureRoomId,
            timestamp: tsCache,
            header: {
                dataSourceKey: RENDER_CACHE_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: tsCache,
                type: 'Render Pertains',
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Render Pertains',
                    componentId: passThroughFixtureRoomId,
                    perspectiveKey: passThroughFixturePerspectiveKey,
                    cacheId: passThroughFixtureMinimalDynamoItem.DataCategory,
                    cacheRecord: passThroughFixtureMinimalDynamoItem,
                }),
        })
        await messageBus.flushAndSettle()

        const terminalPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string; metaData?: { displayMode?: string }; targets?: string[] }
            return (
                m?.type === 'PublishMessage'
                && m?.wmlContent === '<HeaderTerminal />'
                && m?.metaData?.displayMode === 'header'
                && m?.targets?.[0] === 'CHARACTER#viewer'
            )
        })
        expect(terminalPublish).toBeDefined()
        expect((terminalPublish![0] as { metaData?: { roomChannel?: string } }).metaData?.roomChannel).toBe('render')
        expect((terminalPublish![0] as { messageId?: string }).messageId).toBe(mid)

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove: a registered Ingress listener suppresses the roster-broadcast fallback even though PerceptionThreads has zero entries', async () => {
        // Regression guard for the fix made in the MO-10 migration: once characterMove stopped
        // registering with PerceptionThreads, handleRenderPertains's `entries.length === 0`
        // roster-broadcast fallback would otherwise fire on every navigate header render (nothing
        // else registers for this key) --- gated on `publishedCharacterMove === 0` too now.
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveNoFallback />')
        const rosterSpy = jest.spyOn(hydrateRoomRoster, 'getRoomCharacterList')

        declareCharacterMoveBundle('BUNDLE#test', 'header')
        await registerCharacterMoveIngress('BUNDLE#test', 'header')

        await sendRenderPertainsStreamingEvent()

        expect(rosterSpy).not.toHaveBeenCalled()
        const slotReports = publishSpy.mock.calls
            .map((c) => c[0])
            .filter((m) => m?.type === 'StreamingEvent' && m?.header?.type === 'Message Slot Reported')
        expect(slotReports).toHaveLength(1)

        rosterSpy.mockRestore()
        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove single-slot bundle: terminal-only content is reported as a slot and flows through the bundle to a correctly-addressed publish', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveBundled />')

        declareCharacterMoveBundle('BUNDLE#test', 'header')
        await registerCharacterMoveIngress('BUNDLE#test', 'header')

        await sendRenderPertainsStreamingEvent()

        // The content is reported as a slot (not published as an unaddressed direct bypass) ---
        // a single-slot bundle completes (and flushes) the instant its one slot's first report
        // lands, so the eventual publish carries the bundle-assigned, correctly-addressed result.
        const slotReports = publishSpy.mock.calls
            .map((c) => c[0])
            .filter((m) => m?.type === 'StreamingEvent' && m?.header?.type === 'Message Slot Reported')
        expect(slotReports).toHaveLength(1)
        const content = await (slotReports[0] as any).getContent()
        expect(content).toMatchObject({
            bundleId: 'BUNDLE#test',
            slotId: 'header',
            message: expect.objectContaining({ wmlContent: '<HeaderMoveBundled />' }),
        })

        const published = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string }
            return m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveBundled />'
        })
        expect(published).toBeDefined()
        expect((published![0] as { targets?: string[] }).targets).toEqual(['CHARACTER#viewer'])
        expect((published![0] as { messageId?: string }).messageId).toMatch(/^MESSAGE#/)

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove bundled: placeholder fills the slot on Generation Started, terminal delivers standalone reusing the placeholder messageId', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveBundled />')

        declareCharacterMoveBundle('BUNDLE#test', 'header')
        await registerCharacterMoveIngress('BUNDLE#test', 'header')

        await sendOrchestrationStreamingEvent(makePassThroughGenerationStartedPayload())

        // A one-slot bundle completes (and flushes) the instant its one slot's first report
        // lands --- so the placeholder is already a real, published PublishMessage here (with a
        // cluster-minted messageId, per the MO-10 messageId mint-and-carry-forward design), not
        // just a pending StreamingEvent to inspect.
        const placeholderPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { status?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.status === 'generating'
        })
        expect(placeholderPublish).toBeDefined()
        const placeholderMessageId = (placeholderPublish![0] as { messageId?: string }).messageId
        expect(placeholderMessageId).toMatch(/^MESSAGE#/)

        await sendRenderPertainsStreamingEvent()

        const standaloneTerminal = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string }
            return m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveBundled />'
        })
        expect(standaloneTerminal).toBeDefined()
        expect((standaloneTerminal![0] as { messageId?: string }).messageId).toBe(placeholderMessageId)

        // Both waves still report a slot (Ingress broadcasts unconditionally); the terminal's
        // report is what index.ts's dispatch recognizes as already-delivered and redirects to a
        // standalone publish, rather than never being reported at all.
        const slotReportsAfterTerminal = publishSpy.mock.calls
            .map((c) => c[0])
            .filter((m) => m?.type === 'StreamingEvent' && m?.header?.type === 'Message Slot Reported')
        expect(slotReportsAfterTerminal).toHaveLength(2)

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove: a late Generation Started after the terminal already flushed the bundle delivers standalone instead of being silently discarded', async () => {
        // Confirmed design decision (MO-10 migration): unlike the old PerceptionThreads.remove()
        // hard-stop, ContentIngressIndex never removes a listener, so a repeat/out-of-order wave
        // for an already-fully-delivered slot gets a redundant standalone re-publish (same
        // messageId) rather than being silently dropped. Its createdTime is a genuinely later,
        // distinct transcript event --- not a reuse of the original terminal's value --- but it is
        // anchored to that recorded value (`max(t0+1, now)`) rather than an unrelated wall-clock
        // read, so it is guaranteed to sort strictly after it.
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveBundled />')

        declareCharacterMoveBundle('BUNDLE#test', 'header')
        await registerCharacterMoveIngress('BUNDLE#test', 'header')

        await sendRenderPertainsStreamingEvent()

        const terminalPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string }
            return m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveBundled />'
        })
        expect(terminalPublish).toBeDefined()
        const terminalMessageId = (terminalPublish![0] as { messageId?: string }).messageId
        const terminalCreatedTime = (terminalPublish![0] as { createdTime?: number }).createdTime

        await sendOrchestrationStreamingEvent(makePassThroughGenerationStartedPayload())

        const latePlaceholderPublishes = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { status?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.status === 'generating'
        })
        expect(latePlaceholderPublishes).toHaveLength(1)
        expect((latePlaceholderPublishes[0][0] as { messageId?: string }).messageId).toBe(terminalMessageId)
        expect((latePlaceholderPublishes[0][0] as { createdTime?: number }).createdTime).toBeGreaterThan(terminalCreatedTime!)

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove: two movers sharing (componentId, perspectiveKey) each get their own addressed slot-report from the same shared content', async () => {
        // The direct MO-10 motivating scenario: two bundles (movers) registered against the same
        // (componentId, perspectiveKey, threadKind) key. Content resolves once and fans out to
        // both listeners, each building its own addressed envelope from its own targets ---
        // there is no "pick one candidate" disambiguation step anymore.
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveShared />')

        declareCharacterMoveBundle('BUNDLE#one', 'header')
        await registerCharacterMoveIngress('BUNDLE#one', 'header', ['CHARACTER#one'])
        sendMessageBundleDeclared(messageBus, 'BUNDLE#two', {
            bundleId: 'BUNDLE#two',
            slots: [{
                slotId: 'header',
                expectedPublishType: 'PerceptionMessage',
                componentId: passThroughFixtureRoomId,
                perspectiveKey: passThroughFixturePerspectiveKey,
                targets: ['CHARACTER#two'],
                contentStream: 'render',
                format: 'header',
            }],
        })
        await registerCharacterMoveIngress('BUNDLE#two', 'header', ['CHARACTER#two'])

        await sendRenderPertainsStreamingEvent()

        const slotReports = publishSpy.mock.calls
            .map((c) => c[0])
            .filter((m) => m?.type === 'StreamingEvent' && m?.header?.type === 'Message Slot Reported')
        expect(slotReports).toHaveLength(2)
        const reportContents = await Promise.all(slotReports.map((r: any) => r.getContent()))
        expect(reportContents.map((c) => c.bundleId).sort()).toEqual(['BUNDLE#one', 'BUNDLE#two'])

        const publishedHeaders = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; wmlContent?: string }
            return m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveShared />'
        })
        expect(publishedHeaders).toHaveLength(2)
        expect(publishedHeaders.map((c) => (c[0] as { targets?: string[] }).targets).sort()).toEqual([['CHARACTER#one'], ['CHARACTER#two']])

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove cache hit (no Generation Started) delivers the terminal alone, with no synthesized Generating placeholder', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveTerminal />')

        declareCharacterMoveBundle('BUNDLE#test', 'header')
        await registerCharacterMoveIngress('BUNDLE#test', 'header')

        await sendRenderPertainsStreamingEvent()

        const genPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { displayMode?: string; status?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.displayMode === 'header' && m?.metaData?.status === 'generating'
        })
        expect(genPublish).toBeUndefined()

        const headerPublishes = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { displayMode?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.displayMode === 'header'
        })
        expect(headerPublishes).toHaveLength(1)

        const terminalPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string; metaData?: { displayMode?: string } }
            return m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveTerminal />' && m?.metaData?.displayMode === 'header'
        })
        expect(terminalPublish).toBeDefined()
        expect((terminalPublish![0] as { messageId?: string }).messageId).toMatch(/^MESSAGE#/)

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove publishes header at most once across repeated orchestration events', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveTerminal />')

        declareCharacterMoveBundle('BUNDLE#test', 'header')
        await registerCharacterMoveIngress('BUNDLE#test', 'header')

        const generationEvent = () => {
            const tsOrch = Date.now()
            messageBus.publish({
                type: 'StreamingEvent',
                dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: tsOrch,
                header: {
                    dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
                    streamKey: passThroughFixtureRoomId,
                    timestamp: tsOrch,
                    type: 'Generation Started',
                },
                getContent: () => Promise.resolve(makePassThroughGenerationStartedPayload()),
            })
        }

        generationEvent()
        generationEvent()
        await messageBus.flushAndSettle()

        const tsCache = Date.now()
        messageBus.publish({
            type: 'StreamingEvent',
            dataSourceKey: RENDER_CACHE_DATA_SOURCE_KEY,
            streamKey: passThroughFixtureRoomId,
            timestamp: tsCache,
            header: {
                dataSourceKey: RENDER_CACHE_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: tsCache,
                type: 'Render Pertains',
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Render Pertains',
                    componentId: passThroughFixtureRoomId,
                    perspectiveKey: passThroughFixturePerspectiveKey,
                    cacheId: passThroughFixtureMinimalDynamoItem.DataCategory,
                    cacheRecord: passThroughFixtureMinimalDynamoItem,
                }),
        })
        await messageBus.flushAndSettle()

        const headerPublishes = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { displayMode?: string; status?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.displayMode === 'header'
        })
        expect(headerPublishes.length).toBeGreaterThanOrEqual(1)
        const worldMessages = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; displayProtocol?: string }
            return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage'
        })
        expect(worldMessages).toHaveLength(0)

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('Render Pertains fallback publishes render header to perspective-matched occupants when no threads registered', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<FallbackHeader />')
        jest.spyOn(hydrateRoomRoster, 'getRoomCharacterList').mockResolvedValue([
            { EphemeraId: 'CHARACTER#Match', DisplayName: 'Match', Color: 'blue', SessionIds: [] },
            { EphemeraId: 'CHARACTER#Other', DisplayName: 'Other', Color: 'purple', SessionIds: [] },
        ])
        const perspectiveSpy = jest.spyOn(roomHeaderBroadcastModule, 'getCharacterRoomPerspectiveKey')
            .mockImplementation(async (_roomId, assets) => {
                if ((assets || []).includes('match')) {
                    return passThroughFixturePerspectiveKey
                }
                return 'DIFFERENT#Perspective'
            })
        jest.spyOn(internalCache.CharacterMeta, 'get')
            .mockImplementation(async (characterId) => ({
                EphemeraId: characterId,
                assets: characterId === 'CHARACTER#Match' ? ['match'] : ['other'],
            } as any))

        await sendRenderPertainsStreamingEvent()

        const fallbackPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string; displayMode?: string }; wmlContent?: string; targets?: string[] }
            return (
                m?.type === 'PublishMessage'
                && m?.metaData?.roomChannel === 'render'
                && m?.metaData?.displayMode === 'header'
                && m?.wmlContent === '<FallbackHeader />'
            )
        })
        expect(fallbackPublish).toBeDefined()
        expect((fallbackPublish![0] as { targets?: string[] }).targets).toEqual(['CHARACTER#Match'])
        expect((fallbackPublish![0] as { messageId?: string }).messageId).toMatch(/^MESSAGE#/)
        expect(perspectiveSpy).toHaveBeenCalledTimes(2)

        perspectiveSpy.mockRestore()
        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('Render Pertains fallback does not publish when no occupants match perspective key', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<FallbackHeaderNoMatch />')
        jest.spyOn(hydrateRoomRoster, 'getRoomCharacterList').mockResolvedValue([
            { EphemeraId: 'CHARACTER#A', DisplayName: 'A', Color: 'blue', SessionIds: [] },
            { EphemeraId: 'CHARACTER#B', DisplayName: 'B', Color: 'purple', SessionIds: [] },
        ])
        const perspectiveSpy = jest.spyOn(roomHeaderBroadcastModule, 'getCharacterRoomPerspectiveKey')
            .mockResolvedValue('DIFFERENT#Perspective')
        jest.spyOn(internalCache.CharacterMeta, 'get')
            .mockImplementation(async (characterId) => ({
                EphemeraId: characterId,
                assets: ['other'],
            } as any))

        await sendRenderPertainsStreamingEvent()

        const fallbackPublishes = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string; displayMode?: string }; wmlContent?: string }
            return (
                m?.type === 'PublishMessage'
                && m?.metaData?.roomChannel === 'render'
                && m?.metaData?.displayMode === 'header'
                && m?.wmlContent === '<FallbackHeaderNoMatch />'
            )
        })
        expect(fallbackPublishes).toHaveLength(0)
        expect(perspectiveSpy).toHaveBeenCalledTimes(2)

        perspectiveSpy.mockRestore()
        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('receiveEvents publishes affordance PerceptionMessage on Affordances Pertain stream', async () => {
        const publishSpy = spyPublish()
        jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<AffordanceHeader />')
        jest.spyOn(hydrateRoomRoster, 'getRoomCharacterList').mockResolvedValue([
            { EphemeraId: 'CHARACTER#Match', DisplayName: 'Match', Color: 'blue', SessionIds: [] },
        ])
        jest.spyOn(roomHeaderBroadcastModule, 'getCharacterRoomPerspectiveKey')
            .mockResolvedValue(passThroughFixturePerspectiveKey)
        jest.spyOn(internalCache.CharacterMeta, 'get')
            .mockResolvedValue({ EphemeraId: 'CHARACTER#Match', assets: ['match'] } as any)
        jest.spyOn(internalCache.AffordanceRoomDeliverable, 'get')
            .mockResolvedValue({ schema: {} } as any)

        const { roomId, perspective, perspectiveKey } = affordancePassThroughFixtureRouting
        const affordanceRow = createAffordanceCacheRow({
            roomId,
            perspectiveKey,
            assetStack: perspective.assetStack,
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            topology: {
                roomUniversalKey: roomId,
                exits: [],
            },
        })
        const ts = Date.now()
        messageBus.publish({
            type: 'StreamingEvent',
            dataSourceKey: AFFORDANCE_CACHE_DATA_SOURCE_KEY,
            streamKey: roomId,
            timestamp: ts,
            header: {
                dataSourceKey: AFFORDANCE_CACHE_DATA_SOURCE_KEY,
                streamKey: roomId,
                timestamp: ts,
                type: 'Affordances Pertain',
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Affordances Pertain',
                    roomId,
                    perspective,
                    perspectiveKey,
                    affordanceRow,
                    topology: affordanceRow.topology,
                }),
        })
        await messageBus.flushAndSettle()

        const affordancePublishes = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string; displayMode?: string }; targets?: string[] }
            return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
        })
        expect(affordancePublishes).toHaveLength(1)
        const row = affordancePublishes[0][0] as {
            targets?: string[];
            metaData?: { displayMode?: string };
            messageId?: string;
            wmlContent?: string;
        }
        expect(row.targets).toEqual(['CHARACTER#Match'])
        expect(row.metaData?.displayMode).toBe('header')
        expect(row.wmlContent).toBe('<AffordanceHeader />')
        expect(row.messageId).toMatch(/^MESSAGE#/)

        publishSpy.mockRestore()
    })

    it('receiveEvents does not publish affordance PerceptionMessage on Objects Changed stream', async () => {
        const publishSpy = spyPublish()
        jest.spyOn(internalCache.AffordanceRoomDeliverable, 'get').mockResolvedValue({ schema: {} } as any)
        jest.spyOn(hydrateRoomRoster, 'getRoomCharacterList').mockResolvedValue([
            { EphemeraId: 'CHARACTER#A', DisplayName: 'A', Color: 'blue', SessionIds: [] },
        ])

        const roomId = 'ROOM#ObjAff' as const
        const ts = Date.now()
        messageBus.publish({
            type: 'StreamingEvent',
            dataSourceKey: EPHEMERA_OBJECTS_DATA_SOURCE_KEY,
            streamKey: roomId,
            timestamp: ts,
            header: {
                dataSourceKey: EPHEMERA_OBJECTS_DATA_SOURCE_KEY,
                streamKey: roomId,
                timestamp: ts,
                type: 'Objects Changed',
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Objects Changed',
                    createdIds: [],
                    destroyedIds: [],
                }),
        })
        await messageBus.flushAndSettle()

        const affordancePublishes = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
        })
        expect(affordancePublishes).toHaveLength(0)

        publishSpy.mockRestore()
    })

    describe('object manipulation presentation fan-in receiveEvents routing', () => {
        beforeEach(() => {
            jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
                Name: 'Alice',
                assets: ['ASSET#Test'],
            } as any)
            jest.spyOn(internalCache.ComponentAggregate, 'get').mockImplementation(async (perspectives: any[]) => {
                const key = perspectives[0]?.universalKey
                if (key === 'OBJECT#Table') {
                    return [{ merged: new StandardObject({ tag: 'Object', shortName: 'table' }) }] as any
                }
                return [{ merged: new StandardObject({ tag: 'Object', shortName: 'broom' }) }] as any
            })
            jest.spyOn(internalCache.ImprovisationComponentData, 'get').mockResolvedValue({} as any)
            jest.spyOn(roomHeaderBroadcastModule, 'resolveCharacterRoomPerspectiveForRoom').mockResolvedValue({
                perspective: { assetStack: ['ASSET#Test'] },
            } as any)
        })

        // Take/drop routing cases were removed in Phase 4 --- those events no longer reach this
        // data source at all (see `subscribedEvents.test.ts`, which pins the non-subscription).
        // What survives here is the relational family's end-to-end fan-in routing.
        it('intent + fact batch publishes single establish-relation WorldMessage', async () => {
            const publishSpy = spyPublish()

            publishObjectManipulationStreamingEvent(
                EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
                'Object Establish Relation',
                {
                    type: 'Object Establish Relation',
                    characterId: TAKE_HOLD_CHARACTER,
                    subjectId: TAKE_HOLD_OBJECT,
                    targetId: 'OBJECT#Table',
                    hostId: TAKE_HOLD_ROOM,
                    relationKind: 'Under',
                    steps: [{
                        kind: 'establishRelation',
                        subjectId: TAKE_HOLD_OBJECT,
                        targetId: 'OBJECT#Table',
                        relationKind: 'Under',
                        hostId: TAKE_HOLD_ROOM,
                    }],
                },
                TAKE_HOLD_CHARACTER
            )
            publishObjectManipulationStreamingEvent(
                EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
                'Object Relation Changed',
                {
                    type: 'Object Relation Changed',
                    subjectId: TAKE_HOLD_OBJECT,
                    targetId: 'OBJECT#Table',
                    hostId: TAKE_HOLD_ROOM,
                    relationKind: 'Under',
                    operation: 'establish',
                    beatAnchorTime: TAKE_HOLD_ANCHOR_TIME,
                },
                TAKE_HOLD_OBJECT
            )
            await messageBus.flushAndSettle()

            const worldPublishes = publishSpy.mock.calls.filter((c) => {
                const m = c[0] as { type?: string; displayProtocol?: string }
                return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage'
            })
            expect(worldPublishes).toHaveLength(1)
            expect(worldPublishes[0][0]).toMatchObject({
                targets: [TAKE_HOLD_ROOM],
                displayProtocol: 'WorldMessage',
                message: ['Alice puts broom under table'],
                createdTime: TAKE_HOLD_ANCHOR_TIME,
            })
            publishSpy.mockRestore()
        })

        it('intent + fact batch publishes single dissolve-relation WorldMessage', async () => {
            const publishSpy = spyPublish()

            publishObjectManipulationStreamingEvent(
                EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
                'Object Dissolve Relation',
                {
                    type: 'Object Dissolve Relation',
                    characterId: TAKE_HOLD_CHARACTER,
                    subjectId: TAKE_HOLD_OBJECT,
                    targetId: 'OBJECT#Table',
                    hostId: TAKE_HOLD_ROOM,
                    relationKind: 'Under',
                    steps: [{
                        kind: 'dissolveRelation',
                        subjectId: TAKE_HOLD_OBJECT,
                        targetId: 'OBJECT#Table',
                        relationKind: 'Under',
                        hostId: TAKE_HOLD_ROOM,
                    }],
                },
                TAKE_HOLD_CHARACTER
            )
            publishObjectManipulationStreamingEvent(
                EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
                'Object Relation Changed',
                {
                    type: 'Object Relation Changed',
                    subjectId: TAKE_HOLD_OBJECT,
                    targetId: 'OBJECT#Table',
                    hostId: TAKE_HOLD_ROOM,
                    relationKind: 'Under',
                    operation: 'dissolve',
                    beatAnchorTime: TAKE_HOLD_ANCHOR_TIME,
                },
                TAKE_HOLD_OBJECT
            )
            await messageBus.flushAndSettle()

            const worldPublishes = publishSpy.mock.calls.filter((c) => {
                const m = c[0] as { type?: string; displayProtocol?: string }
                return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage'
            })
            expect(worldPublishes).toHaveLength(1)
            expect(worldPublishes[0][0]).toMatchObject({
                message: ['Alice takes broom off table'],
                createdTime: TAKE_HOLD_ANCHOR_TIME,
            })
            publishSpy.mockRestore()
        })
    })
})
