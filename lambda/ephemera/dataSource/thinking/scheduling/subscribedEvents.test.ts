import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

import { sendPutThinkingSchedule } from '../../apiEphemera'
import { isThinkingSchedulingSubscribedEnvelope } from './subscribedEvents'

describe('isThinkingSchedulingSubscribedEnvelope', () => {
    it('accepts api.ephemera Put Thinking Schedule envelope', () => {
        const sent: { header: unknown; getContent: () => Promise<unknown> }[] = []
        sendPutThinkingSchedule(
            {
                send: (p) => {
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

    it('rejects non-api.ephemera publisher', () => {
        const envelope: StreamingEventEnvelope<unknown> = {
            header: {
                dataSourceKey: 'mtw.ephemera.coyoteGame',
                streamKey: 'ROOM#x',
                timestamp: 1,
                type: 'Put Thinking Schedule',
            },
            getContent: async () => ({}),
        }
        expect(isThinkingSchedulingSubscribedEnvelope(envelope)).toBe(false)
    })
})
