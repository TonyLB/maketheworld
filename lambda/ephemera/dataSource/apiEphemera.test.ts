import {
    sendPutCacheRecord,
    sendDeleteCacheRecords,
    sendStateChange,
    sendObjectsChange,
    sendParseRequested,
    sendActionAssessed,
    sendPutThinkingSchedule,
    sendPutThinkingJobCreate,
    sendPutThinkingJobError,
    isEphemeraApiSubscribedEnvelope,
    isEphemeraApiPutCacheRecordEnvelope,
    isEphemeraApiDeleteCacheRecordsEnvelope,
    isEphemeraApiStateChangeEnvelope,
    isEphemeraApiObjectsChangeEnvelope,
    isEphemeraApiPutThinkingScheduleEnvelope,
    isEphemeraApiPutThinkingJobCreateEnvelope,
    isEphemeraApiPutThinkingJobErrorEnvelope,
} from './apiEphemera'
import type { StreamingEventMessage } from '../messageBus/baseClasses'
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

describe('apiEphemera', () => {
    const makeBus = () => {
        const published: StreamingEventMessage[] = []
        return {
            published,
            bus: {
                publish: (payload: StreamingEventMessage) => {
                    published.push(payload)
                },
            },
        }
    }

    const message = (payload: StreamingEventMessage) => payload

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

    const minimalDeleteRecords = {
        componentId: 'ROOM#room-one' as const,
        dataCategories: ['CACHE#one', 'CACHE#two'],
    }

    const minimalThinkingSchedule = {
        schemaVersion: 1,
        generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        workItemId: '11111111-2222-3333-4444-555555555555',
        segment: 'candidates' as const,
        scheduleStatus: 'scheduled' as const,
    }

    const minimalThinkingJobCreate = {
        schemaVersion: 1,
        generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        workItemIds: ['11111111-2222-3333-4444-555555555555', '22222222-3333-4444-5555-666666666666'],
        jobStatus: 'pending' as const,
    }

    const minimalThinkingJobError = {
        schemaVersion: 1,
        generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        jobStatus: 'failed' as const,
        failedAt: '2026-05-14T12:00:00.000Z',
    }

    it('sendPutCacheRecord posts StreamingEvent with api.ephemera header and streamKey', () => {
        const { published, bus } = makeBus()
        sendPutCacheRecord(bus, 'ROOM#room-one', minimalPutRecord)

        expect(published).toHaveLength(1)
        const msg = message(published[0])
        expect(msg.type).toBe('StreamingEvent')
        expect(msg.dataSourceKey).toBe('api.ephemera')
        expect(msg.streamKey).toBe('ROOM#room-one')
        expect(msg.header.dataSourceKey).toBe('api.ephemera')
        expect(msg.header.type).toBe('Put Cache Record')
        expect(msg.header.streamKey).toBe('ROOM#room-one')
    })

    it('sendDeleteCacheRecords posts StreamingEvent with api.ephemera header and streamKey', () => {
        const { published, bus } = makeBus()
        sendDeleteCacheRecords(bus, 'ROOM#room-one', minimalDeleteRecords)

        expect(published).toHaveLength(1)
        const msg = message(published[0])
        expect(msg.type).toBe('StreamingEvent')
        expect(msg.dataSourceKey).toBe('api.ephemera')
        expect(msg.streamKey).toBe('ROOM#room-one')
        expect(msg.header.dataSourceKey).toBe('api.ephemera')
        expect(msg.header.type).toBe('Delete Cache Records')
        expect(msg.header.streamKey).toBe('ROOM#room-one')
    })

    it('sendPutCacheRecord getContent returns internal payload', async () => {
        const { published } = makeBus()
        sendPutCacheRecord({ publish: (p) => published.push(p) }, 'ROOM#room-one', minimalPutRecord)

        const msg = message(published[0])
        const internal = await msg.getContent()
        expect(internal).toMatchObject({
            componentId: 'ROOM#room-one',
            record: expect.objectContaining({
                perspectiveId: 'PERSPECTIVE#v1#abc',
                provenance: { type: 'authored' },
            }),
        })
        const internalAgain = await msg.getContent('internal')
        expect(internalAgain).toEqual(internal)
    })

    it('sendPutCacheRecord getContent includes optional conversationId when provided', async () => {
        const { published } = makeBus()
        sendPutCacheRecord({ publish: (p) => published.push(p) }, 'ROOM#room-one', {
            ...minimalPutRecord,
            conversationId: 'conv-abc',
        })

        const internal = await message(published[0]).getContent()
        expect(internal).toMatchObject({
            componentId: 'ROOM#room-one',
            conversationId: 'conv-abc',
        })
    })

    it('sendStateChange posts StreamingEvent with State Change type and componentId + markState', async () => {
        const { published, bus } = makeBus()
        sendStateChange(bus, 'ROOM#r3', {
            componentId: 'ROOM#r3',
            markState: { markValue: [{ mark: 'MARK#a', value: 'lit' }] },
        })

        expect(published).toHaveLength(1)
        const msg = message(published[0])
        expect(msg.type).toBe('StreamingEvent')
        expect(msg.dataSourceKey).toBe('api.ephemera')
        expect(msg.streamKey).toBe('ROOM#r3')
        expect(msg.header.type).toBe('State Change')
        const content = await msg.getContent()
        expect(content).toEqual({
            componentId: 'ROOM#r3',
            markState: { markValue: [{ mark: 'MARK#a', value: 'lit' }] },
        })
    })

    it('sendObjectsChange posts StreamingEvent with Objects Change type and componentId + add/remove', async () => {
        const { published, bus } = makeBus()
        sendObjectsChange(bus, 'ROOM#obj', {
            componentId: 'ROOM#obj',
            add: [
                { uuid: 'OBJECT#h1', shortName: 'First', stableKey: 'first' },
                { uuid: 'OBJECT#h2', shortName: 'Second', stableKey: 'second' },
            ],
            remove: ['OBJECT#h0'],
        })

        expect(published).toHaveLength(1)
        const msg = message(published[0])
        expect(msg.type).toBe('StreamingEvent')
        expect(msg.dataSourceKey).toBe('api.ephemera')
        expect(msg.streamKey).toBe('ROOM#obj')
        expect(msg.header.type).toBe('Objects Change')
        const content = await msg.getContent()
        expect(content).toEqual({
            componentId: 'ROOM#obj',
            add: [
                { uuid: 'OBJECT#h1', shortName: 'First', stableKey: 'first' },
                { uuid: 'OBJECT#h2', shortName: 'Second', stableKey: 'second' },
            ],
            remove: ['OBJECT#h0'],
        })
    })

    it('isEphemeraApiSubscribedEnvelope accepts api.ephemera Put Cache Record envelope', async () => {
        const { published, bus } = makeBus()
        sendPutCacheRecord(bus, 'ROOM#x', minimalPutRecord)
        const msg = message(published[0])
        const envelope: StreamingEventEnvelope<unknown> = {
            header: msg.header,
            getContent: msg.getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(true)
        expect(isEphemeraApiPutCacheRecordEnvelope(envelope)).toBe(true)
    })

    it('isEphemeraApiSubscribedEnvelope accepts api.ephemera Delete Cache Records envelope', async () => {
        const { published, bus } = makeBus()
        sendDeleteCacheRecords(bus, 'ROOM#x', minimalDeleteRecords)
        const msg = message(published[0])
        const envelope: StreamingEventEnvelope<unknown> = {
            header: msg.header,
            getContent: msg.getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(true)
        expect(isEphemeraApiDeleteCacheRecordsEnvelope(envelope)).toBe(true)
    })

    it('isEphemeraApiSubscribedEnvelope accepts api.ephemera State Change envelope', async () => {
        const { published, bus } = makeBus()
        sendStateChange(bus, 'ROOM#sc', {
            componentId: 'ROOM#sc',
            markState: { markValue: [] },
        })
        const msg = message(published[0])
        const envelope: StreamingEventEnvelope<unknown> = {
            header: msg.header,
            getContent: msg.getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(true)
        expect(isEphemeraApiStateChangeEnvelope(envelope)).toBe(true)
    })

    it('isEphemeraApiSubscribedEnvelope accepts api.ephemera Objects Change envelope', async () => {
        const { published, bus } = makeBus()
        sendObjectsChange(bus, 'ROOM#oc', {
            componentId: 'ROOM#oc',
            add: [],
            remove: [],
        })
        const msg = message(published[0])
        const envelope: StreamingEventEnvelope<unknown> = {
            header: msg.header,
            getContent: msg.getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(true)
        expect(isEphemeraApiObjectsChangeEnvelope(envelope)).toBe(true)
    })

    it('sendParseRequested posts StreamingEvent via bus.publish', () => {
        const publish = jest.fn()
        const bus = { publish }
        sendParseRequested(bus, 'CHARACTER#123', {
            characterId: 'CHARACTER#123' as const,
            command: 'look',
        })
        expect(publish).toHaveBeenCalledTimes(1)
        expect(publish.mock.calls[0][0].header.type).toBe('Parse Requested')
    })

    it('sendActionAssessed posts StreamingEvent with Action Assessed header and streamKey', async () => {
        const { published, bus } = makeBus()
        sendActionAssessed(bus, 'CHARACTER#123', {
            characterId: 'CHARACTER#123' as const,
            assessed: {
                type: 'Navigation',
                targetId: 'ROOM#789' as const,
                exitName: 'north',
                confidence: 1,
            },
            source: 'uiExit',
        })

        expect(published).toHaveLength(1)
        const msg = message(published[0])
        expect(msg.type).toBe('StreamingEvent')
        expect(msg.dataSourceKey).toBe('api.ephemera')
        expect(msg.streamKey).toBe('CHARACTER#123')
        expect(msg.header.dataSourceKey).toBe('api.ephemera')
        expect(msg.header.type).toBe('Action Assessed')
        expect(msg.header.streamKey).toBe('CHARACTER#123')
        const content = await msg.getContent()
        expect(content).toMatchObject({
            characterId: 'CHARACTER#123',
            source: 'uiExit',
            assessed: {
                type: 'Navigation',
                targetId: 'ROOM#789',
                exitName: 'north',
                confidence: 1,
            },
        })
    })

    it('sendActionAssessed posts Home assessed with uiHome source', async () => {
        const { published, bus } = makeBus()
        sendActionAssessed(bus, 'CHARACTER#123', {
            characterId: 'CHARACTER#123' as const,
            assessed: {
                type: 'Home',
                confidence: 1,
            },
            source: 'uiHome',
        })

        expect(published).toHaveLength(1)
        const msg = message(published[0])
        expect(msg.header.type).toBe('Action Assessed')
        const content = await msg.getContent()
        expect(content).toMatchObject({
            characterId: 'CHARACTER#123',
            source: 'uiHome',
            assessed: {
                type: 'Home',
                confidence: 1,
            },
        })
    })

    it('sendPutThinkingSchedule posts StreamingEvent with Put Thinking Schedule type', async () => {
        const { published, bus } = makeBus()
        sendPutThinkingSchedule(bus, 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', minimalThinkingSchedule)

        expect(published).toHaveLength(1)
        const msg = message(published[0])
        expect(msg.type).toBe('StreamingEvent')
        expect(msg.dataSourceKey).toBe('api.ephemera')
        expect(msg.streamKey).toBe('JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        expect(msg.header.type).toBe('Put Thinking Schedule')
        const content = await msg.getContent()
        expect(content).toEqual(minimalThinkingSchedule)
    })

    it('sendPutThinkingSchedule getContent includes optional enqueuedAt', async () => {
        const { published, bus } = makeBus()
        sendPutThinkingSchedule(
            bus,
            'JOB#g1',
            { ...minimalThinkingSchedule, enqueuedAt: '2026-01-01T00:00:00.000Z' }
        )
        const internal = await message(published[0]).getContent()
        expect(internal).toMatchObject({
            enqueuedAt: '2026-01-01T00:00:00.000Z',
            scheduleStatus: 'scheduled',
        })
    })

    it('isEphemeraApiSubscribedEnvelope accepts api.ephemera Put Thinking Schedule envelope', async () => {
        const { published, bus } = makeBus()
        sendPutThinkingSchedule(bus, 'JOB#x', minimalThinkingSchedule)
        const msg = message(published[0])
        const envelope: StreamingEventEnvelope<unknown> = {
            header: msg.header,
            getContent: msg.getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(true)
        expect(isEphemeraApiPutThinkingScheduleEnvelope(envelope)).toBe(true)
    })

    it('sendPutThinkingJobCreate posts StreamingEvent with Put Thinking Job Create type', async () => {
        const { published, bus } = makeBus()
        sendPutThinkingJobCreate(bus, 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', minimalThinkingJobCreate)

        expect(published).toHaveLength(1)
        const msg = message(published[0])
        expect(msg.type).toBe('StreamingEvent')
        expect(msg.dataSourceKey).toBe('api.ephemera')
        expect(msg.streamKey).toBe('JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        expect(msg.header.type).toBe('Put Thinking Job Create')
        const content = await msg.getContent()
        expect(content).toEqual(minimalThinkingJobCreate)
    })

    it('sendPutThinkingJobError posts StreamingEvent with Put Thinking Job Error type', async () => {
        const { published, bus } = makeBus()
        sendPutThinkingJobError(bus, 'JOB#g1', {
            ...minimalThinkingJobError,
            errorCode: 'X',
            lastFailedWorkItemId: '11111111-2222-3333-4444-555555555555',
        })

        expect(published).toHaveLength(1)
        const msg = message(published[0])
        expect(msg.header.type).toBe('Put Thinking Job Error')
        const content = await msg.getContent()
        expect(content).toMatchObject({
            jobStatus: 'failed',
            errorCode: 'X',
            lastFailedWorkItemId: '11111111-2222-3333-4444-555555555555',
        })
    })

    it('isEphemeraApiSubscribedEnvelope accepts Put Thinking Job Create and Job Error envelopes', async () => {
        const { published, bus } = makeBus()
        sendPutThinkingJobCreate(bus, 'JOB#a', minimalThinkingJobCreate)
        const envCreate: StreamingEventEnvelope<unknown> = {
            header: message(published[0]).header,
            getContent: message(published[0]).getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envCreate)).toBe(true)
        expect(isEphemeraApiPutThinkingJobCreateEnvelope(envCreate)).toBe(true)

        published.length = 0
        sendPutThinkingJobError(bus, 'JOB#a', minimalThinkingJobError)
        const envErr: StreamingEventEnvelope<unknown> = {
            header: message(published[0]).header,
            getContent: message(published[0]).getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envErr)).toBe(true)
        expect(isEphemeraApiPutThinkingJobErrorEnvelope(envErr)).toBe(true)
    })

    it('isEphemeraApiSubscribedEnvelope rejects wrong dataSourceKey', () => {
        const envelope: StreamingEventEnvelope<unknown> = {
            header: {
                dataSourceKey: 'mtw.assets',
                streamKey: 'ROOM#x',
                timestamp: 1,
                type: 'Put Cache Record',
            },
            getContent: async () => minimalPutRecord,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(false)
    })

    it('isEphemeraApiSubscribedEnvelope rejects wrong type for api.ephemera', () => {
        const envelope: StreamingEventEnvelope<unknown> = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#x',
                timestamp: 1,
                type: 'Unknown',
            },
            getContent: async () => minimalPutRecord,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(false)
    })
})
