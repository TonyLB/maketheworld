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
import { sendCharacterPerceptionRequested, sendPerceptionThreadRegistered } from './subscribedEvents'
import { ephemeraPerceptionDataSource } from './index'
import * as orchestrateModule from './orchestrate'
import * as roomHeaderBroadcastModule from './kickRoomHeaderBroadcast'

const MEMBERSHIP_CHARACTER = 'CHARACTER#Alice' as const
const MEMBERSHIP_ROOM_A = 'ROOM#a' as const
const MEMBERSHIP_ROOM_B = 'ROOM#b' as const
const MEMBERSHIP_ANCHOR_TIME = 1_700_000_000_000

const TAKE_HOLD_CHARACTER = 'CHARACTER#Alice' as const
const TAKE_HOLD_OBJECT = 'OBJECT#Broom' as const
const TAKE_HOLD_ROOM = 'ROOM#Cafe' as const
const TAKE_HOLD_ANCHOR_TIME = 1_700_000_000_100

function publishMembershipStreamingEvent(
    dataSourceKey: string,
    type: string,
    content: object
): void {
    const ts = Date.now()
    messageBus.publish({
        type: 'StreamingEvent',
        dataSourceKey,
        streamKey: MEMBERSHIP_CHARACTER,
        timestamp: ts,
        header: {
            dataSourceKey,
            streamKey: MEMBERSHIP_CHARACTER,
            timestamp: ts,
            type,
        },
        getContent: () => Promise.resolve(content),
    })
}

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

    it('receiveEvents emits PublishMessage for Character Perception Requested ingress', async () => {
        const publishSpy = spyPublish()

        sendCharacterPerceptionRequested(messageBus, 'CHARACTER#SUBJECT', {
            characterId: 'CHARACTER#VIEWER',
            ephemeraId: 'CHARACTER#SUBJECT',
        })
        await messageBus.flushAndSettle()

        expect(ephemeraDBMock.getItem).toHaveBeenCalledWith({
            Key: {
                EphemeraId: 'CHARACTER#SUBJECT',
                DataCategory: 'Meta::Character',
            },
            ProjectionFields: ['Name', 'Pronouns', 'fileURL', 'Color'],
        })
        expect(publishSpy.mock.calls.some((call) => call[0]?.type === 'PublishMessage' && call[0]?.displayProtocol === 'PerceptionMessage')).toBe(true)
        publishSpy.mockRestore()
    })

    it('receiveEvents stores Perception Thread Registered in internalCache.PerceptionThreads without PublishMessage', async () => {
        const publishSpy = spyPublish()

        sendPerceptionThreadRegistered(messageBus, 'ROOM#REG', {
            threadKind: 'roomDescription',
            componentId: 'ROOM#REG',
            perspectiveKey: 'view-1',
            characterId: 'CHARACTER#viewer',
        })
        await messageBus.flushAndSettle()

        const listed = internalCache.PerceptionThreads.list('ROOM#REG', 'view-1')
        expect(listed).toHaveLength(1)
        const entry = listed[0]
        expect(entry.thread).toMatchObject({
            kind: 'roomDescription',
            status: 'Initial',
        })
        expect(entry.registration).toMatchObject({
            threadKind: 'roomDescription',
            componentId: 'ROOM#REG',
            perspectiveKey: 'view-1',
            characterId: 'CHARACTER#viewer',
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

    it('roomDescription Generation Started publishes render-channel full-room WML with Render placeholder (no Example)', async () => {
        const publishSpy = spyPublish()

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'roomDescription',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
        })
        await messageBus.flushAndSettle()

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

    it('roomDescription Orchestration Error publishes full-room Render placeholder and removes thread', async () => {
        const publishSpy = spyPublish()

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'roomDescription',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
        })
        await messageBus.flushAndSettle()

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
        expect(internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)).toEqual(
            []
        )
        publishSpy.mockRestore()
    })

    it('roomDescription Generation Deferred publishes full-room Render placeholder and removes thread', async () => {
        const publishSpy = spyPublish()

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'roomDescription',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
        })
        await messageBus.flushAndSettle()

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
        expect(internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)).toEqual(
            []
        )
        publishSpy.mockRestore()
    })

    it('room thread receives Generation Started then terminal Render Pertains with stable messageId', async () => {
        const publishSpy = spyPublish()

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'roomDescription',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
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

        const listedAfterGen = internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)
        expect(listedAfterGen[0]?.thread).toMatchObject({
            status: 'Generating',
            createdTime: 1000000000000,
        })

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
        expect(internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)).toEqual([])

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

        const targets = ['CHARACTER#viewer'] as const
        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'sessionOrientationRender',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
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
        expect(
            internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)
        ).toEqual([])

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove receives Generation Started then terminal Render Pertains with stable messageId (mover header)', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveTerminal />')

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'characterMove',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
            targets: ['CHARACTER#viewer'],
            messageGroupId: 'MSG#root',
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
                && m?.targets?.length === 1
                && m.targets[0] === 'CHARACTER#viewer'
            )
        })
        expect(genPublish).toBeDefined()
        expect((genPublish![0] as { metaData?: { roomChannel?: string } }).metaData?.roomChannel).toBe('render')
        const mid = (genPublish![0] as { messageId?: string }).messageId
        expect(mid).toMatch(/^MESSAGE#/)
        const genCreatedTime = (genPublish![0] as { createdTime?: number }).createdTime
        expect(genCreatedTime).toBe(1000000000000)
        expect((genPublish![0] as { deliveryMode?: string }).deliveryMode).toBe('deferred')
        const worldMessages = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; displayProtocol?: string }
            return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage'
        })
        expect(worldMessages).toHaveLength(0)

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
            return m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveTerminal />' && m?.metaData?.displayMode === 'header'
        })
        expect(terminalPublish).toBeDefined()
        expect((terminalPublish![0] as { metaData?: { roomChannel?: string } }).metaData?.roomChannel).toBe('render')
        expect((terminalPublish![0] as { messageId?: string }).messageId).toBe(mid)
        expect((terminalPublish![0] as { createdTime?: number }).createdTime).toBeGreaterThan(genCreatedTime!)
        expect(
            internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)
        ).toEqual([])

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove terminal Render Pertains reports a messageOrchestration slot instead of publishing directly when the thread carries bundleId/slotId', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveBundled />')

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'characterMove',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
            targets: ['CHARACTER#viewer'],
            bundleId: 'BUNDLE#test',
            slotId: 'header',
        })
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

        const directPublishes = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; wmlContent?: string }
            return m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveBundled />'
        })
        expect(directPublishes).toHaveLength(0)

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

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove cache hit synthesizes Generating at beat anchor then terminal Render Pertains', async () => {
        const BEAT_ANCHOR = 1_700_000_000_000
        mockGetCurrentTimestamp.mockImplementation(() => BEAT_ANCHOR + 5)

        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveTerminal />')

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'characterMove',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
            targets: ['CHARACTER#viewer'],
            messageGroupId: 'MSG#root',
            messageId: 'MESSAGE#move-header',
            createdTime: BEAT_ANCHOR,
        })
        await messageBus.flushAndSettle()

        await sendRenderPertainsStreamingEvent()

        const genPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { displayMode?: string; status?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.displayMode === 'header' && m?.metaData?.status === 'generating'
        })
        expect(genPublish).toBeDefined()
        expect((genPublish![0] as { createdTime?: number }).createdTime).toBe(BEAT_ANCHOR)
        expect((genPublish![0] as { messageId?: string }).messageId).toBe('MESSAGE#move-header')

        const terminalPublish = publishSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string; metaData?: { displayMode?: string; status?: string } }
            return (
                m?.type === 'PublishMessage'
                && m?.wmlContent === '<HeaderMoveTerminal />'
                && m?.metaData?.displayMode === 'header'
                && m?.metaData?.status !== 'generating'
            )
        })
        expect(terminalPublish).toBeDefined()
        expect((terminalPublish![0] as { messageId?: string }).messageId).toBe('MESSAGE#move-header')
        expect((terminalPublish![0] as { createdTime?: number }).createdTime).toBeGreaterThan(BEAT_ANCHOR)
        expect(
            internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)
        ).toEqual([])

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('characterMove publishes header at most once across repeated orchestration events', async () => {
        const publishSpy = spyPublish()
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveTerminal />')

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'characterMove',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
            targets: ['CHARACTER#viewer'],
            messageGroupId: 'MSG#root',
        })
        await messageBus.flushAndSettle()

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

    describe('membership presentation fan-in receiveEvents routing', () => {
        it('routes Character Navigate through fan-in without calling orchestrateRoomDescriptionStreams', async () => {
            const orchestrateSpy = jest.spyOn(orchestrateModule, 'orchestrateRoomDescriptionStreams')

            publishMembershipStreamingEvent(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Navigate', {
                type: 'Character Navigate',
                characterId: MEMBERSHIP_CHARACTER,
                fromRoomId: MEMBERSHIP_ROOM_A,
                toRoomId: MEMBERSHIP_ROOM_B,
            })
            await messageBus.flushAndSettle()

            expect(orchestrateSpy).not.toHaveBeenCalled()
            orchestrateSpy.mockRestore()
        })

        it('mixed batch: Character Navigate and Perception Thread Registered both handled', async () => {
            const orchestrateSpy = jest.spyOn(orchestrateModule, 'orchestrateRoomDescriptionStreams')

            publishMembershipStreamingEvent(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Navigate', {
                type: 'Character Navigate',
                characterId: MEMBERSHIP_CHARACTER,
                fromRoomId: MEMBERSHIP_ROOM_A,
                toRoomId: MEMBERSHIP_ROOM_B,
            })
            sendPerceptionThreadRegistered(messageBus, 'ROOM#REG', {
                threadKind: 'roomDescription',
                componentId: 'ROOM#REG',
                perspectiveKey: 'view-1',
                characterId: 'CHARACTER#viewer',
            })
            await messageBus.flushAndSettle()

            expect(orchestrateSpy).not.toHaveBeenCalled()
            const listed = internalCache.PerceptionThreads.list('ROOM#REG', 'view-1')
            expect(listed).toHaveLength(1)
            expect(listed[0].registration).toMatchObject({
                threadKind: 'roomDescription',
                componentId: 'ROOM#REG',
            })
            orchestrateSpy.mockRestore()
        })

        it('intent + fact batch publishes leave and arrive WorldMessages', async () => {
            const publishSpy = spyPublish()

            publishMembershipStreamingEvent(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Navigate', {
                type: 'Character Navigate',
                characterId: MEMBERSHIP_CHARACTER,
                fromRoomId: MEMBERSHIP_ROOM_A,
                toRoomId: MEMBERSHIP_ROOM_B,
            })
            publishMembershipStreamingEvent(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Character Moved', {
                type: 'Character Moved',
                characterId: MEMBERSHIP_CHARACTER,
                froms: [MEMBERSHIP_ROOM_A],
                to: MEMBERSHIP_ROOM_B,
                beatAnchorTime: MEMBERSHIP_ANCHOR_TIME,
            })
            await messageBus.flushAndSettle()

            const worldPublishes = publishSpy.mock.calls.filter((c) => {
                const m = c[0] as { type?: string; displayProtocol?: string }
                return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage'
            })
            expect(worldPublishes).toHaveLength(2)
            expect((worldPublishes[0][0] as { createdTime?: number }).createdTime).toBe(MEMBERSHIP_ANCHOR_TIME - 1)
            expect((worldPublishes[1][0] as { createdTime?: number }).createdTime).toBe(MEMBERSHIP_ANCHOR_TIME + 1)
            publishSpy.mockRestore()
        })

        it('navigate intent with exitName publishes exit-aware leave copy', async () => {
            const publishSpy = spyPublish()

            publishMembershipStreamingEvent(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Navigate', {
                type: 'Character Navigate',
                characterId: MEMBERSHIP_CHARACTER,
                fromRoomId: MEMBERSHIP_ROOM_A,
                toRoomId: MEMBERSHIP_ROOM_B,
                exitName: 'north',
            })
            publishMembershipStreamingEvent(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Character Moved', {
                type: 'Character Moved',
                characterId: MEMBERSHIP_CHARACTER,
                froms: [MEMBERSHIP_ROOM_A],
                to: MEMBERSHIP_ROOM_B,
                beatAnchorTime: MEMBERSHIP_ANCHOR_TIME,
                characterName: 'Alice',
            })
            await messageBus.flushAndSettle()

            const worldPublishes = publishSpy.mock.calls.filter((c) => {
                const m = c[0] as { type?: string; displayProtocol?: string; message?: string[] }
                return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage'
            })
            expect(worldPublishes).toHaveLength(2)
            expect((worldPublishes[0][0] as { message?: string[] }).message).toEqual(['Alice left by north exit.'])
            publishSpy.mockRestore()
        })

        it('disconnect intent + fact publishes leave-only disconnect copy', async () => {
            const publishSpy = spyPublish()

            publishMembershipStreamingEvent('mtw.connections.characters', 'Character Disconnected', {
                type: 'Character Disconnected',
                characterId: MEMBERSHIP_CHARACTER,
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            })
            publishMembershipStreamingEvent(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Character Moved', {
                type: 'Character Moved',
                characterId: MEMBERSHIP_CHARACTER,
                froms: [MEMBERSHIP_ROOM_A],
                to: null,
                beatAnchorTime: MEMBERSHIP_ANCHOR_TIME,
                characterName: 'Alice',
            })
            await messageBus.flushAndSettle()

            const worldPublishes = publishSpy.mock.calls.filter((c) => {
                const m = c[0] as { type?: string; displayProtocol?: string; message?: string[] }
                return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage'
            })
            expect(worldPublishes).toHaveLength(1)
            expect((worldPublishes[0][0] as { message?: string[] }).message).toEqual(['Alice has disconnected.'])
            publishSpy.mockRestore()
        })

        it('connect intent + fact publishes arrive-only connect copy', async () => {
            const publishSpy = spyPublish()

            publishMembershipStreamingEvent('mtw.connections.characters', 'Character Connected', {
                type: 'Character Connected',
                characterId: MEMBERSHIP_CHARACTER,
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            })
            publishMembershipStreamingEvent(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Character Moved', {
                type: 'Character Moved',
                characterId: MEMBERSHIP_CHARACTER,
                froms: [],
                to: MEMBERSHIP_ROOM_B,
                beatAnchorTime: MEMBERSHIP_ANCHOR_TIME,
                characterName: 'Alice',
            })
            await messageBus.flushAndSettle()

            const worldPublishes = publishSpy.mock.calls.filter((c) => {
                const m = c[0] as { type?: string; displayProtocol?: string; message?: string[] }
                return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage'
            })
            expect(worldPublishes).toHaveLength(1)
            expect((worldPublishes[0][0] as { message?: string[] }).message).toEqual(['Alice has connected.'])
            publishSpy.mockRestore()
        })

        it('fact before intent still publishes after correlation', async () => {
            const publishSpy = spyPublish()

            publishMembershipStreamingEvent(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Character Moved', {
                type: 'Character Moved',
                characterId: MEMBERSHIP_CHARACTER,
                froms: [MEMBERSHIP_ROOM_A],
                to: MEMBERSHIP_ROOM_B,
                beatAnchorTime: MEMBERSHIP_ANCHOR_TIME,
            })
            publishMembershipStreamingEvent(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Navigate', {
                type: 'Character Navigate',
                characterId: MEMBERSHIP_CHARACTER,
                fromRoomId: MEMBERSHIP_ROOM_A,
                toRoomId: MEMBERSHIP_ROOM_B,
            })
            await messageBus.flushAndSettle()

            const worldPublishes = publishSpy.mock.calls.filter((c) => {
                const m = c[0] as { type?: string; displayProtocol?: string }
                return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage'
            })
            expect(worldPublishes).toHaveLength(2)
            publishSpy.mockRestore()
        })

        it('fact-only at settle publishes generic leave and arrive copy', async () => {
            const publishSpy = spyPublish()

            publishMembershipStreamingEvent(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Character Moved', {
                type: 'Character Moved',
                characterId: MEMBERSHIP_CHARACTER,
                froms: [MEMBERSHIP_ROOM_A],
                to: MEMBERSHIP_ROOM_B,
                beatAnchorTime: MEMBERSHIP_ANCHOR_TIME,
                characterName: 'Alice',
            })
            await messageBus.flushAndSettle()

            const worldPublishes = publishSpy.mock.calls.filter((c) => {
                const m = c[0] as { type?: string; displayProtocol?: string; message?: string[] }
                return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage'
            })
            expect(worldPublishes).toHaveLength(2)
            expect((worldPublishes[0][0] as { message?: string[] }).message).toEqual(['Alice has left.'])
            publishSpy.mockRestore()
        })
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

        it('intent + fact batch publishes single take-hold WorldMessage', async () => {
            const publishSpy = spyPublish()

            publishObjectManipulationStreamingEvent(
                EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
                'Object Take Hold',
                {
                    type: 'Object Take Hold',
                    characterId: TAKE_HOLD_CHARACTER,
                    objectIds: [TAKE_HOLD_OBJECT],
                    roomId: TAKE_HOLD_ROOM,
                },
                TAKE_HOLD_CHARACTER
            )
            publishObjectManipulationStreamingEvent(
                EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
                'Object Moved',
                {
                    type: 'Object Moved',
                    objectId: TAKE_HOLD_OBJECT,
                    froms: [TAKE_HOLD_ROOM],
                    to: TAKE_HOLD_CHARACTER,
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
                targets: [TAKE_HOLD_ROOM, TAKE_HOLD_CHARACTER],
                displayProtocol: 'WorldMessage',
                message: ['Alice picks up broom'],
                createdTime: TAKE_HOLD_ANCHOR_TIME,
                deliveryMode: 'deferred',
            })
            publishSpy.mockRestore()
        })

        it('intent + fact batch publishes single drop WorldMessage', async () => {
            const publishSpy = spyPublish()

            publishObjectManipulationStreamingEvent(
                EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
                'Object Drop',
                {
                    type: 'Object Drop',
                    characterId: TAKE_HOLD_CHARACTER,
                    objectIds: [TAKE_HOLD_OBJECT],
                    roomId: TAKE_HOLD_ROOM,
                },
                TAKE_HOLD_CHARACTER
            )
            publishObjectManipulationStreamingEvent(
                EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
                'Object Moved',
                {
                    type: 'Object Moved',
                    objectId: TAKE_HOLD_OBJECT,
                    froms: [TAKE_HOLD_CHARACTER],
                    to: TAKE_HOLD_ROOM,
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
                targets: [TAKE_HOLD_ROOM, TAKE_HOLD_CHARACTER],
                displayProtocol: 'WorldMessage',
                message: ['Alice drops broom'],
                createdTime: TAKE_HOLD_ANCHOR_TIME,
                deliveryMode: 'deferred',
            })
            publishSpy.mockRestore()
        })

        it('fact before intent still publishes after correlation', async () => {
            const publishSpy = spyPublish()

            publishObjectManipulationStreamingEvent(
                EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
                'Object Moved',
                {
                    type: 'Object Moved',
                    objectId: TAKE_HOLD_OBJECT,
                    froms: [TAKE_HOLD_ROOM],
                    to: TAKE_HOLD_CHARACTER,
                    beatAnchorTime: TAKE_HOLD_ANCHOR_TIME,
                },
                TAKE_HOLD_OBJECT
            )
            publishObjectManipulationStreamingEvent(
                EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
                'Object Take Hold',
                {
                    type: 'Object Take Hold',
                    characterId: TAKE_HOLD_CHARACTER,
                    objectIds: [TAKE_HOLD_OBJECT],
                    roomId: TAKE_HOLD_ROOM,
                },
                TAKE_HOLD_CHARACTER
            )
            await messageBus.flushAndSettle()

            const worldPublishes = publishSpy.mock.calls.filter((c) => {
                const m = c[0] as { type?: string; displayProtocol?: string }
                return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage'
            })
            expect(worldPublishes).toHaveLength(1)
            publishSpy.mockRestore()
        })

        it('routes Object Take Hold through fan-in without calling orchestrateRoomDescriptionStreams', async () => {
            const orchestrateSpy = jest.spyOn(orchestrateModule, 'orchestrateRoomDescriptionStreams')

            publishObjectManipulationStreamingEvent(
                EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
                'Object Take Hold',
                {
                    type: 'Object Take Hold',
                    characterId: TAKE_HOLD_CHARACTER,
                    objectIds: [TAKE_HOLD_OBJECT],
                    roomId: TAKE_HOLD_ROOM,
                },
                TAKE_HOLD_CHARACTER
            )
            await messageBus.flushAndSettle()

            expect(orchestrateSpy).not.toHaveBeenCalled()
            orchestrateSpy.mockRestore()
        })

        it('routes Object Drop through fan-in without calling orchestrateRoomDescriptionStreams', async () => {
            const orchestrateSpy = jest.spyOn(orchestrateModule, 'orchestrateRoomDescriptionStreams')

            publishObjectManipulationStreamingEvent(
                EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
                'Object Drop',
                {
                    type: 'Object Drop',
                    characterId: TAKE_HOLD_CHARACTER,
                    objectIds: [TAKE_HOLD_OBJECT],
                    roomId: TAKE_HOLD_ROOM,
                },
                TAKE_HOLD_CHARACTER
            )
            await messageBus.flushAndSettle()

            expect(orchestrateSpy).not.toHaveBeenCalled()
            orchestrateSpy.mockRestore()
        })

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
                    relationKind: 'On',
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
                    relationKind: 'On',
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
                targets: [TAKE_HOLD_ROOM, TAKE_HOLD_CHARACTER],
                displayProtocol: 'WorldMessage',
                message: ['Alice puts broom on table'],
                createdTime: TAKE_HOLD_ANCHOR_TIME,
                deliveryMode: 'deferred',
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
                    relationKind: 'On',
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
                    relationKind: 'On',
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
