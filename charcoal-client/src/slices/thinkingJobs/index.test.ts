import {
    thinkingJobsSlice,
    thinkingJobsSelectors,
    subscribeToThinkingJobs,
    unsubscribeFromThinkingJobs,
    getCompletedThinkingJobs,
    getIsThinkingJobsSubscribed,
    iterateThinkingJobs
} from './index'

describe('thinkingJobs Slice', () => {
    describe('Slice Creation', () => {
        it('should create slice with correct name', () => {
            expect(thinkingJobsSlice.name).toBe('thinkingJobs')
        })

        it('should have initial state', () => {
            const state = thinkingJobsSlice.getInitialState()
            expect(state).toBeDefined()
            expect(state).toHaveProperty('publicData')
        })
    })

    describe('Selectors', () => {
        it('should export getActiveStreamKeys selector', () => {
            expect(thinkingJobsSelectors.getActiveStreamKeys).toBeDefined()
            expect(typeof thinkingJobsSelectors.getActiveStreamKeys).toBe('function')
        })

        it('should export getSubscribedStreams selector', () => {
            expect(thinkingJobsSelectors.getSubscribedStreams).toBeDefined()
            expect(typeof thinkingJobsSelectors.getSubscribedStreams).toBe('function')
        })

        describe('getCompletedThinkingJobs', () => {
            it('should return empty array when no streams subscribed', () => {
                const mockState = {
                    thinkingJobs: {
                        publicData: {
                            subscribedStreams: {}
                        }
                    }
                }
                expect(getCompletedThinkingJobs(mockState)).toEqual([])
            })

            it('should return completed jobs from global stream materialized view', () => {
                const job = {
                    schemaVersion: 1,
                    generationId: 'gen-1',
                    jobStatus: 'completed' as const,
                    completedAt: '2026-05-14T13:00:00.000Z',
                    schedules: [
                        {
                            schemaVersion: 1,
                            generationId: 'gen-1',
                            workItemId: 'work-1',
                            segment: 'candidates' as const,
                            scheduleStatus: 'completed' as const
                        }
                    ]
                }
                const mockState = {
                    thinkingJobs: {
                        publicData: {
                            subscribedStreams: {
                                global: {
                                    materializedView: {
                                        completedJobs: [job]
                                    },
                                    recentEvents: []
                                }
                            }
                        }
                    }
                }
                expect(getCompletedThinkingJobs(mockState)).toEqual([job])
            })

            it('should return empty array when global stream has no materialized view', () => {
                const mockState = {
                    thinkingJobs: {
                        publicData: {
                            subscribedStreams: {
                                global: {
                                    materializedView: null,
                                    recentEvents: []
                                }
                            }
                        }
                    }
                }
                expect(getCompletedThinkingJobs(mockState)).toEqual([])
            })
        })

        describe('getIsThinkingJobsSubscribed', () => {
            it('should return false when global is not active', () => {
                const mockState = {
                    thinkingJobs: {
                        publicData: {
                            activeStreamKeys: []
                        }
                    }
                }
                expect(getIsThinkingJobsSubscribed(mockState)).toBe(false)
            })

            it('should return true when global stream is active', () => {
                const mockState = {
                    thinkingJobs: {
                        publicData: {
                            activeStreamKeys: ['global']
                        }
                    }
                }
                expect(getIsThinkingJobsSubscribed(mockState)).toBe(true)
            })
        })
    })

    describe('Helper Functions', () => {
        it('subscribeToThinkingJobs returns defined action', () => {
            expect(subscribeToThinkingJobs()).toBeDefined()
        })

        it('unsubscribeFromThinkingJobs returns defined action', () => {
            expect(unsubscribeFromThinkingJobs()).toBeDefined()
        })
    })

    describe('SSM', () => {
        it('exports iterateThinkingJobs', () => {
            expect(iterateThinkingJobs).toBeDefined()
        })
    })
})
