jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import * as schemaModule from '@tonylb/mtw-wml/ts/schema'
import {
    makePassThroughGenerationStartedPayload,
    passThroughFixtureMinimalDynamoItem,
    passThroughFixturePerspectiveKey,
    passThroughFixtureRoomId,
} from '../passThroughContractFixtures'
import { RENDER_CACHE_DATA_SOURCE_KEY } from '../renderCache/baseClasses'
import { RENDER_ORCHESTRATION_DATA_SOURCE_KEY } from '../renderOrchestration/publishedEvents'
import { sendCharacterPerceptionRequested, sendPerceptionThreadRegistered } from './subscribedEvents'
import { ephemeraPerceptionDataSource } from './index'

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
            componentId: 'ROOM#REG',
            perspectiveKey: 'view-1',
            characterId: 'CHARACTER#viewer',
        })
        await messageBus.flush()

        const entry = internalCache.PerceptionThreads.get('ROOM#REG', 'view-1')
        expect(entry?.thread).toMatchObject({
            kind: 'roomDescription',
            status: 'Initial',
        })
        expect(entry?.registration).toMatchObject({
            componentId: 'ROOM#REG',
            perspectiveKey: 'view-1',
            characterId: 'CHARACTER#viewer',
        })
        expect(sendSpy.mock.calls.some((call) => call[0]?.type === 'PublishMessage')).toBe(false)
        sendSpy.mockRestore()
    })

    it('room thread receives Generation Started then terminal Render Pertains with stable messageId', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<RoomTerminal />')
        const componentRenderSpy = jest.spyOn(internalCache.ComponentRender, 'get').mockResolvedValue({ schema: {} } as any)

        sendPerceptionThreadRegistered(messageBus, passThroughFixtureRoomId, {
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
        expect((terminalPublish![0] as { messageId?: string }).messageId).toBe(mid)
        expect(internalCache.PerceptionThreads.get(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)).toBeUndefined()

        schemaSpy.mockRestore()
        componentRenderSpy.mockRestore()
        sendSpy.mockRestore()
    })
})
