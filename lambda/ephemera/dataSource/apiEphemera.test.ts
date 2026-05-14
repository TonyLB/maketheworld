import {
    sendPutCacheRecord,
    sendDeleteCacheRecords,
    sendStateChange,
    sendObjectsChange,
    sendPutThinkingSchedule,
    isEphemeraApiSubscribedEnvelope,
    isEphemeraApiPutCacheRecordEnvelope,
    isEphemeraApiDeleteCacheRecordsEnvelope,
    isEphemeraApiStateChangeEnvelope,
    isEphemeraApiObjectsChangeEnvelope,
    isEphemeraApiPutThinkingScheduleEnvelope,
} from './apiEphemera'
import type { StreamingEventMessage } from '../messageBus/baseClasses'
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

describe('apiEphemera', () => {
    const makeBus = () => {
        const sent: StreamingEventMessage[] = []
        return {
            sent,
            bus: {
                send: (payload: StreamingEventMessage) => {
                    sent.push(payload)
                },
            },
        }
    }

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

    it('sendPutCacheRecord posts StreamingEvent with api.ephemera header and streamKey', () => {
        const { sent, bus } = makeBus()
        sendPutCacheRecord(bus, 'ROOM#room-one', minimalPutRecord)

        expect(sent).toHaveLength(1)
        const msg = sent[0]
        expect(msg.type).toBe('StreamingEvent')
        expect(msg.dataSourceKey).toBe('api.ephemera')
        expect(msg.streamKey).toBe('ROOM#room-one')
        expect(msg.header.dataSourceKey).toBe('api.ephemera')
        expect(msg.header.type).toBe('Put Cache Record')
        expect(msg.header.streamKey).toBe('ROOM#room-one')
    })

    it('sendDeleteCacheRecords posts StreamingEvent with api.ephemera header and streamKey', () => {
        const { sent, bus } = makeBus()
        sendDeleteCacheRecords(bus, 'ROOM#room-one', minimalDeleteRecords)

        expect(sent).toHaveLength(1)
        const msg = sent[0]
        expect(msg.type).toBe('StreamingEvent')
        expect(msg.dataSourceKey).toBe('api.ephemera')
        expect(msg.streamKey).toBe('ROOM#room-one')
        expect(msg.header.dataSourceKey).toBe('api.ephemera')
        expect(msg.header.type).toBe('Delete Cache Records')
        expect(msg.header.streamKey).toBe('ROOM#room-one')
    })

    it('sendPutCacheRecord getContent returns internal payload', async () => {
        const { sent } = makeBus()
        sendPutCacheRecord({ send: (p) => sent.push(p) }, 'ROOM#room-one', minimalPutRecord)

        const msg = sent[0]
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
        const { sent } = makeBus()
        sendPutCacheRecord({ send: (p) => sent.push(p) }, 'ROOM#room-one', {
            ...minimalPutRecord,
            conversationId: 'conv-abc',
        })

        const internal = await sent[0].getContent()
        expect(internal).toMatchObject({
            componentId: 'ROOM#room-one',
            conversationId: 'conv-abc',
        })
    })

    it('sendStateChange posts StreamingEvent with State Change type and componentId + markState', async () => {
        const { sent, bus } = makeBus()
        sendStateChange(bus, 'ROOM#r3', {
            componentId: 'ROOM#r3',
            markState: { markValue: [{ mark: 'MARK#a', value: 'lit' }] },
        })

        expect(sent).toHaveLength(1)
        const msg = sent[0]
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
        const { sent, bus } = makeBus()
        sendObjectsChange(bus, 'ROOM#obj', {
            componentId: 'ROOM#obj',
            add: [
                { uuid: 'OBJECT#h1', shortName: 'First', stableKey: 'first' },
                { uuid: 'OBJECT#h2', shortName: 'Second', stableKey: 'second' },
            ],
            remove: ['OBJECT#h0'],
        })

        expect(sent).toHaveLength(1)
        const msg = sent[0]
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
        const { sent, bus } = makeBus()
        sendPutCacheRecord(bus, 'ROOM#x', minimalPutRecord)
        const msg = sent[0]
        const envelope: StreamingEventEnvelope<unknown> = {
            header: msg.header,
            getContent: msg.getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(true)
        expect(isEphemeraApiPutCacheRecordEnvelope(envelope)).toBe(true)
    })

    it('isEphemeraApiSubscribedEnvelope accepts api.ephemera Delete Cache Records envelope', async () => {
        const { sent, bus } = makeBus()
        sendDeleteCacheRecords(bus, 'ROOM#x', minimalDeleteRecords)
        const msg = sent[0]
        const envelope: StreamingEventEnvelope<unknown> = {
            header: msg.header,
            getContent: msg.getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(true)
        expect(isEphemeraApiDeleteCacheRecordsEnvelope(envelope)).toBe(true)
    })

    it('isEphemeraApiSubscribedEnvelope accepts api.ephemera State Change envelope', async () => {
        const { sent, bus } = makeBus()
        sendStateChange(bus, 'ROOM#sc', {
            componentId: 'ROOM#sc',
            markState: { markValue: [] },
        })
        const msg = sent[0]
        const envelope: StreamingEventEnvelope<unknown> = {
            header: msg.header,
            getContent: msg.getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(true)
        expect(isEphemeraApiStateChangeEnvelope(envelope)).toBe(true)
    })

    it('isEphemeraApiSubscribedEnvelope accepts api.ephemera Objects Change envelope', async () => {
        const { sent, bus } = makeBus()
        sendObjectsChange(bus, 'ROOM#oc', {
            componentId: 'ROOM#oc',
            add: [],
            remove: [],
        })
        const msg = sent[0]
        const envelope: StreamingEventEnvelope<unknown> = {
            header: msg.header,
            getContent: msg.getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(true)
        expect(isEphemeraApiObjectsChangeEnvelope(envelope)).toBe(true)
    })

    it('sendPutThinkingSchedule posts StreamingEvent with Put Thinking Schedule type', async () => {
        const { sent, bus } = makeBus()
        sendPutThinkingSchedule(bus, 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', minimalThinkingSchedule)

        expect(sent).toHaveLength(1)
        const msg = sent[0]
        expect(msg.type).toBe('StreamingEvent')
        expect(msg.dataSourceKey).toBe('api.ephemera')
        expect(msg.streamKey).toBe('JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        expect(msg.header.type).toBe('Put Thinking Schedule')
        const content = await msg.getContent()
        expect(content).toEqual(minimalThinkingSchedule)
    })

    it('sendPutThinkingSchedule getContent includes optional enqueuedAt', async () => {
        const { sent } = makeBus()
        sendPutThinkingSchedule(
            { send: (p) => sent.push(p) },
            'JOB#g1',
            { ...minimalThinkingSchedule, enqueuedAt: '2026-01-01T00:00:00.000Z' }
        )
        const internal = await sent[0].getContent()
        expect(internal).toMatchObject({
            enqueuedAt: '2026-01-01T00:00:00.000Z',
            scheduleStatus: 'scheduled',
        })
    })

    it('isEphemeraApiSubscribedEnvelope accepts api.ephemera Put Thinking Schedule envelope', async () => {
        const { sent, bus } = makeBus()
        sendPutThinkingSchedule(bus, 'JOB#x', minimalThinkingSchedule)
        const msg = sent[0]
        const envelope: StreamingEventEnvelope<unknown> = {
            header: msg.header,
            getContent: msg.getContent,
        }
        expect(isEphemeraApiSubscribedEnvelope(envelope)).toBe(true)
        expect(isEphemeraApiPutThinkingScheduleEnvelope(envelope)).toBe(true)
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
