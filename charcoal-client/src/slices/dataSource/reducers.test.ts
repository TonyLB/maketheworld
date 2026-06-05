import { describe, it, expect } from 'vitest'
import produce from 'immer'
import { createDataSourceSlice } from './index'
import { applyEvents, performCleanup, processEnvelope, pruneStaleConfirmedRequestIds } from './reducers'
import {
    CONFIRMED_TTL_MS,
    storedConfirmedRequestIdStrings
} from './requestIdTracking'
import { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import type { RecentEventEnvelope, RequestIdTrackingConfig } from './baseClasses'

// Test types
type TestSnapshot = {
    type: 'Snapshot'
    items: string[]
}

type TestUpdate = {
    type: 'Item Added' | 'Item Removed'
    item: string
}

type TestEvent = TestSnapshot | TestUpdate

// Type guards
const isTestSnapshot = (event: TestEvent): event is TestSnapshot => event.type === 'Snapshot'
const isTestUpdate = (event: TestEvent): event is TestUpdate => event.type === 'Item Added' || event.type === 'Item Removed'

// Helper to build envelope for tests (header + content + timestamp)
function testEnvelope(event: TestEvent, timestamp: number, streamKey = 'stream1'): RecentEventEnvelope<TestEvent> {
    return {
        header: { dataSourceKey: 'test', streamKey, timestamp, type: event.type },
        content: event,
        timestamp
    }
}

// Helper for update-only arrays (applyEvents accepts only UpdatePayload)
function testUpdateEnvelope(event: TestUpdate, timestamp: number): RecentEventEnvelope<TestUpdate> {
    return testEnvelope(event, timestamp) as RecentEventEnvelope<TestUpdate>
}

// Mock aggregator
const mockAggregator: DataSourceAggregator<TestSnapshot, TestUpdate> = {
    createEmpty: (_streamKey) => ({ type: 'Snapshot', items: [] }),
    applyUpdate: (snapshot, envelope) => {
        try {
            const update = envelope.content
            if (envelope.header.type === 'Item Added') {
                return {
                    success: true,
                    snapshot: {
                        type: 'Snapshot',
                        items: [...snapshot.items, update.item]
                    }
                }
            } else if (envelope.header.type === 'Item Removed') {
                return {
                    success: true,
                    snapshot: {
                        type: 'Snapshot',
                        items: snapshot.items.filter(i => i !== update.item)
                    }
                }
            }
            throw new Error('Unknown update type')
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                snapshot
            }
        }
    }
}

