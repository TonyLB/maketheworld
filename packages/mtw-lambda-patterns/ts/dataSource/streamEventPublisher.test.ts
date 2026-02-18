/**
 * Tests for streamEventPublisher: builds CoreExternalFormat and wire formats from header + content.
 */
import {
    publishStreamEvent,
    StreamEventPublisherSerializer,
    wireFormatsFromCoreFormat,
    createSnapshotCoreFormat,
    coreFormatToResolvedSnapshotEnvelope,
    coreFormatToStreamingEnvelope,
    SNAPSHOT_HEADER_TYPE,
} from './streamEventPublisher'
import { CoreExternalFormat } from './formatTransform'

const baseHeader = {
    dataSourceKey: 'mtw.assets' as const,
    streamKey: 'ASSET#test',
    timestamp: 1234567890,
    type: 'Asset Added',
}

describe('publishStreamEvent', () => {
    it('should build coreFormat and eventBridgeEvent with no serializer (content used as update)', () => {
        const content = { type: 'Asset Added', update: 'asset-1' }
        const result = publishStreamEvent({ header: baseHeader, content })

        expect(result.coreFormat.header).toEqual(baseHeader)
        expect(result.coreFormat.header.dataSourceKey).toBe('mtw.assets')
        expect(result.coreFormat.header.streamKey).toBe('ASSET#test')
        expect(result.coreFormat.header.timestamp).toBe(1234567890)
        expect(result.coreFormat.update).toEqual(content)

        expect(result.eventBridgeEvent.Source).toBe('mtw.assets')
        expect(result.eventBridgeEvent.DetailType).toBe('Asset Added')
        expect(result.eventBridgeEvent.Detail.streamKey).toBe('ASSET#test')
        expect(result.eventBridgeEvent.Detail.timestamp).toBe(1234567890)
        // toEventBridgeFormat puts coreFormat.update.update into Detail.update; rest is spread
        expect(result.eventBridgeEvent.Detail.update).toBe('asset-1')

        expect(result.dynamoRecord).toBeUndefined()

        expect(result.snsFeedbackFormat.messageType).toBe('StreamEvent')
        expect(result.snsFeedbackFormat.dataSourceKey).toBe('mtw.assets')
        expect(result.snsFeedbackFormat.streamKey).toBe('ASSET#test')
        expect(result.snsFeedbackFormat.timestamp).toBe(1234567890)
        expect(result.snsFeedbackFormat.update).toEqual(content)

        expect(result.webSocketFormat.messageType).toBe('StreamEvent')
        expect(result.webSocketFormat.dataSourceKey).toBe('mtw.assets')
        expect(result.webSocketFormat.streamKey).toBe('ASSET#test')
        expect(result.webSocketFormat.timestamp).toBe(1234567890)
        expect(result.webSocketFormat.update).toEqual(content)
    })

    it('should build with mock serializer; coreFormat.update and eventBridgeEvent.Detail match serialized output', () => {
        const internalContent = { internal: 'payload' }
        const externalUpdate = { type: 'Content Update', wml: '<Asset />' }
        const serializer: StreamEventPublisherSerializer = {
            serialize: jest.fn().mockReturnValue(externalUpdate),
        }

        const result = publishStreamEvent({
            header: { ...baseHeader, type: 'Content Update' },
            content: internalContent,
            serializer,
        })

        expect(serializer.serialize).toHaveBeenCalledWith({
            content: internalContent,
            header: expect.objectContaining({ type: 'Content Update' }),
        })
        expect(result.coreFormat.update).toEqual(externalUpdate)
        // toEventBridgeFormat puts update.update in Detail.update and spreads rest; externalUpdate has wml
        expect(result.eventBridgeEvent.Detail.wml).toBe('<Asset />')
        expect(result.eventBridgeEvent.DetailType).toBe('Content Update')
    })

    it('should include dynamoRecord when primaryKeyName and eventId are provided', () => {
        const content = { type: 'Zone Updated', zone: 'Draft' }
        const result = publishStreamEvent({
            header: baseHeader,
            content,
            primaryKeyName: 'AssetId',
            eventId: 'uuid-123',
        })

        expect(result.dynamoRecord).toBeDefined()
        expect(result.dynamoRecord!.AssetId).toBe('STREAM#mtw.assets::ASSET#test')
        expect(result.dynamoRecord!.DataCategory).toBe('EVENT#1234567890::uuid-123')
        expect(result.dynamoRecord!.update).toEqual(content)

        expect(result.snsFeedbackFormat.messageType).toBe('StreamEvent')
        expect(result.snsFeedbackFormat.update).toEqual(content)
        expect(result.webSocketFormat.messageType).toBe('StreamEvent')
        expect(result.webSocketFormat.update).toEqual(content)
    })

    it('should omit dynamoRecord when primaryKeyName or eventId is omitted', () => {
        const withKeyOnly = publishStreamEvent({
            header: baseHeader,
            content: { type: 'X' },
            primaryKeyName: 'AssetId',
        })
        expect(withKeyOnly.dynamoRecord).toBeUndefined()

        const withIdOnly = publishStreamEvent({
            header: baseHeader,
            content: { type: 'X' },
            eventId: 'uuid-1',
        })
        expect(withIdOnly.dynamoRecord).toBeUndefined()

        const withNeither = publishStreamEvent({ header: baseHeader, content: { type: 'X' } })
        expect(withNeither.dynamoRecord).toBeUndefined()
    })
})

