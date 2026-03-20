import { sendPutCacheRecord } from '../apiEphemera'
import messageBus from '../../messageBus'
import { putCacheRecord } from './putCacheRecord'
import { deleteCacheRecord } from './deleteCacheRecord'
import {
    isRenderCacheCacheUpdatedPayload,
    isRenderCacheCacheErrorPayload,
} from './baseClasses'
import { sendDeleteCacheRecords } from '../apiEphemera'
import { isRenderCacheCacheDeletedPayload } from './baseClasses'

jest.mock('./putCacheRecord', () => ({
    putCacheRecord: jest.fn(),
}))
jest.mock('./deleteCacheRecord', () => ({
    deleteCacheRecord: jest.fn(),
}))

// Side-effect: registers mtw.ephemera.renderCache subscription on messageBus
import './index'

const putCacheRecordMock = putCacheRecord as jest.MockedFunction<typeof putCacheRecord>
const deleteCacheRecordMock = deleteCacheRecord as jest.MockedFunction<typeof deleteCacheRecord>

describe('mtw.ephemera.renderCache DataSource', () => {
    const minimalPutRecord = {
        componentId: 'ROOM#room-one' as const,
        record: {
            markState: { markValue: [] },
            renderedContent: { description: [] },
            provenance: { type: 'authored' as const },
            perspectiveId: 'PERSPECTIVE#v1#abc',
            perspectiveMatcher: { requiredAssetIds: ['ASSET#one'] as `ASSET#${string}`[], forbiddenAssetIds: [] },
        },
    }

    beforeEach(() => {
        messageBus.clear()
        jest.clearAllMocks()
        putCacheRecordMock.mockResolvedValue('CACHE#written')
    })

    it('putCacheRecord then emits Cache Updated on the bus', async () => {
        const received: unknown[] = []
        messageBus.subscribe({
            tag: 'test-render-cache-out',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent' &&
                m.dataSourceKey === 'mtw.ephemera.renderCache' &&
                m.header?.type === 'Cache Updated',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    received.push(await p.getContent())
                }
            },
        })

        sendPutCacheRecord(messageBus, 'ROOM#room-one', minimalPutRecord)
        await messageBus.flush()

        expect(putCacheRecordMock).toHaveBeenCalledTimes(1)
        expect(putCacheRecordMock).toHaveBeenCalledWith(
            'ROOM#room-one',
            minimalPutRecord.record,
            undefined
        )
        expect(received).toHaveLength(1)
        expect(isRenderCacheCacheUpdatedPayload(received[0])).toBe(true)
        expect(received[0]).toMatchObject({
            type: 'Cache Updated',
            componentId: 'ROOM#room-one',
            dataCategory: 'CACHE#written',
            perspectiveId: 'PERSPECTIVE#v1#abc',
        })
    })

    it('emits Cache Error when putCacheRecord rejects', async () => {
        putCacheRecordMock.mockRejectedValue(new Error('dynamo failed'))

        const received: unknown[] = []
        messageBus.subscribe({
            tag: 'test-render-cache-err',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent' &&
                m.dataSourceKey === 'mtw.ephemera.renderCache' &&
                m.header?.type === 'Cache Error',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    received.push(await p.getContent())
                }
            },
        })

        sendPutCacheRecord(messageBus, 'ROOM#room-one', minimalPutRecord)
        await messageBus.flush()

        expect(received).toHaveLength(1)
        expect(isRenderCacheCacheErrorPayload(received[0])).toBe(true)
        expect(received[0]).toMatchObject({
            type: 'Cache Error',
            componentId: 'ROOM#room-one',
            errorCode: 'PUT_FAILED',
            errorMessage: 'dynamo failed',
            perspectiveId: 'PERSPECTIVE#v1#abc',
        })
    })

    it('deleteCacheRecord then emits Cache Deleted on the bus', async () => {
        const received: unknown[] = []
        messageBus.subscribe({
            tag: 'test-render-cache-del',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent' &&
                m.dataSourceKey === 'mtw.ephemera.renderCache' &&
                m.header?.type === 'Cache Deleted',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    received.push(await p.getContent())
                }
            },
        })

        sendDeleteCacheRecords(messageBus, 'ROOM#room-one', {
            componentId: 'ROOM#room-one' as const,
            dataCategories: ['CACHE#one', 'CACHE#two'],
        })
        await messageBus.flush()

        expect(deleteCacheRecordMock).toHaveBeenCalledTimes(2)
        expect(deleteCacheRecordMock).toHaveBeenCalledWith('ROOM#room-one', 'CACHE#one')
        expect(deleteCacheRecordMock).toHaveBeenCalledWith('ROOM#room-one', 'CACHE#two')
        expect(received).toHaveLength(1)
        expect(isRenderCacheCacheDeletedPayload(received[0])).toBe(true)
        expect(received[0]).toMatchObject({
            type: 'Cache Deleted',
            componentId: 'ROOM#room-one',
            dataCategories: ['CACHE#one', 'CACHE#two'],
        })
    })
})
