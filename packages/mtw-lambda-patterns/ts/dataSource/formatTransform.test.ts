/**
 * Tests for formatTransform: header (in-memory) vs extendedHeader (wire).
 * In-memory CoreExternalFormat has merged header; wire has Detail.extendedHeader.
 */

import {
    CoreExternalFormat,
    CoreExternalFormatHeader,
    DynamoDBFormat,
    EventBridgeFormat,
    makeCoreExternalFormatGuardFromHeaderGuard,
    toEventBridgeFormat,
    fromEventBridgeFormat,
    toDynamoDBFormat,
    fromDynamoDBFormat,
    toSNSFeedbackFormat,
    fromSNSFeedbackFormat,
    toWebSocketFormat,
    fromWebSocketFormat
} from './formatTransform'

describe('formatTransform', () => {
    describe('toEventBridgeFormat', () => {
        it('should write extended part of header as Detail.extendedHeader when coreFormat.header has extended fields', () => {
            const coreFormat: CoreExternalFormat = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test',
                    timestamp: 1234567890,
                    type: 'Content Update',
                    RequestIds: ['req-1']
                },
                update: { type: 'Content Update', update: '<Asset />' }
            }
            const result = toEventBridgeFormat(coreFormat)
            expect(result.Detail.extendedHeader).toEqual({ RequestIds: ['req-1'] })
            expect(result.Detail).not.toHaveProperty('RequestIds')
            expect(result.Detail.update).toEqual('<Asset />')
            expect(result.DetailType).toBe('Content Update')
        })

        it('should not add Detail.extendedHeader when header has only base four fields', () => {
            const coreFormat: CoreExternalFormat = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'stream-1',
                    timestamp: 1000,
                    type: 'Asset Added'
                },
                update: { type: 'Asset Added', update: 'a1' }
            }
            const result = toEventBridgeFormat(coreFormat)
            expect(result.Detail.extendedHeader).toBeUndefined()
            expect(result.Detail.update).toEqual('a1')
        })

        it('should prefer header.type over update.type for DetailType when both are present', () => {
            const coreFormat: CoreExternalFormat = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test',
                    timestamp: 1234567890,
                    type: 'HeaderType'
                },
                update: { type: 'PayloadType', update: '<Asset />' }
            }
            const result = toEventBridgeFormat(coreFormat)
            expect(result.DetailType).toBe('HeaderType')
            expect(result.Detail.update).toEqual('<Asset />')
        })
    })

    describe('fromEventBridgeFormat', () => {
        it('should merge Detail.extendedHeader into coreFormat.header and not put extendedHeader in update', () => {
            const eventBridgeEvent: EventBridgeFormat = {
                Source: 'mtw.wml',
                DetailType: 'Content Update',
                Detail: {
                    streamKey: 'ASSET#test',
                    timestamp: 1234567890,
                    extendedHeader: { RequestIds: ['req-a'] },
                    update: '<Asset />'
                }
            }
            const result = fromEventBridgeFormat(eventBridgeEvent)
            expect(result.header).toMatchObject({
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234567890,
                type: 'Content Update',
                RequestIds: ['req-a']
            })
            expect(result.update).not.toHaveProperty('RequestIds')
            expect(result.update).toMatchObject({ type: 'Content Update', update: '<Asset />' })
        })

        it('should normalize legacy Detail.RequestIds into header when Detail.extendedHeader is absent', () => {
            const eventBridgeEvent = {
                Source: 'mtw.wml',
                DetailType: 'Merge Conflict',
                Detail: {
                    streamKey: 'ASSET#test',
                    timestamp: 1234567890,
                    RequestIds: ['req-legacy'],
                    error: 'Conflict'
                }
            }
            const result = fromEventBridgeFormat(eventBridgeEvent)
            expect(result.header).toMatchObject({
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234567890,
                type: 'Merge Conflict',
                RequestIds: ['req-legacy']
            })
            expect(result.update).toMatchObject({ type: 'Merge Conflict', error: 'Conflict' })
        })
    })

    describe('DynamoDB round-trip', () => {
        it('should include extendedHeader on record when coreFormat has extended header', () => {
            const coreFormat: CoreExternalFormat = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#id',
                    timestamp: 2000,
                    type: 'Content Update',
                    RequestIds: ['r1']
                },
                update: { type: 'Content Update', wml: 'x' }
            }
            const record = toDynamoDBFormat(coreFormat, 'AssetId', 'uuid-1')
            expect(record.extendedHeader).toEqual({ RequestIds: ['r1'] })
            expect(record.update).toEqual({ type: 'Content Update', wml: 'x' })

            const back = fromDynamoDBFormat(record as unknown as DynamoDBFormat, 'mtw.wml')
            expect(back.header).toMatchObject({
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#id',
                timestamp: 2000,
                type: 'Content Update',
                RequestIds: ['r1']
            })
        })
    })

    describe('makeCoreExternalFormatGuardFromHeaderGuard', () => {
        type WMLContentUpdateHeader = CoreExternalFormatHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' }
        const isWMLContentUpdateHeader = (header: CoreExternalFormatHeader): header is WMLContentUpdateHeader =>
            header.dataSourceKey === 'mtw.wml' && header.type === 'Content Update'
        const guard = makeCoreExternalFormatGuardFromHeaderGuard(isWMLContentUpdateHeader)

        it('returns true when coreFormat.header satisfies the header predicate', () => {
            const coreFormat: CoreExternalFormat = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#x',
                    timestamp: 1,
                    type: 'Content Update'
                },
                update: { type: 'Content Update', wml: '' }
            }
            expect(guard(coreFormat)).toBe(true)
        })

        it('returns false when header does not satisfy the predicate', () => {
            const coreFormat: CoreExternalFormat = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#x',
                    timestamp: 1,
                    type: 'Merge Conflict'
                },
                update: { type: 'Merge Conflict', error: 'x' }
            }
            expect(guard(coreFormat)).toBe(false)
        })

        it('returns false for different dataSourceKey', () => {
            const coreFormat: CoreExternalFormat = {
                header: {
                    dataSourceKey: 'mtw.assets.library',
                    streamKey: 'global',
                    timestamp: 1,
                    type: 'Content Update'
                },
                update: { type: 'Content Update' }
            }
            expect(guard(coreFormat)).toBe(false)
        })
    })

    describe('SNS Feedback round-trip', () => {
        it('should include extendedHeader in SNS format when coreFormat.header has extended fields', () => {
            const coreFormat: CoreExternalFormat = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#id',
                    timestamp: 3000,
                    type: 'Content Update',
                    RequestIds: ['r2']
                },
                update: { type: 'Content Update', wml: 'y' }
            }
            const snsFormat = toSNSFeedbackFormat(coreFormat)
            expect(snsFormat.extendedHeader).toEqual({ RequestIds: ['r2'] })

            const back = fromSNSFeedbackFormat(snsFormat)
            expect(back.header).toMatchObject({
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#id',
                timestamp: 3000,
                type: 'Content Update',
                RequestIds: ['r2']
            })
        })
    })

    describe('toWebSocketFormat', () => {
        it('should have no extra top-level keys when header has only base four', () => {
            const coreFormat: CoreExternalFormat = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'stream-1',
                    timestamp: 1000,
                    type: 'Test'
                },
                update: { type: 'Test', data: 'x' }
            }
            const result = toWebSocketFormat(coreFormat)
            expect(result.messageType).toBe('StreamEvent')
            expect(result.dataSourceKey).toBe('mtw.assets')
            expect(result.streamKey).toBe('stream-1')
            expect(result.timestamp).toBe(1000)
            expect(result.update).toEqual({ type: 'Test', data: 'x' })
            expect(Object.keys(result).sort()).toEqual(['dataSourceKey', 'messageType', 'streamKey', 'timestamp', 'update'])
        })

        it('should merge extended header fields at top level (RequestIds and custom field)', () => {
            const coreFormat: CoreExternalFormat = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test',
                    timestamp: 1234567890,
                    type: 'Content Update',
                    RequestIds: ['req-1', 'req-2'],
                    foo: 'bar'
                },
                update: { type: 'Content Update', wml: '<Asset />' }
            }
            const result = toWebSocketFormat(coreFormat)
            expect(result.RequestIds).toEqual(['req-1', 'req-2'])
            expect((result as unknown as Record<string, unknown>).foo).toBe('bar')
        })

        it('should include RequestId on message when header has RequestId', () => {
            const coreFormat: CoreExternalFormat = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'stream-1',
                    timestamp: 1000,
                    type: 'Test',
                    RequestId: 'header-req'
                },
                update: { type: 'Test' }
            }
            const result = toWebSocketFormat(coreFormat)
            expect(result.RequestId).toBe('header-req')
        })
    })

    describe('fromWebSocketFormat', () => {
        it('should reconstruct header with extended top-level fields', () => {
            const message = {
                messageType: 'StreamEvent' as const,
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234567890,
                update: { type: 'Content Update', wml: '<Asset />' },
                RequestIds: ['req-a', 'req-b']
            }
            const result = fromWebSocketFormat(message)
            expect(result.header).toBeDefined()
            expect(result.header?.RequestIds).toEqual(['req-a', 'req-b'])
            expect(result.header?.type).toBe('Content Update')
            expect(result.header.dataSourceKey).toBe('mtw.wml')
            expect(result.update).toEqual(message.update)
        })

        it('should set header.RequestId from message when present', () => {
            const message = {
                messageType: 'StreamEvent' as const,
                dataSourceKey: 'mtw.assets',
                streamKey: 's1',
                timestamp: 1000,
                update: { type: 'Test' },
                RequestId: 'msg-request-id'
            }
            const result = fromWebSocketFormat(message)
            expect(result.header.RequestId).toBe('msg-request-id')
        })
    })
})
