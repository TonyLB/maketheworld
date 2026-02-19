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
})
