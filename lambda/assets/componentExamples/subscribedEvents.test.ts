import {
    isComponentExamplesSubscribedEnvelope,
} from './subscribedEvents'

describe('componentExamples subscribedEvents', () => {
    describe('isComponentExamplesSubscribedEnvelope', () => {
        it('should return true for Component Updated events from mtw.assets', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Component Updated',
                },
                getContent: () => Promise.resolve({ component: {} }),
            }
            expect(isComponentExamplesSubscribedEnvelope(envelope)).toBe(true)
        })

        it('should return true for Component Removed events from mtw.assets', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Component Removed',
                },
                getContent: () => Promise.resolve({ component: {} }),
            }
            expect(isComponentExamplesSubscribedEnvelope(envelope)).toBe(true)
        })

        it('should return false for Component Republished events from mtw.assets', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Component Republished',
                },
                getContent: () => Promise.resolve({ component: {} }),
            }
            expect(isComponentExamplesSubscribedEnvelope(envelope)).toBe(false)
        })

        it('should return false for other mtw.assets event types', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Zone Updated',
                },
                getContent: () => Promise.resolve({}),
            }
            expect(isComponentExamplesSubscribedEnvelope(envelope)).toBe(false)
        })

        it('should return false for events from other data sources', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Content Update',
                },
                getContent: () => Promise.resolve({}),
            }
            expect(isComponentExamplesSubscribedEnvelope(envelope)).toBe(false)
        })
    })
})