describe('wireFormatsFromCoreFormat', () => {
    const coreFormat: CoreExternalFormat = {
        header: { dataSourceKey: 'mtw.assets', streamKey: 'ASSET#test', timestamp: 1234567890, type: 'Test' },
        update: { type: 'Test', data: 'payload' },
    }

    it('should return eventBridgeEvent, snsFeedbackFormat, webSocketFormat and no dynamoRecord when options omitted', () => {
        const result = wireFormatsFromCoreFormat(coreFormat)

        expect(result.eventBridgeEvent.Source).toBe('mtw.assets')
        expect(result.eventBridgeEvent.DetailType).toBe('Test')
        expect(result.eventBridgeEvent.Detail.streamKey).toBe('ASSET#test')
        expect(result.eventBridgeEvent.Detail.timestamp).toBe(1234567890)

        expect(result.snsFeedbackFormat.messageType).toBe('StreamEvent')
        expect(result.snsFeedbackFormat.dataSourceKey).toBe('mtw.assets')
        expect(result.snsFeedbackFormat.update).toEqual(coreFormat.update)

        expect(result.webSocketFormat.messageType).toBe('StreamEvent')
        expect(result.webSocketFormat.dataSourceKey).toBe('mtw.assets')
        expect(result.webSocketFormat.update).toEqual(coreFormat.update)

        expect(result.dynamoRecord).toBeUndefined()
    })

    it('should set webSocketFormat.RequestIds when coreFormat.header has RequestIds', () => {
        const coreWithRequestIds: CoreExternalFormat = {
            header: { ...coreFormat.header, RequestIds: ['req-1', 'req-2'] },
            update: coreFormat.update,
        }
        const result = wireFormatsFromCoreFormat(coreWithRequestIds)
        expect(result.webSocketFormat.RequestIds).toEqual(['req-1', 'req-2'])
    })

    it('should include dynamoRecord when primaryKeyName and eventId are provided', () => {
        const result = wireFormatsFromCoreFormat(coreFormat, {
            primaryKeyName: 'AssetId',
            eventId: 'evt-1',
        })

        expect(result.dynamoRecord).toBeDefined()
        expect(result.dynamoRecord!.AssetId).toBe('STREAM#mtw.assets::ASSET#test')
        expect(result.dynamoRecord!.DataCategory).toBe('EVENT#1234567890::evt-1')
        expect(result.dynamoRecord!.update).toEqual(coreFormat.update)

        expect(result.eventBridgeEvent.Source).toBe('mtw.assets')
        expect(result.snsFeedbackFormat.messageType).toBe('StreamEvent')
        expect(result.webSocketFormat.messageType).toBe('StreamEvent')
        expect(result.webSocketFormat.dataSourceKey).toBe('mtw.assets')
    })
})

describe('createSnapshotCoreFormat', () => {
    it('should return CoreExternalFormat with header.type Snapshot and pass through update', () => {
        const update = { type: 'Snapshot', wml: '<Asset id="a1" />' }
        const result = createSnapshotCoreFormat('mtw.wml', 'ASSET#a1', 999000, update)

        expect(result.header.dataSourceKey).toBe('mtw.wml')
        expect(result.header.streamKey).toBe('ASSET#a1')
        expect(result.header.timestamp).toBe(999000)
        expect(result.header.type).toBe(SNAPSHOT_HEADER_TYPE)
        expect(result.update).toEqual(update)
    })

    it('should round-trip through wireFormatsFromCoreFormat for snapshot', () => {
        const update = { type: 'Snapshot', items: ['a', 'b'] }
        const coreFormat = createSnapshotCoreFormat('mtw.assets.contentHeaders', 'global', 1000, update)
        const result = wireFormatsFromCoreFormat(coreFormat)

        expect(result.snsFeedbackFormat.messageType).toBe('StreamEvent')
        expect(result.snsFeedbackFormat.dataSourceKey).toBe('mtw.assets.contentHeaders')
        expect(result.snsFeedbackFormat.streamKey).toBe('global')
        expect(result.snsFeedbackFormat.timestamp).toBe(1000)
        expect(result.snsFeedbackFormat.update).toEqual(update)

        expect(result.eventBridgeEvent.Source).toBe('mtw.assets.contentHeaders')
        expect(result.eventBridgeEvent.DetailType).toBe(SNAPSHOT_HEADER_TYPE)
        expect(result.webSocketFormat.messageType).toBe('StreamEvent')
        expect(result.webSocketFormat.update).toEqual(update)
    })
})

describe('coreFormatToResolvedSnapshotEnvelope', () => {
    it('should return ResolvedStreamingEnvelope with header and content from coreFormat', () => {
        const coreFormat = createSnapshotCoreFormat('mtw.wml', 'stream-1', 5000, { type: 'Snapshot', wml: 'x' })
        const envelope = coreFormatToResolvedSnapshotEnvelope(coreFormat)

        expect(envelope.header).toBe(coreFormat.header)
        expect(envelope.content).toBe(coreFormat.update)
        expect(envelope.header.type).toBe(SNAPSHOT_HEADER_TYPE)
    })
})

describe('coreFormatToStreamingEnvelope', () => {
    it('should return StreamingEventEnvelope with header and getContentInternal', async () => {
        const coreFormat = createSnapshotCoreFormat('mtw.assets', 'key', 1, { type: 'Snapshot', data: 'x' })
        const content = { deserialized: true }
        const envelope = coreFormatToStreamingEnvelope(coreFormat, () => Promise.resolve(content))

        expect(envelope.header).toBe(coreFormat.header)
        expect(await envelope.getContentInternal()).toEqual(content)
    })
})
