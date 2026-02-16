/**
 * Tests for streamEventPublisher: builds CoreExternalFormat and wire formats from header + content.
 */
import { publishStreamEvent, StreamEventPublisherSerializer } from './streamEventPublisher'

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

        expect(result.coreFormat.dataSourceKey).toBe('mtw.assets')
        expect(result.coreFormat.streamKey).toBe('ASSET#test')
        expect(result.coreFormat.timestamp).toBe(1234567890)
        expect(result.coreFormat.header).toEqual(baseHeader)
        expect(result.coreFormat.update).toEqual(content)

        expect(result.eventBridgeEvent.Source).toBe('mtw.assets')
        expect(result.eventBridgeEvent.DetailType).toBe('Asset Added')
        expect(result.eventBridgeEvent.Detail.streamKey).toBe('ASSET#test')
        expect(result.eventBridgeEvent.Detail.timestamp).toBe(1234567890)
        // toEventBridgeFormat puts coreFormat.update.update into Detail.update; rest is spread
        expect(result.eventBridgeEvent.Detail.update).toBe('asset-1')

        expect(result.dynamoRecord).toBeUndefined()
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
