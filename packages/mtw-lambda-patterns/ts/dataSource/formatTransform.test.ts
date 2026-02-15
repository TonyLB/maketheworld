/**
 * Tests for formatTransform: header (in-memory) vs extendedHeader (wire).
 * In-memory CoreExternalFormat has merged header; wire has Detail.extendedHeader.
 */

import {
    CoreExternalFormat,
    DynamoDBFormat,
    EventBridgeFormat,
    toEventBridgeFormat,
    fromEventBridgeFormat,
    toDynamoDBFormat,
    fromDynamoDBFormat,
    toSNSFeedbackFormat,
    fromSNSFeedbackFormat
} from './formatTransform'

describe('formatTransform', () => {
    describe('toEventBridgeFormat', () => {
        it('should write extended part of header as Detail.extendedHeader when coreFormat.header has extended fields', () => {
            const coreFormat: CoreExternalFormat = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234567890,
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
                dataSourceKey: 'mtw.assets',
                streamKey: 'stream-1',
                timestamp: 1000,
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
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#id',
                timestamp: 2000,
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

    describe('SNS Feedback round-trip', () => {
        it('should include extendedHeader in SNS format when coreFormat.header has extended fields', () => {
            const coreFormat: CoreExternalFormat = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#id',
                timestamp: 3000,
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
})
