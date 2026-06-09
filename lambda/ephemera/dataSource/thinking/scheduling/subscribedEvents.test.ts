import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

import { sendPutThinkingJobCreate, sendPutThinkingJobError, sendPutThinkingSchedule } from '../../apiEphemera'
import { isThinkingSchedulingSubscribedEnvelope } from './subscribedEvents'

describe('isThinkingSchedulingSubscribedEnvelope', () => {
    it('accepts api.ephemera Put Thinking Schedule envelope', () => {
        const sent: { header: unknown; getContent: () => Promise<unknown> }[] = []
        sendPutThinkingSchedule(
            {
                publish: (p) => {
                    if (p.type === 'StreamingEvent') {
                        sent.push({ header: p.header, getContent: p.getContent })
                    }
                },
            },
            'JOB#g1',
            {
                schemaVersion: 1,
                generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                workItemId: '11111111-2222-3333-4444-555555555555',
                segment: 'candidates',
                scheduleStatus: 'scheduled',
            }
        )
        const envelope: StreamingEventEnvelope<unknown> = {
            header: sent[0].header as StreamingEventEnvelope<unknown>['header'],
            getContent: sent[0].getContent as StreamingEventEnvelope<unknown>['getContent'],
        }
        expect(isThinkingSchedulingSubscribedEnvelope(envelope)).toBe(true)
    })

    it('accepts api.ephemera Put Thinking Job Create envelope', () => {
        const sent: { header: unknown; getContent: () => Promise<unknown> }[] = []
        sendPutThinkingJobCreate(
            {
                publish: (p) => {
                    if (p.type === 'StreamingEvent') {
                        sent.push({ header: p.header, getContent: p.getContent })
                    }
                },
            },
            'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            {
                schemaVersion: 1,
                generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                workItemIds: ['11111111-2222-3333-4444-555555555555'],
                jobStatus: 'pending',
            }
        )
        const envelope: StreamingEventEnvelope<unknown> = {
            header: sent[0].header as StreamingEventEnvelope<unknown>['header'],
            getContent: sent[0].getContent as StreamingEventEnvelope<unknown>['getContent'],
        }
        expect(isThinkingSchedulingSubscribedEnvelope(envelope)).toBe(true)
    })

    it('accepts api.ephemera Put Thinking Job Error envelope', () => {
        const sent: { header: unknown; getContent: () => Promise<unknown> }[] = []
        sendPutThinkingJobError(
            {
                publish: (p) => {
                    if (p.type === 'StreamingEvent') {
                        sent.push({ header: p.header, getContent: p.getContent })
                    }
                },
            },
            'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            {
                schemaVersion: 1,
                generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                jobStatus: 'failed',
                failedAt: '2026-01-01T00:00:00.000Z',
            }
        )
        const envelope: StreamingEventEnvelope<unknown> = {
            header: sent[0].header as StreamingEventEnvelope<unknown>['header'],
            getContent: sent[0].getContent as StreamingEventEnvelope<unknown>['getContent'],
        }
        expect(isThinkingSchedulingSubscribedEnvelope(envelope)).toBe(true)
    })
})