describe('dataSource reducers', () => {
    
    describe('applyEvents', () => {
        const applyEventsWithAggregator = applyEvents(mockAggregator)
        
        it('should apply multiple updates in order', () => {
            const baseline: TestSnapshot = { type: 'Snapshot', items: ['a'] }
            const updates = [
                testUpdateEnvelope({ type: 'Item Added' as const, item: 'b' }, 1000),
                testUpdateEnvelope({ type: 'Item Added' as const, item: 'c' }, 2000)
            ]

            const result = applyEventsWithAggregator(baseline, updates)

            expect(result.items).toEqual(['a', 'b', 'c'])
        })

        it('should handle empty events array', () => {
            const baseline: TestSnapshot = { type: 'Snapshot', items: ['a'] }
            const result = applyEventsWithAggregator(baseline, [])

            expect(result.items).toEqual(['a'])
        })

        it('should continue on aggregation failure', () => {
            const baseline: TestSnapshot = { type: 'Snapshot', items: ['a'] }
            const updates = [
                testUpdateEnvelope({ type: 'Item Added' as const, item: 'b' }, 1000),
                testUpdateEnvelope({ type: 'Invalid' as any, item: 'bad' }, 2000),  // This will fail
                testUpdateEnvelope({ type: 'Item Added' as const, item: 'c' }, 3000)
            ]

            const result = applyEventsWithAggregator(baseline, updates)

            // Should have 'b' and 'c', but skip the failed update
            expect(result.items).toEqual(['a', 'b', 'c'])
        })
    })
    
    describe('performCleanup', () => {
        const applyEventsWithAggregator = applyEvents(mockAggregator)
        const performCleanupWithConfig = performCleanup(mockAggregator, applyEventsWithAggregator)
        
        it('should keep all events when nothing is old', () => {
            const recentEvents = [
                testEnvelope({ type: 'Snapshot' as const, items: ['a'] }, 50000),
                testEnvelope({ type: 'Item Added' as const, item: 'b' }, 60000)
            ]

            const result = performCleanupWithConfig(recentEvents, 70000, 'stream1')

            // 30 seconds ago from 70000 is 40000, so all events are recent
            expect(result).toHaveLength(2)
            expect(result[0].content).toEqual({ type: 'Snapshot', items: ['a'] })
            expect(result[1].content).toEqual({ type: 'Item Added', item: 'b' })
        })

        it('should consolidate old events into synthetic snapshot', () => {
            const recentEvents = [
                testEnvelope({ type: 'Snapshot' as const, items: [] }, 10000),
                testEnvelope({ type: 'Item Added' as const, item: 'a' }, 20000),
                testEnvelope({ type: 'Item Added' as const, item: 'b' }, 30000),
                testEnvelope({ type: 'Item Added' as const, item: 'c' }, 50000)
            ]

            const result = performCleanupWithConfig(recentEvents, 60000, 'stream1')

            // 30 seconds ago from 60000 is 30000
            // Events at 10000, 20000, 30000 are old (<=30000)
            // Event at 50000 is recent (>30000)
            // Should consolidate old events into synthetic snapshot at 30000
            expect(result).toHaveLength(2)

            // First event should be synthetic snapshot at 30-second boundary
            expect(result[0].timestamp).toBe(30000)
            expect(result[0].content).toEqual({ type: 'Snapshot', items: ['a', 'b'] })

            // Second event should be the recent event
            expect(result[1].timestamp).toBe(50000)
            expect(result[1].content).toEqual({ type: 'Item Added', item: 'c' })
        })

        it('should use createEmpty when no snapshot in old events', () => {
            const recentEvents = [
                testEnvelope({ type: 'Item Added' as const, item: 'a' }, 10000),
                testEnvelope({ type: 'Item Added' as const, item: 'b' }, 20000),
                testEnvelope({ type: 'Item Added' as const, item: 'c' }, 50000)
            ]

            const result = performCleanupWithConfig(recentEvents, 60000, 'stream1')

            // Should create empty baseline and consolidate old events
            expect(result).toHaveLength(2)
            expect(result[0].content).toEqual({ type: 'Snapshot', items: ['a', 'b'] })
            expect(result[1].content).toEqual({ type: 'Item Added', item: 'c' })
        })

        it('should handle incoming timestamp as latest when greater than all events', () => {
            const recentEvents = [
                testEnvelope({ type: 'Snapshot' as const, items: [] }, 10000)
            ]

            const result = performCleanupWithConfig(recentEvents, 100000, 'stream1')

            // 30 seconds ago from 100000 is 70000
            // Event at 10000 is old
            // Should consolidate to synthetic snapshot
            expect(result).toHaveLength(1)
            expect(result[0].timestamp).toBe(70000)
            expect(result[0].content).toEqual({ type: 'Snapshot', items: [] })
        })
    })
    
    describe('processEnvelope (snapshot path)', () => {
        const applyEventsWithAggregator = applyEvents(mockAggregator)
        const performCleanupWithConfig = performCleanup(mockAggregator, applyEventsWithAggregator)
        const processEnvelopeReducer = processEnvelope(
            'test.dataSource',
            mockAggregator,
            performCleanupWithConfig,
            applyEventsWithAggregator
        )
        
        it('should process snapshot and replace materialized view', () => {
            const initialPublicData = {
                subscribedStreams: {
                    'stream1': {
                        materializedView: { type: 'Snapshot' as const, items: ['old'] },
                        recentEvents: [] as Array<RecentEventEnvelope<TestEvent>>
                    }
                }
            }
            
            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 10000,
                    header: { dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 10000, type: 'Snapshot' },
                    content: { type: 'Snapshot' as const, items: ['new'] }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })
            
            expect(newState.subscribedStreams['stream1'].materializedView.items).toEqual(['new'])
            expect(newState.subscribedStreams['stream1'].recentEvents).toHaveLength(1)
            expect(newState.subscribedStreams['stream1'].recentEvents[0].content).toEqual({ type: 'Snapshot', items: ['new'] })
        })

        it('should handle events that happened after snapshot', () => {
            const initialPublicData = {
                subscribedStreams: {
                    'stream1': {
                        materializedView: { type: 'Snapshot' as const, items: ['a'] },
                        recentEvents: [
                            testEnvelope({ type: 'Item Added' as const, item: 'b' }, 20000)
                        ]
                    }
                }
            }
            
            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 15000,  // Snapshot comes BEFORE existing event
                    header: { dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 15000, type: 'Snapshot' },
                    content: { type: 'Snapshot' as const, items: ['x'] }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })
            
            // Should have snapshot + event after it
            expect(newState.subscribedStreams['stream1'].recentEvents).toHaveLength(2)
            expect(newState.subscribedStreams['stream1'].recentEvents[0].timestamp).toBe(15000)
            expect(newState.subscribedStreams['stream1'].recentEvents[1].timestamp).toBe(20000)
            
            // Materialized view should be snapshot + event applied
            expect(newState.subscribedStreams['stream1'].materializedView.items).toEqual(['x', 'b'])
        })
        
        it('should ignore events for unsubscribed streams', () => {
            const initialPublicData = {
                subscribedStreams: {}
            }
            
            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'nonexistent',
                    timestamp: 10000,
                    header: { dataSourceKey: 'test.dataSource', streamKey: 'nonexistent', timestamp: 10000, type: 'Snapshot' },
                    content: { type: 'Snapshot' as const, items: ['a'] }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })
            
            // State should be unchanged (no mutation)
            expect(newState).toEqual(initialPublicData)
        })
    })

    describe('processEnvelope (event path)', () => {
        const applyEventsWithAggregator = applyEvents(mockAggregator)
        const performCleanupWithConfig = performCleanup(mockAggregator, applyEventsWithAggregator)
        const processEnvelopeReducer = processEnvelope(
            'test.dataSource',
            mockAggregator,
            performCleanupWithConfig,
            applyEventsWithAggregator
        )
        
        it('should process in-order event with fast path', () => {
            const initialPublicData = {
                subscribedStreams: {
                    'stream1': {
                        materializedView: { type: 'Snapshot' as const, items: ['a'] },
                        recentEvents: [
                            testEnvelope({ type: 'Item Added' as const, item: 'a' }, 10000)
                        ]
                    }
                }
            }
            
            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,  // After existing event
                    header: { dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 20000, type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })
            
            // Should use fast path
            expect(newState.subscribedStreams['stream1'].materializedView.items).toEqual(['a', 'b'])
            expect(newState.subscribedStreams['stream1'].recentEvents).toHaveLength(2)
            expect(newState.subscribedStreams['stream1'].recentEvents[1].content).toEqual({ type: 'Item Added', item: 'b' })
        })
        
        it('should process out-of-order event with re-aggregation', () => {
            const initialPublicData = {
                subscribedStreams: {
                    'stream1': {
                        materializedView: { type: 'Snapshot' as const, items: ['a', 'c'] },
                        recentEvents: [
                            testEnvelope({ type: 'Snapshot' as const, items: ['a'] }, 10000),
                            testEnvelope({ type: 'Item Added' as const, item: 'c' }, 30000)
                        ]
                    }
                }
            }
            
            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,  // BETWEEN snapshot and existing event
                    header: { dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 20000, type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })
            
            // Should re-aggregate in correct order: snapshot -> b (new) -> c (existing)
            expect(newState.subscribedStreams['stream1'].materializedView.items).toEqual(['a', 'b', 'c'])
            
            // Recent events should be sorted by timestamp
            expect(newState.subscribedStreams['stream1'].recentEvents).toHaveLength(3)
            expect(newState.subscribedStreams['stream1'].recentEvents[0].timestamp).toBe(10000)  // Snapshot
            expect(newState.subscribedStreams['stream1'].recentEvents[1].timestamp).toBe(20000)  // New event
            expect(newState.subscribedStreams['stream1'].recentEvents[2].timestamp).toBe(30000)  // Existing event
        })
        
        it('should ignore events for unsubscribed streams', () => {
            const initialPublicData = {
                subscribedStreams: {}
            }
            
            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'nonexistent',
                    timestamp: 10000,
                    header: { dataSourceKey: 'test.dataSource', streamKey: 'nonexistent', timestamp: 10000, type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'a' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })
            
            // State should be unchanged
            expect(newState).toEqual(initialPublicData)
        })

        it('should re-aggregate from createEmpty when no baseline snapshot', () => {
            const initialPublicData = {
                subscribedStreams: {
                    'stream1': {
                        materializedView: { type: 'Snapshot' as const, items: ['a', 'c'] },
                        recentEvents: [
                            testEnvelope({ type: 'Item Added' as const, item: 'a' }, 20000),
                            testEnvelope({ type: 'Item Added' as const, item: 'c' }, 40000)
                        ]
                    }
                }
            }
            
            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 30000,  // Out of order
                    header: { dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 30000, type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })
            
            // Should re-aggregate from empty: a, b, c
            expect(newState.subscribedStreams['stream1'].materializedView.items).toEqual(['a', 'b', 'c'])
        })
        
        it('should perform cleanup before processing events', () => {
            const initialPublicData = {
                subscribedStreams: {
                    'stream1': {
                        materializedView: { type: 'Snapshot' as const, items: ['a', 'b'] },
                        recentEvents: [
                            testEnvelope({ type: 'Snapshot' as const, items: [] }, 10000),
                            testEnvelope({ type: 'Item Added' as const, item: 'a' }, 20000),
                            testEnvelope({ type: 'Item Added' as const, item: 'b' }, 30000)
                        ]
                    }
                }
            }
            
            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 70000,  // Much later
                    header: { dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 70000, type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'c' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })
            
            // Old events should have been cleaned up
            // 30 seconds ago from 70000 is 40000, so all events (10000, 20000, 30000) are old
            // Should have synthetic snapshot + new event
            expect(newState.subscribedStreams['stream1'].recentEvents.length).toBeLessThan(4)
            
            // Materialized view should still have all items
            expect(newState.subscribedStreams['stream1'].materializedView.items).toEqual(['a', 'b', 'c'])
        })
        
        it('should ignore update events with timestamp earlier than most recent snapshot', () => {
            const initialPublicData = {
                subscribedStreams: {
                    'stream1': {
                        materializedView: { type: 'Snapshot' as const, items: ['a', 'b', 'c'] },
                        recentEvents: [
                            testEnvelope({ type: 'Snapshot' as const, items: ['a', 'b', 'c'] }, 50000)
                        ]
                    }
                }
            }
            
            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 40000,  // BEFORE the snapshot at 50000
                    header: { dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 40000, type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'd' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })
            
            // The event timestamp (40000) is before the most recent snapshot (50000)
            // The re-aggregation logic finds baseline snapshot at 50000
            // It collects events AFTER 50000 (none) + incoming event (40000)
            // After sorting: [event@40000]
            // It filters for UPDATE events to apply: [event@40000]
            // But these are NOT applied because they're before the baseline!
            // The newRecentEvents includes: [snapshot@50000, ...sortedEvents]
            
            // Recent events should have snapshot + the old event (even though it's before snapshot)
            expect(newState.subscribedStreams['stream1'].recentEvents).toHaveLength(2)
            expect(newState.subscribedStreams['stream1'].recentEvents[0].timestamp).toBe(50000)  // Snapshot first
            expect(newState.subscribedStreams['stream1'].recentEvents[1].timestamp).toBe(40000)  // Old event (not applied)
            
            // Materialized view should be unchanged - only events AFTER snapshot are applied
            // The old event is NOT applied to the materialized view
            expect(newState.subscribedStreams['stream1'].materializedView.items).toEqual(['a', 'b', 'c'])
        })
    })

    describe('processEnvelope requestIdTracking', () => {
        const trackingConfig = { headerField: 'RequestIds' as const }

        const conflictAwareAggregator: DataSourceAggregator<TestSnapshot, TestUpdate> = {
            createEmpty: (_streamKey) => ({ type: 'Snapshot', items: [] }),
            applyUpdate: (snapshot, envelope) => {
                if (envelope.header.type === 'Conflict') {
                    return {
                        success: false,
                        error: new Error('Merge conflict'),
                        snapshot
                    }
                }
                return mockAggregator.applyUpdate(snapshot, envelope)
            }
        }

        const applyEventsWithAggregator = applyEvents(conflictAwareAggregator)
        const performCleanupWithConfig = performCleanup(conflictAwareAggregator, applyEventsWithAggregator)

        const createProcessEnvelopeReducer = (requestIdTracking?: RequestIdTrackingConfig) => processEnvelope(
            'test.dataSource',
            conflictAwareAggregator,
            performCleanupWithConfig,
            applyEventsWithAggregator,
            requestIdTracking
        )

        const processEnvelopeReducer = createProcessEnvelopeReducer(trackingConfig)

        const stream1WithConfirmed = (confirmedRequestIds: Array<{ id: string; seenAt: number }>) => ({
            stream1: {
                materializedView: { type: 'Snapshot' as const, items: ['a'] },
                recentEvents: [
                    testEnvelope({ type: 'Item Added' as const, item: 'a' }, 10000)
                ],
                confirmedRequestIds
            }
        })

        it('records confirmed id and updates materializedView in one processEnvelope action', () => {
            const initialPublicData = {
                subscribedStreams: {
                    stream1: {
                        materializedView: { type: 'Snapshot' as const, items: ['a'] },
                        recentEvents: [
                            testEnvelope({ type: 'Item Added' as const, item: 'a' }, 10000)
                        ],
                        confirmedRequestIds: [] as Array<{ id: string; seenAt: number }>
                    }
                }
            }

            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,
                    header: {
                        dataSourceKey: 'test.dataSource',
                        streamKey: 'stream1',
                        timestamp: 20000,
                        type: 'Item Added',
                        RequestIds: ['req-A']
                    },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }

            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })

            expect(newState.subscribedStreams.stream1.materializedView.items).toEqual(['a', 'b'])
            expect(newState.subscribedStreams.stream1.confirmedRequestIds).toEqual([
                { id: 'req-A', seenAt: 20000 }
            ])
        })

        it('records confirmed id without changing materializedView on Merge Conflict analog', () => {
            const initialPublicData = {
                subscribedStreams: {
                    stream1: {
                        materializedView: { type: 'Snapshot' as const, items: ['a'] },
                        recentEvents: [
                            testEnvelope({ type: 'Item Added' as const, item: 'a' }, 10000)
                        ],
                        confirmedRequestIds: [] as Array<{ id: string; seenAt: number }>
                    }
                }
            }

            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,
                    header: {
                        dataSourceKey: 'test.dataSource',
                        streamKey: 'stream1',
                        timestamp: 20000,
                        type: 'Conflict',
                        RequestIds: ['req-B']
                    },
                    content: { type: 'Item Added' as const, item: 'ignored' }
                }
            }

            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })

            expect(newState.subscribedStreams.stream1.materializedView.items).toEqual(['a'])
            expect(newState.subscribedStreams.stream1.confirmedRequestIds).toEqual([
                { id: 'req-B', seenAt: 20000 }
            ])
        })

        it('leaves confirmedRequestIds unchanged when RequestIds is empty', () => {
            const existingConfirmed = [{ id: 'old', seenAt: 1 }]
            const initialPublicData = {
                subscribedStreams: stream1WithConfirmed(existingConfirmed)
            }

            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,
                    header: {
                        dataSourceKey: 'test.dataSource',
                        streamKey: 'stream1',
                        timestamp: 20000,
                        type: 'Item Added',
                        RequestIds: []
                    },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }

            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })

            expect(newState.subscribedStreams.stream1.confirmedRequestIds).toEqual(existingConfirmed)
            expect(newState.subscribedStreams.stream1.materializedView.items).toEqual(['a', 'b'])
        })

        it('leaves confirmedRequestIds unchanged when RequestIds is omitted', () => {
            const existingConfirmed = [{ id: 'old', seenAt: 1 }]
            const initialPublicData = {
                subscribedStreams: stream1WithConfirmed(existingConfirmed)
            }

            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,
                    header: {
                        dataSourceKey: 'test.dataSource',
                        streamKey: 'stream1',
                        timestamp: 20000,
                        type: 'Item Added'
                    },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }

            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })

            expect(newState.subscribedStreams.stream1.confirmedRequestIds).toEqual(existingConfirmed)
        })

        it('ignores singular RequestId when headerField is RequestIds', () => {
            const reducer = createProcessEnvelopeReducer({ headerField: 'RequestIds' })
            const initialPublicData = {
                subscribedStreams: stream1WithConfirmed([])
            }

            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,
                    header: {
                        dataSourceKey: 'test.dataSource',
                        streamKey: 'stream1',
                        timestamp: 20000,
                        type: 'Item Added',
                        RequestId: 'x'
                    },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }

            const newState = produce(initialPublicData, (draft) => {
                reducer(draft, action as any)
            })

            expect(newState.subscribedStreams.stream1.confirmedRequestIds).toEqual([])
        })

        it('records singular RequestId when headerField is RequestId', () => {
            const reducer = createProcessEnvelopeReducer({ headerField: 'RequestId' })
            const initialPublicData = {
                subscribedStreams: stream1WithConfirmed([])
            }

            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,
                    header: {
                        dataSourceKey: 'test.dataSource',
                        streamKey: 'stream1',
                        timestamp: 20000,
                        type: 'Item Added',
                        RequestId: 'x'
                    },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }

            const newState = produce(initialPublicData, (draft) => {
                reducer(draft, action as any)
            })

            expect(newState.subscribedStreams.stream1.confirmedRequestIds).toEqual([
                { id: 'x', seenAt: 20000 }
            ])
        })

        it('dedupes when headerField is both and RequestIds and RequestId match', () => {
            const reducer = createProcessEnvelopeReducer({ headerField: 'both' })
            const initialPublicData = {
                subscribedStreams: stream1WithConfirmed([])
            }

            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,
                    header: {
                        dataSourceKey: 'test.dataSource',
                        streamKey: 'stream1',
                        timestamp: 20000,
                        type: 'Item Added',
                        RequestIds: ['a'],
                        RequestId: 'a'
                    },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }

            const newState = produce(initialPublicData, (draft) => {
                reducer(draft, action as any)
            })

            expect(newState.subscribedStreams.stream1.confirmedRequestIds).toEqual([
                { id: 'a', seenAt: 20000 }
            ])
        })

        it('isolates confirmedRequestIds per stream key', () => {
            const initialPublicData = {
                subscribedStreams: {
                    ...stream1WithConfirmed([]),
                    stream2: {
                        materializedView: { type: 'Snapshot' as const, items: ['z'] },
                        recentEvents: [
                            testEnvelope({ type: 'Item Added' as const, item: 'z' }, 10000, 'stream2')
                        ],
                        confirmedRequestIds: [{ id: 'stream2-only', seenAt: 5000 }]
                    }
                }
            }

            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,
                    header: {
                        dataSourceKey: 'test.dataSource',
                        streamKey: 'stream1',
                        timestamp: 20000,
                        type: 'Item Added',
                        RequestIds: ['req-stream1']
                    },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }

            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })

            expect(newState.subscribedStreams.stream1.confirmedRequestIds).toEqual([
                { id: 'req-stream1', seenAt: 20000 }
            ])
            expect(newState.subscribedStreams.stream2.confirmedRequestIds).toEqual([
                { id: 'stream2-only', seenAt: 5000 }
            ])
        })

        it('does not add confirmedRequestIds when tracking is disabled', () => {
            const reducer = createProcessEnvelopeReducer(undefined)
            const initialPublicData = {
                subscribedStreams: {
                    stream1: {
                        materializedView: { type: 'Snapshot' as const, items: ['a'] },
                        recentEvents: [
                            testEnvelope({ type: 'Item Added' as const, item: 'a' }, 10000)
                        ]
                    }
                }
            }

            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,
                    header: {
                        dataSourceKey: 'test.dataSource',
                        streamKey: 'stream1',
                        timestamp: 20000,
                        type: 'Item Added',
                        RequestIds: ['req-A']
                    },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }

            const newState = produce(initialPublicData, (draft) => {
                reducer(draft, action as any)
            })

            expect(newState.subscribedStreams.stream1).not.toHaveProperty('confirmedRequestIds')
        })

        it('appends confirmed ids across events without eager prune', () => {
            const existingConfirmed = [{ id: 'old', seenAt: 1 }]
            const initialPublicData = {
                subscribedStreams: stream1WithConfirmed(existingConfirmed)
            }

            const action = {
                payload: {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 20000,
                    header: {
                        dataSourceKey: 'test.dataSource',
                        streamKey: 'stream1',
                        timestamp: 20000,
                        type: 'Item Added',
                        RequestIds: ['new']
                    },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }

            const newState = produce(initialPublicData, (draft) => {
                processEnvelopeReducer(draft, action as any)
            })

            expect(newState.subscribedStreams.stream1.confirmedRequestIds).toEqual([
                { id: 'old', seenAt: 1 },
                { id: 'new', seenAt: 20000 }
            ])
        })
    })

    describe('pruneStaleConfirmedRequestIds', () => {
        const NOW = 1_000_000
        const pruneReducer = pruneStaleConfirmedRequestIds(CONFIRMED_TTL_MS)

        const stateWithConfirmed = (confirmedRequestIds: Array<{ id: string; seenAt: number }>) => ({
            subscribedStreams: {
                stream1: {
                    materializedView: { type: 'Snapshot' as const, items: ['a'] },
                    recentEvents: [],
                    confirmedRequestIds
                }
            }
        })

        it('removes confirmed rows older than CONFIRMED_TTL_MS', () => {
            const initial = stateWithConfirmed([
                { id: 'stale', seenAt: NOW - CONFIRMED_TTL_MS },
                { id: 'fresh', seenAt: NOW - CONFIRMED_TTL_MS + 1 }
            ])
            const newState = produce(initial, (draft) => {
                pruneReducer(draft, {
                    type: 'pruneStaleConfirmedRequestIds',
                    payload: { streamKey: 'stream1', now: NOW, pendingKeys: [] }
                })
            })
            expect(newState.subscribedStreams.stream1.confirmedRequestIds).toEqual([
                { id: 'fresh', seenAt: NOW - CONFIRMED_TTL_MS + 1 }
            ])
        })

        it('retains stale confirmed row when pending key matches (oscillation invariant)', () => {
            const staleRow = { id: 'req-a', seenAt: NOW - CONFIRMED_TTL_MS }
            const initial = stateWithConfirmed([staleRow])
            const newState = produce(initial, (draft) => {
                pruneReducer(draft, {
                    type: 'pruneStaleConfirmedRequestIds',
                    payload: { streamKey: 'stream1', now: NOW, pendingKeys: ['req-a'] }
                })
            })
            expect(newState.subscribedStreams.stream1.confirmedRequestIds).toEqual([staleRow])
        })

        it('no-ops when stream is missing', () => {
            const initial = { subscribedStreams: {} }
            const newState = produce(initial, (draft) => {
                pruneReducer(draft, {
                    type: 'pruneStaleConfirmedRequestIds',
                    payload: { streamKey: 'missing', now: NOW, pendingKeys: [] }
                })
            })
            expect(newState.subscribedStreams).toEqual({})
        })

        it('no-ops when confirmedRequestIds is undefined', () => {
            const initial = {
                subscribedStreams: {
                    stream1: {
                        materializedView: { type: 'Snapshot' as const, items: ['a'] },
                        recentEvents: []
                    }
                }
            }
            const newState = produce(initial, (draft) => {
                pruneReducer(draft, {
                    type: 'pruneStaleConfirmedRequestIds',
                    payload: { streamKey: 'stream1', now: NOW, pendingKeys: [] }
                })
            })
            expect(newState.subscribedStreams.stream1).not.toHaveProperty('confirmedRequestIds')
        })
    })

    describe('storedConfirmedRequestIdStrings / getConfirmedRequestIds', () => {
        it('maps all storage rows to id strings', () => {
            const rows = [
                { id: 'fresh', seenAt: 99_999 },
                { id: 'stale', seenAt: 0 }
            ]
            expect(storedConfirmedRequestIdStrings(rows)).toEqual(['fresh', 'stale'])
        })

        it('returns STABLE_EMPTY for undefined rows', () => {
            expect(storedConfirmedRequestIdStrings(undefined)).toEqual([])
        })

        it('returns same reference on double read with unchanged storage (I1)', () => {
            const rows = [
                { id: 'req-a', seenAt: 1 },
                { id: 'req-b', seenAt: 2 }
            ]
            const { getConfirmedRequestIds } = createDataSourceSlice({
                name: 'trackingDataSource',
                dataSourceKey: 'test.tracking',
                aggregator: mockAggregator,
                eventSerializer: {
                    serialize: (params) => params.content as any,
                    deserialize: async (params) => params.content
                },
                sliceSelector: (state) => state.trackingDataSource,
                requestIdTracking: { headerField: 'RequestIds' }
            })

            const state = {
                trackingDataSource: {
                    publicData: {
                        subscribedStreams: {
                            stream1: { confirmedRequestIds: rows }
                        }
                    }
                }
            }

            const first = getConfirmedRequestIds!(state, 'stream1')
            const second = getConfirmedRequestIds!(state, 'stream1')
            expect(second).toBe(first)
            expect(first).toEqual(['req-a', 'req-b'])
        })

        it('returns all storage ids via getConfirmedRequestIds including stale rows', () => {
            const now = CONFIRMED_TTL_MS
            const { getConfirmedRequestIds } = createDataSourceSlice({
                name: 'trackingDataSource',
                dataSourceKey: 'test.tracking',
                aggregator: mockAggregator,
                eventSerializer: {
                    serialize: (params) => params.content as any,
                    deserialize: async (params) => params.content
                },
                sliceSelector: (state) => state.trackingDataSource,
                requestIdTracking: { headerField: 'RequestIds' }
            })

            const state = {
                trackingDataSource: {
                    publicData: {
                        subscribedStreams: {
                            stream1: {
                                confirmedRequestIds: [
                                    { id: 'stale', seenAt: 0 },
                                    { id: 'fresh', seenAt: now - 1 }
                                ]
                            }
                        }
                    }
                }
            }

            expect(getConfirmedRequestIds!(state, 'stream1')).toEqual(['stale', 'fresh'])
            expect(
                state.trackingDataSource.publicData.subscribedStreams.stream1.confirmedRequestIds
            ).toHaveLength(2)
        })

        it('returns an empty array when the stream is missing', () => {
            const { getConfirmedRequestIds } = createDataSourceSlice({
                name: 'trackingDataSource',
                dataSourceKey: 'test.tracking',
                aggregator: mockAggregator,
                eventSerializer: {
                    serialize: (params) => params.content as any,
                    deserialize: async (params) => params.content
                },
                sliceSelector: (state) => state.trackingDataSource,
                requestIdTracking: { headerField: 'RequestIds' }
            })

            expect(getConfirmedRequestIds!({ trackingDataSource: { publicData: { subscribedStreams: {} } } }, 'missing')).toEqual([])
        })
    })
})

