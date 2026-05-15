// Tests for subscription message type guards

import { isSubscriptionClientMessage } from './subscriptions'

describe('isSubscriptionClientMessage', () => {
    it('should accept WML message with update missing type when shape is valid', () => {
        const message = {
            messageType: 'StreamEvent',
            eventType: 'Content Update',
            dataSourceKey: 'mtw.wml',
            streamKey: 'ASSET#test',
            timestamp: 1234567890,
            update: { wml: '<Asset />' }
        }
        expect(isSubscriptionClientMessage(message)).toBe(true)
    })

    it('should accept Library message with update missing type when shape is valid', () => {
        const message = {
            messageType: 'StreamEvent',
            eventType: 'Snapshot',
            dataSourceKey: 'mtw.assets.library',
            streamKey: 'global',
            timestamp: 1234567890,
            update: { assetIds: ['ASSET#test1'] }
        }
        expect(isSubscriptionClientMessage(message)).toBe(true)
    })

    it('should accept thinking scheduling Job Completed StreamEvent without update.type', () => {
        const message = {
            messageType: 'StreamEvent',
            eventType: 'Job Completed',
            dataSourceKey: 'mtw.ephemera.thinking.scheduling',
            streamKey: 'global',
            timestamp: 1234567890,
            update: {
                schemaVersion: 1,
                generationId: '11111111-1111-1111-1111-111111111111',
                jobStatus: 'completed',
                completedAt: '2026-05-14T13:00:00.000Z',
                schedules: [
                    {
                        schemaVersion: 1,
                        generationId: '11111111-1111-1111-1111-111111111111',
                        workItemId: '22222222-2222-2222-2222-222222222222',
                        segment: 'candidates',
                        scheduleStatus: 'completed'
                    }
                ]
            }
        }
        expect(isSubscriptionClientMessage(message)).toBe(true)
    })

    it('should accept thinking scheduling Job Completed StreamEvent with update.type', () => {
        const message = {
            messageType: 'StreamEvent',
            eventType: 'Job Completed',
            dataSourceKey: 'mtw.ephemera.thinking.scheduling',
            streamKey: 'global',
            timestamp: 1234567890,
            update: {
                type: 'Job Completed',
                schemaVersion: 1,
                generationId: '11111111-1111-1111-1111-111111111111',
                jobStatus: 'completed',
                completedAt: '2026-05-14T13:00:00.000Z',
                schedules: [
                    {
                        schemaVersion: 1,
                        generationId: '11111111-1111-1111-1111-111111111111',
                        workItemId: '22222222-2222-2222-2222-222222222222',
                        segment: 'candidates',
                        scheduleStatus: 'completed'
                    }
                ]
            }
        }
        expect(isSubscriptionClientMessage(message)).toBe(true)
    })

    it('should accept thinking scheduling Snapshot StreamEvent', () => {
        const message = {
            messageType: 'StreamEvent',
            eventType: 'Snapshot',
            dataSourceKey: 'mtw.ephemera.thinking.scheduling',
            streamKey: 'global',
            timestamp: 1234567890,
            update: { completedJobs: [] }
        }
        expect(isSubscriptionClientMessage(message)).toBe(true)
    })
})
