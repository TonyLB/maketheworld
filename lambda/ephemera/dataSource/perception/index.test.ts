jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import * as schemaModule from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import {
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
import { roomHeaderGeneratingPlaceholderWml } from './roomHeaderPlaceholderWml'
import { sendCharacterPerceptionRequested, sendPerceptionThreadRegistered } from './subscribedEvents'
import { ephemeraPerceptionDataSource } from './index'
import * as roomHeaderBroadcastModule from './kickRoomHeaderBroadcast'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('mtw.ephemera.perception DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
        internalCache.clear()
        ephemeraDBMock.getItem.mockResolvedValue({
            Name: 'Test',
            Pronouns: 'they/them',
        })
    })

    it('registers subscription and flush completes without error when queue is empty', async () => {
        expect(ephemeraPerceptionDataSource.dataSourceKey).toBe('mtw.ephemera.perception')
        await expect(messageBus.flush()).resolves.toBeUndefined()
    })

    it('receiveEvents emits PublishMessage for Character Perception Requested ingress', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')

        sendCharacterPerceptionRequested(messageBus, 'CHARACTER#SUBJECT', {
            characterId: 'CHARACTER#VIEWER',
            ephemeraId: 'CHARACTER#SUBJECT',
        })
        await messageBus.flush()

        expect(ephemeraDBMock.getItem).toHaveBeenCalledWith({
            Key: {
                EphemeraId: 'CHARACTER#SUBJECT',
                DataCategory: 'Meta::Character',
            },
            ProjectionFields: ['Name', 'Pronouns', 'fileURL', 'Color'],
        })
        expect(sendSpy.mock.calls.some((call) => call[0]?.type === 'PublishMessage' && call[0]?.displayProtocol === 'PerceptionMessage')).toBe(true)
        sendSpy.mockRestore()
    })

    it('receiveEvents stores Perception Thread Registered in internalCache.PerceptionThreads without PublishMessage', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')

        sendPerceptionThreadRegistered(messageBus, 'ROOM#REG', {
            threadKind: 'roomDescription',
            componentId: 'ROOM#REG',
            perspectiveKey: 'view-1',
            characterId: 'CHARACTER#viewer',
        })
        await messageBus.flush()

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
        expect(sendSpy.mock.calls.some((call) => call[0]?.type === 'PublishMessage')).toBe(false)
        sendSpy.mockRestore()
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
        messageBus.send({
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
        await messageBus.flush()
    }

    async function sendRenderPertainsStreamingEvent(): Promise<void> {
        const tsCache = Date.now()
        messageBus.send({
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
        await messageBus.flush()
    }

    it('roomDescription Generation Started publishes render-channel full-room WML with Render placeholder (no Example)', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'roomDescription',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
        })
        await messageBus.flush()

        await sendOrchestrationStreamingEvent(makePassThroughGenerationStartedPayload())

        const genPublish = sendSpy.mock.calls.find((c) => {
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
        sendSpy.mockRestore()
    })

    it('roomDescription Orchestration Error publishes full-room Render placeholder and removes thread', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'roomDescription',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
        })
        await messageBus.flush()

        await sendOrchestrationStreamingEvent(makePassThroughOrchestrationErrorPayload())

        const errPublish = sendSpy.mock.calls.find((c) => {
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
        sendSpy.mockRestore()
    })

    it('roomDescription Generation Deferred publishes full-room Render placeholder and removes thread', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'roomDescription',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
        })
        await messageBus.flush()

        await sendOrchestrationStreamingEvent(makePassThroughGenerationDeferredPayload())

        const defPublish = sendSpy.mock.calls.find((c) => {
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
        sendSpy.mockRestore()
    })

    it('room thread receives Generation Started then terminal Render Pertains with stable messageId', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<RoomTerminal />')

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'roomDescription',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
        })
        await messageBus.flush()

        const genStarted = makePassThroughGenerationStartedPayload()
        const tsOrch = Date.now()
        messageBus.send({
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
        await messageBus.flush()

        const genPublish = sendSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; metaData?: { status?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.status === 'generating'
        })
        expect(genPublish).toBeDefined()
        expect((genPublish![0] as { metaData?: { roomChannel?: string } }).metaData?.roomChannel).toBe('render')
        const mid = (genPublish![0] as { messageId?: string }).messageId
        expect(mid).toMatch(/^MESSAGE#/)

        const tsCache = Date.now()
        messageBus.send({
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
        await messageBus.flush()

        const terminalPublish = sendSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string }
            return m?.type === 'PublishMessage' && m?.wmlContent === '<RoomTerminal />'
        })
        expect(terminalPublish).toBeDefined()
        expect((terminalPublish![0] as { metaData?: { roomChannel?: string } }).metaData?.roomChannel).toBe('render')
        expect((terminalPublish![0] as { messageId?: string }).messageId).toBe(mid)
        expect(internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)).toEqual([])

        schemaSpy.mockRestore()
        sendSpy.mockRestore()
    })

    it('roomHeaderBroadcast receives Generation Started then terminal Render Pertains with stable messageId', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderTerminal />')

        const targets = ['CHARACTER#viewer', 'CHARACTER#other'] as const
        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'roomHeaderBroadcast',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            targets: [...targets],
        })
        await messageBus.flush()

        const genStarted = makePassThroughGenerationStartedPayload()
        const tsOrch = Date.now()
        messageBus.send({
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
        await messageBus.flush()

        const genPublish = sendSpy.mock.calls.find((c) => {
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
        messageBus.send({
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
        await messageBus.flush()

        const terminalPublish = sendSpy.mock.calls.find((c) => {
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
        sendSpy.mockRestore()
    })

    it('characterMove receives Generation Started then terminal Render Pertains with stable messageId (mover header)', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveTerminal />')

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'characterMove',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
            departureRoomId: 'ROOM#other',
            messageGroupId: 'MSG#root',
            leaveMessageGroupId: 'MSG#leave',
            arriveMessageGroupId: 'MSG#arrive',
            leaveWorldMessage: {
                targets: ['ROOM#other', 'CHARACTER#viewer'],
                message: ['Viewer has left.'],
            },
            arriveWorldMessage: {
                targets: ['ROOM#fixture', 'CHARACTER#viewer'],
                message: ['Viewer has arrived.'],
            },
        })
        await messageBus.flush()

        const genStarted = makePassThroughGenerationStartedPayload()
        const tsOrch = Date.now()
        messageBus.send({
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
        await messageBus.flush()

        const genPublish = sendSpy.mock.calls.find((c) => {
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
        const leavePublish = sendSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; displayProtocol?: string; messageGroupId?: string }
            return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage' && m?.messageGroupId === 'MSG#leave'
        })
        expect(leavePublish).toBeDefined()
        const arrivePublish = sendSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; displayProtocol?: string; messageGroupId?: string }
            return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage' && m?.messageGroupId === 'MSG#arrive'
        })
        expect(arrivePublish).toBeDefined()
        const leaveIndex = sendSpy.mock.calls.indexOf(leavePublish!)
        const headerIndex = sendSpy.mock.calls.indexOf(genPublish!)
        const arriveIndex = sendSpy.mock.calls.indexOf(arrivePublish!)
        expect(leaveIndex).toBeLessThan(headerIndex)
        expect(headerIndex).toBeLessThan(arriveIndex)

        const tsCache = Date.now()
        messageBus.send({
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
        await messageBus.flush()

        const terminalPublish = sendSpy.mock.calls.find((c) => {
            const m = c[0] as { type?: string; wmlContent?: string; metaData?: { displayMode?: string } }
            return m?.type === 'PublishMessage' && m?.wmlContent === '<HeaderMoveTerminal />' && m?.metaData?.displayMode === 'header'
        })
        expect(terminalPublish).toBeDefined()
        expect((terminalPublish![0] as { metaData?: { roomChannel?: string } }).metaData?.roomChannel).toBe('render')
        expect((terminalPublish![0] as { messageId?: string }).messageId).toBe(mid)
        expect(
            internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)
        ).toEqual([])

        schemaSpy.mockRestore()
        sendSpy.mockRestore()
    })

    it('characterMove dispatches leave/arrive at most once across repeated orchestration events', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<HeaderMoveTerminal />')

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
            threadKind: 'characterMove',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#viewer',
            departureRoomId: 'ROOM#other',
            messageGroupId: 'MSG#root',
            leaveMessageGroupId: 'MSG#leave',
            arriveMessageGroupId: 'MSG#arrive',
            leaveWorldMessage: {
                targets: ['ROOM#other', 'CHARACTER#viewer'],
                message: ['Viewer has left.'],
            },
            arriveWorldMessage: {
                targets: ['ROOM#fixture', 'CHARACTER#viewer'],
                message: ['Viewer has arrived.'],
            },
        })
        await messageBus.flush()

        const generationEvent = () => {
            const tsOrch = Date.now()
            messageBus.send({
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
        await messageBus.flush()

        const tsCache = Date.now()
        messageBus.send({
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
        await messageBus.flush()

        const leavePublishes = sendSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; displayProtocol?: string; messageGroupId?: string }
            return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage' && m?.messageGroupId === 'MSG#leave'
        })
        const arrivePublishes = sendSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; displayProtocol?: string; messageGroupId?: string }
            return m?.type === 'PublishMessage' && m?.displayProtocol === 'WorldMessage' && m?.messageGroupId === 'MSG#arrive'
        })
        expect(leavePublishes).toHaveLength(1)
        expect(arrivePublishes).toHaveLength(1)

        schemaSpy.mockRestore()
        sendSpy.mockRestore()
    })

    it('Render Pertains fallback publishes render header to perspective-matched occupants when no threads registered', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<FallbackHeader />')
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([
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

        const fallbackPublish = sendSpy.mock.calls.find((c) => {
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
        sendSpy.mockRestore()
    })

    it('Render Pertains fallback does not publish when no occupants match perspective key', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<FallbackHeaderNoMatch />')
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([
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

        const fallbackPublishes = sendSpy.mock.calls.filter((c) => {
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
        sendSpy.mockRestore()
    })

    it('receiveEvents publishes affordance PerceptionMessage per character on Objects Changed stream', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<RoomAffordance />')
        const mergeSpy = jest.spyOn(internalCache.ComponentStackMerge, 'get').mockResolvedValue({ schema: {} } as any)
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([
            { EphemeraId: 'CHARACTER#A', DisplayName: 'A', Color: 'blue', SessionIds: [] },
            { EphemeraId: 'CHARACTER#B', DisplayName: 'B', Color: 'purple', SessionIds: [] },
        ])
        jest.spyOn(internalCache.ComponentEphemeraMeta, 'get').mockResolvedValue(undefined)

        const roomId = 'ROOM#ObjAff' as const
        const ts = Date.now()
        messageBus.send({
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
                    componentId: roomId,
                    add: [],
                    remove: [],
                    priorObjects: [],
                    newObjects: [],
                }),
        })
        await messageBus.flush()

        const affordancePublishes = sendSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
        })
        expect(affordancePublishes).toHaveLength(2)
        const ids = affordancePublishes.map((c) => (c[0] as { messageId?: string }).messageId)
        expect(new Set(ids).size).toBe(2)
        expect(ids.every((id) => id?.startsWith('MESSAGE#'))).toBe(true)
        expect(affordancePublishes[0][0]).toMatchObject({ targets: ['CHARACTER#A'], wmlContent: '<RoomAffordance />' })
        expect(mergeSpy).toHaveBeenCalledWith('CHARACTER#A', roomId)
        expect(mergeSpy).toHaveBeenCalledWith('CHARACTER#B', roomId)

        schemaSpy.mockRestore()
        mergeSpy.mockRestore()
        sendSpy.mockRestore()
    })
})
