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
import { sendPerceptionThreadRegistered } from './subscribedEvents'
import { registerIngressSlot } from '../messageOrchestration'
import { ephemeraPerceptionDataSource } from './index'
import * as orchestrateModule from './orchestrate'
import * as roomHeaderBroadcastModule from './kickRoomHeaderBroadcast'

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

    /** The stamp every single-listener test registers with: tests assert waves against it. */
    const LISTENER_CREATED_TIME = 5000

    /**
     * Ingress registration for a characterMove header listener at its own time and MessageId ---
     * what presentStepSequence's header `describe` step does in production. Deliberately does not
     * flush: the first real trigger event's own flush processes everything queued so far.
     */
    async function registerCharacterMoveIngress(messageId: string, targets: string[] = ['CHARACTER#viewer']): Promise<void> {
        await registerIngressSlot(messageBus, { createdTime: LISTENER_CREATED_TIME, messageId }, {
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            targets: targets as any,
            contentStream: 'render',
            format: 'header',
        })
    }

    /**
     * roomDescription shares the exact same (componentId, perspectiveKey, 'render') bucket
     * characterMove/sessionOrientationRender use, differing only by `format:'full'`.
     */
    async function registerRoomDescriptionIngress(messageId: string, targets: string[] = ['CHARACTER#viewer']): Promise<void> {
        await registerIngressSlot(messageBus, { createdTime: LISTENER_CREATED_TIME, messageId }, {
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            targets: targets as any,
            contentStream: 'render',
            format: 'full',
        })
    }

    it('roomDescription Generation Started publishes render-channel full-room WML with Render placeholder (no Example)', async () => {
        const publishSpy = spyPublish()

        await registerRoomDescriptionIngress('MESSAGE#roomDescription')

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

        await registerRoomDescriptionIngress('MESSAGE#roomDescription')

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

        await registerRoomDescriptionIngress('MESSAGE#roomDescription')

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

        await registerRoomDescriptionIngress('MESSAGE#roomDescription')

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
        expect(mid).toBe('MESSAGE#roomDescription')
        const genCreatedTime = (genPublish![0] as { createdTime?: number }).createdTime
        expect(genCreatedTime).toBe(LISTENER_CREATED_TIME)

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

        await registerCharacterMoveIngress('MESSAGE#sessionOrientationRender')

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

        await registerCharacterMoveIngress('MESSAGE#test')

        await sendRenderPertainsStreamingEvent()

        expect(rosterSpy).not.toHaveBeenCalled()
        const headerPublishes = publishSpy.mock.calls
            .map((c) => c[0] as { type?: string; wmlContent?: string })
            .filter((m) => m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveNoFallback />')
        expect(headerPublishes).toHaveLength(1)
        expect(headerPublishes[0]).toMatchObject({ targets: ['CHARACTER#viewer'], messageId: 'MESSAGE#test' })

        rosterSpy.mockRestore()
        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove: terminal-only content publishes once, at the listener\'s own time and MessageId', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveDirect />')

        await registerCharacterMoveIngress('MESSAGE#test')

        await sendRenderPertainsStreamingEvent()

        const published = publishSpy.mock.calls
            .map((c) => c[0] as { type?: string; wmlContent?: string })
            .filter((m) => m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveDirect />')
        expect(published).toHaveLength(1)
        expect(published[0]).toMatchObject({
            targets: ['CHARACTER#viewer'],
            messageId: 'MESSAGE#test',
            createdTime: LISTENER_CREATED_TIME,
        })

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove: placeholder publishes at the listener\'s stamp, terminal revises the same MessageId at a strictly greater time', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveDirect />')

        await registerCharacterMoveIngress('MESSAGE#test')

        await sendOrchestrationStreamingEvent(makePassThroughGenerationStartedPayload())

        const placeholderPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { status?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.status === 'generating'
        })
        expect(placeholderPublish).toBeDefined()
        expect(placeholderPublish![0]).toMatchObject({ messageId: 'MESSAGE#test', createdTime: LISTENER_CREATED_TIME })

        await sendRenderPertainsStreamingEvent()

        const terminal = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string }
            return m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveDirect />'
        })
        expect(terminal).toBeDefined()
        expect((terminal![0] as { messageId?: string }).messageId).toBe('MESSAGE#test')
        expect((terminal![0] as { createdTime?: number }).createdTime).toBeGreaterThan(LISTENER_CREATED_TIME)

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove: a late Generation Started after the terminal publishes again under the same MessageId instead of being silently discarded', async () => {
        // ContentIngressIndex never removes a listener, so a repeat/out-of-order wave gets a
        // redundant re-publish (same messageId) rather than being silently dropped. Its
        // createdTime is anchored to the listener's last publish (`max(last + 1, now)`), so it is
        // guaranteed to sort strictly after it.
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveDirect />')

        await registerCharacterMoveIngress('MESSAGE#test')

        await sendRenderPertainsStreamingEvent()

        const terminalPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string }
            return m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveDirect />'
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

    it('characterMove: two movers sharing (componentId, perspectiveKey) each get their own addressed publish from the same shared content', async () => {
        // Two listeners (movers) registered against the same (componentId, perspectiveKey,
        // contentStream) key. Content resolves once and fans out to both, each building its own
        // addressed envelope from its own targets and MessageId.
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveShared />')

        await registerCharacterMoveIngress('MESSAGE#one', ['CHARACTER#one'])
        await registerCharacterMoveIngress('MESSAGE#two', ['CHARACTER#two'])

        await sendRenderPertainsStreamingEvent()

        const publishedHeaders = publishSpy.mock.calls
            .map((c) => c[0] as { type?: string; wmlContent?: string; targets?: string[]; messageId?: string })
            .filter((m) => m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveShared />')
        expect(publishedHeaders.map((m) => [m.messageId, m.targets]).sort()).toEqual([
            ['MESSAGE#one', ['CHARACTER#one']],
            ['MESSAGE#two', ['CHARACTER#two']],
        ])

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove cache hit (no Generation Started) delivers the terminal alone, with no synthesized Generating placeholder', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveTerminal />')

        await registerCharacterMoveIngress('MESSAGE#test')

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

        await registerCharacterMoveIngress('MESSAGE#test')

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
})
