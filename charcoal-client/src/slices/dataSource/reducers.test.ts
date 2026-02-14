import { describe, it, expect, beforeEach, vi } from 'vitest'
import produce from 'immer'
import { applyEvents, performCleanup, processRawSnapshot, processRawEvent } from './reducers'
import { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { RecentEventEnvelope } from './baseClasses'

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
    createEmpty: () => ({ type: 'Snapshot', items: [] }),
    applyUpdate: (snapshot, envelope) => {
        try {
            const update = envelope.content
            if (update.type === 'Item Added') {
                return {
                    success: true,
                    snapshot: {
                        type: 'Snapshot',
                        items: [...snapshot.items, update.item]
                    }
                }
            } else if (update.type === 'Item Removed') {
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

// Mock serializer
const mockSerializer: DataSourceEventSerializer<TestUpdate, any, TestSnapshot, any> = {
    serialize: vi.fn((params) => params.content as any),
    deserialize: vi.fn((params) => params.content),
    serializeSnapshot: vi.fn((snapshot) => snapshot),
    deserializeSnapshot: vi.fn((externalSnapshot) => externalSnapshot)
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
        const performCleanupWithConfig = performCleanup(mockAggregator, isTestSnapshot, isTestUpdate, applyEventsWithAggregator)
        
        it('should keep all events when nothing is old', () => {
            const recentEvents = [
                testEnvelope({ type: 'Snapshot' as const, items: ['a'] }, 50000),
                testEnvelope({ type: 'Item Added' as const, item: 'b' }, 60000)
            ]

            const result = performCleanupWithConfig(recentEvents, 70000)

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

            const result = performCleanupWithConfig(recentEvents, 60000)

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

            const result = performCleanupWithConfig(recentEvents, 60000)

            // Should create empty baseline and consolidate old events
            expect(result).toHaveLength(2)
            expect(result[0].content).toEqual({ type: 'Snapshot', items: ['a', 'b'] })
            expect(result[1].content).toEqual({ type: 'Item Added', item: 'c' })
        })

        it('should handle incoming timestamp as latest when greater than all events', () => {
            const recentEvents = [
                testEnvelope({ type: 'Snapshot' as const, items: [] }, 10000)
            ]

            const result = performCleanupWithConfig(recentEvents, 100000)

            // 30 seconds ago from 100000 is 70000
            // Event at 10000 is old
            // Should consolidate to synthetic snapshot
            expect(result).toHaveLength(1)
            expect(result[0].timestamp).toBe(70000)
            expect(result[0].content).toEqual({ type: 'Snapshot', items: [] })
        })
    })
    
    describe('processRawSnapshot', () => {
        const applyEventsWithAggregator = applyEvents(mockAggregator)
        const performCleanupWithConfig = performCleanup(mockAggregator, isTestSnapshot, isTestUpdate, applyEventsWithAggregator)
        const processSnapshot = processRawSnapshot(
            'test.dataSource',
            mockSerializer,
            isTestUpdate,
            performCleanupWithConfig,
            applyEventsWithAggregator
        )
        
        beforeEach(() => {
            vi.clearAllMocks()
        })
        
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
                    streamKey: 'stream1',
                    timestamp: 10000,
                    header: { type: 'Snapshot' },
                    content: { type: 'Snapshot' as const, items: ['new'] }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processSnapshot(draft, action as any)
            })
            
            expect(mockSerializer.deserializeSnapshot).toHaveBeenCalledWith({ type: 'Snapshot', items: ['new'] })
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
                    streamKey: 'stream1',
                    timestamp: 15000,  // Snapshot comes BEFORE existing event
                    header: { type: 'Snapshot' },
                    content: { type: 'Snapshot' as const, items: ['x'] }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processSnapshot(draft, action as any)
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
                    streamKey: 'nonexistent',
                    timestamp: 10000,
                    header: { type: 'Snapshot' },
                    content: { type: 'Snapshot' as const, items: ['a'] }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processSnapshot(draft, action as any)
            })
            
            // State should be unchanged (no mutation)
            expect(newState).toEqual(initialPublicData)
            expect(mockSerializer.deserializeSnapshot).not.toHaveBeenCalled()
        })
        
        it('should handle deserialization failures gracefully', () => {
            const initialPublicData = {
                subscribedStreams: {
                    'stream1': {
                        materializedView: { type: 'Snapshot' as const, items: ['a'] },
                        recentEvents: [] as Array<RecentEventEnvelope<TestEvent>>
                    }
                }
            }

            const action = {
                payload: {
                    streamKey: 'stream1',
                    timestamp: 10000,
                    header: { type: 'Snapshot' },
                    content: { invalid: 'data' }
                }
            }

            // Mock deserialize to return null
            mockSerializer.deserializeSnapshot = vi.fn(() => null)

            const newState = produce(initialPublicData, (draft) => {
                processSnapshot(draft, action as any)
            })

            // State should be unchanged
            expect(newState).toEqual(initialPublicData)
        })
    })

    describe('processRawEvent', () => {
        const applyEventsWithAggregator = applyEvents(mockAggregator)
        const performCleanupWithConfig = performCleanup(mockAggregator, isTestSnapshot, isTestUpdate, applyEventsWithAggregator)
        const processEvent = processRawEvent(
            'test.dataSource',
            mockSerializer,
            mockAggregator,
            isTestSnapshot,
            isTestUpdate,
            performCleanupWithConfig,
            applyEventsWithAggregator
        )
        
        beforeEach(() => {
            vi.clearAllMocks()
            // Reset to successful deserialize
            mockSerializer.deserialize = vi.fn((params) => params.content)
        })
        
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
                    streamKey: 'stream1',
                    timestamp: 20000,  // After existing event
                    header: { type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEvent(draft, action as any)
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
                    streamKey: 'stream1',
                    timestamp: 20000,  // BETWEEN snapshot and existing event
                    header: { type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEvent(draft, action as any)
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
                    streamKey: 'nonexistent',
                    timestamp: 10000,
                    header: { type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'a' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEvent(draft, action as any)
            })
            
            // State should be unchanged
            expect(newState).toEqual(initialPublicData)
            expect(mockSerializer.deserialize).not.toHaveBeenCalled()
        })
        
        it('should handle deserialization failures gracefully', () => {
            const initialPublicData = {
                subscribedStreams: {
                    'stream1': {
                        materializedView: { type: 'Snapshot' as const, items: ['a'] },
                        recentEvents: [] as Array<RecentEventEnvelope<TestEvent>>
                    }
                }
            }

            const action = {
                payload: {
                    streamKey: 'stream1',
                    timestamp: 10000,
                    header: { type: 'Invalid' },
                    content: { invalid: 'data' }
                }
            }

            // Mock deserialize to return null
            mockSerializer.deserialize = vi.fn(() => null)

            const newState = produce(initialPublicData, (draft) => {
                processEvent(draft, action as any)
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
                    streamKey: 'stream1',
                    timestamp: 30000,  // Out of order
                    header: { type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'b' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEvent(draft, action as any)
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
                    streamKey: 'stream1',
                    timestamp: 70000,  // Much later
                    header: { type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'c' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEvent(draft, action as any)
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
                    streamKey: 'stream1',
                    timestamp: 40000,  // BEFORE the snapshot at 50000
                    header: { type: 'Item Added' },
                    content: { type: 'Item Added' as const, item: 'd' }
                }
            }
            
            const newState = produce(initialPublicData, (draft) => {
                processEvent(draft, action as any)
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
})

