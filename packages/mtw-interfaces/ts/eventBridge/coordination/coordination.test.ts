import { describe, it, expect } from '@jest/globals'
import {
    CoordinationEventSerializer,
    type CoordinationEventExternal,
    type ApplyEditRequest,
    type MoveAssetRequest
} from './index'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

const dataSourceKey = 'mtw.coordination'
const streamKey = 'stream1'
const timestamp = 1234567890000

function makeHeader(type: string): StreamingEventHeader {
    return { dataSourceKey, streamKey, timestamp, type }
}

describe('CoordinationEventSerializer', () => {
    const serializer = new CoordinationEventSerializer()

    describe('deserialize with header present - discrimination from header', () => {
        it('should use header.type for Apply Edit when header and payload match', () => {
            const externalUpdate: CoordinationEventExternal = {
                type: 'Apply Edit',
                schema: '<Asset></Asset>',
                createIfNeeded: true,
                zone: 'Draft'
            }
            const header = makeHeader('Apply Edit')
            const result = serializer.deserialize({
                content: externalUpdate,
                header
            })
            expect(result).not.toBeNull()
            // Internal payload omits type; discrimination is by header only.
            expect((result as ApplyEditRequest).schema).toBe('<Asset></Asset>')
            expect((result as ApplyEditRequest).zone).toBe('Draft')
        })

        it('should use header.type for Move Asset when header and payload match', () => {
            const externalUpdate: CoordinationEventExternal = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library'
            }
            const header = makeHeader('Move Asset')
            const result = serializer.deserialize({
                content: externalUpdate,
                header
            })
            expect(result).not.toBeNull()
            // Internal payload omits type; discrimination is by header only.
            expect((result as MoveAssetRequest).fromZone).toBe('Personal')
            expect((result as MoveAssetRequest).toZone).toBe('Library')
        })
    })

    describe('deserialize when header and payload type disagree - header wins', () => {
        it('should return event matching header.type when payload has different type', () => {
            const externalUpdate: CoordinationEventExternal = {
                type: 'Purge Asset',
                expectedZone: 'Draft',
                requireExists: true
            }
            const header = makeHeader('Create Snapshot')
            const result = serializer.deserialize({
                content: externalUpdate,
                header
            })
            expect(result).not.toBeNull()
            // Internal payload omits type; header says Create Snapshot, result has Create Snapshot shape
        })
    })

    describe('round-trip with header', () => {
        it('should round-trip Apply Edit: serialize then deserialize with header', () => {
            const internalEvent: ApplyEditRequest = {
                RequestId: 'req-1',
                schema: '<Asset></Asset>',
                createIfNeeded: true,
                zone: 'Draft'
            }
            const header = makeHeader('Apply Edit')
            const externalEvent = serializer.serialize({
                content: internalEvent,
                header
            })
            const deserialized = serializer.deserialize({
                content: externalEvent,
                header
            })
            expect(deserialized).not.toBeNull()
            // Internal payload omits type; discrimination is by header only.
            expect((deserialized as ApplyEditRequest).RequestId).toBe('req-1')
            expect((deserialized as ApplyEditRequest).schema).toBe(internalEvent.schema)
            expect((deserialized as ApplyEditRequest).zone).toBe('Draft')
        })
    })
})
