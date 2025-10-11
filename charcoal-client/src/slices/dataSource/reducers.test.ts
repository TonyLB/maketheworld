import { describe, it, expect, beforeEach, vi } from 'vitest'
import { applyEvents, performCleanup, processRawSnapshot, processRawEvent } from './reducers'
import { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Test types
type TestSnapshot = {
    type: 'Snapshot Generated'
    items: string[]
}

type TestUpdate = {
    type: 'Item Added' | 'Item Removed'
    item: string
}

type TestEvent = TestSnapshot | TestUpdate

// Type guards
const isTestSnapshot = (event: TestEvent): event is TestSnapshot => event.type === 'Snapshot Generated'
const isTestUpdate = (event: TestEvent): event is TestUpdate => event.type === 'Item Added' || event.type === 'Item Removed'

// Mock aggregator
const mockAggregator: DataSourceAggregator<TestSnapshot, TestUpdate> = {
    createEmpty: () => ({ type: 'Snapshot Generated', items: [] }),
    applyUpdate: (snapshot, update) => {
        try {
            if (update.type === 'Item Added') {
                return {
                    success: true,
                    snapshot: {
                        type: 'Snapshot Generated',
                        items: [...snapshot.items, update.item]
                    }
                }
            } else if (update.type === 'Item Removed') {
                return {
                    success: true,
                    snapshot: {
                        type: 'Snapshot Generated',
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
    serialize: vi.fn((params) => params.update as any),
    deserialize: vi.fn((params) => params.externalUpdate),
    serializeSnapshot: vi.fn((snapshot) => snapshot),
    deserializeSnapshot: vi.fn((externalSnapshot) => externalSnapshot)
}

describe('dataSource reducers', () => {
    
    describe('applyEvents', () => {
        const applyEventsWithAggregator = applyEvents(mockAggregator)
        
        it('should apply multiple updates in order', () => {
            const baseline: TestSnapshot = { type: 'Snapshot Generated', items: ['a'] }
            const updates = [
                { event: { type: 'Item Added' as const, item: 'b' }, timestamp: 1000 },
                { event: { type: 'Item Added' as const, item: 'c' }, timestamp: 2000 }
            ]
            
            const result = applyEventsWithAggregator(baseline, updates)
            
            expect(result.items).toEqual(['a', 'b', 'c'])
        })
        
        it('should handle empty events array', () => {
            const baseline: TestSnapshot = { type: 'Snapshot Generated', items: ['a'] }
            const result = applyEventsWithAggregator(baseline, [])
            
            expect(result.items).toEqual(['a'])
        })
        
        it('should continue on aggregation failure', () => {
            const baseline: TestSnapshot = { type: 'Snapshot Generated', items: ['a'] }
            const updates = [
                { event: { type: 'Item Added' as const, item: 'b' }, timestamp: 1000 },
                { event: { type: 'Invalid' as any, item: 'bad' }, timestamp: 2000 },  // This will fail
                { event: { type: 'Item Added' as const, item: 'c' }, timestamp: 3000 }
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
                { event: { type: 'Snapshot Generated' as const, items: ['a'] }, timestamp: 50000 },
                { event: { type: 'Item Added' as const, item: 'b' }, timestamp: 60000 }
            ]
            
            const result = performCleanupWithConfig(recentEvents, 70000)
            
            // 30 seconds ago from 70000 is 40000, so all events are recent
            expect(result).toHaveLength(2)
            expect(result[0].event).toEqual({ type: 'Snapshot Generated', items: ['a'] })
            expect(result[1].event).toEqual({ type: 'Item Added', item: 'b' })
        })
        
        it('should consolidate old events into synthetic snapshot', () => {
            const recentEvents = [
                { event: { type: 'Snapshot Generated' as const, items: [] }, timestamp: 10000 },
                { event: { type: 'Item Added' as const, item: 'a' }, timestamp: 20000 },
                { event: { type: 'Item Added' as const, item: 'b' }, timestamp: 30000 },
                { event: { type: 'Item Added' as const, item: 'c' }, timestamp: 50000 }
            ]
            
            const result = performCleanupWithConfig(recentEvents, 60000)
            
            // 30 seconds ago from 60000 is 30000
            // Events at 10000, 20000, 30000 are old (<=30000)
            // Event at 50000 is recent (>30000)
            // Should consolidate old events into synthetic snapshot at 30000
            expect(result).toHaveLength(2)
            
            // First event should be synthetic snapshot at 30-second boundary
            expect(result[0].timestamp).toBe(30000)
            expect(result[0].event).toEqual({ type: 'Snapshot Generated', items: ['a', 'b'] })
            
            // Second event should be the recent event
            expect(result[1].timestamp).toBe(50000)
            expect(result[1].event).toEqual({ type: 'Item Added', item: 'c' })
        })
        
        it('should use createEmpty when no snapshot in old events', () => {
            const recentEvents = [
                { event: { type: 'Item Added' as const, item: 'a' }, timestamp: 10000 },
                { event: { type: 'Item Added' as const, item: 'b' }, timestamp: 20000 },
                { event: { type: 'Item Added' as const, item: 'c' }, timestamp: 50000 }
            ]
            
            const result = performCleanupWithConfig(recentEvents, 60000)
            
            // Should create empty baseline and consolidate old events
            expect(result).toHaveLength(2)
            expect(result[0].event).toEqual({ type: 'Snapshot Generated', items: ['a', 'b'] })
            expect(result[1].event).toEqual({ type: 'Item Added', item: 'c' })
        })
        
        it('should handle incoming timestamp as latest when greater than all events', () => {
            const recentEvents = [
                { event: { type: 'Snapshot Generated' as const, items: [] }, timestamp: 10000 }
            ]
            
            const result = performCleanupWithConfig(recentEvents, 100000)
            
            // 30 seconds ago from 100000 is 70000
            // Event at 10000 is old
            // Should consolidate to synthetic snapshot
            expect(result).toHaveLength(1)
            expect(result[0].timestamp).toBe(70000)
            expect(result[0].event).toEqual({ type: 'Snapshot Generated', items: [] })
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
            const state = {
                publicData: {
                    subscribedStreams: {
                        'stream1': {
                            materializedView: { type: 'Snapshot Generated' as const, items: ['old'] },
                            recentEvents: []
                        }
                    }
                }
            }
            
            const action = {
                payload: {
                    streamKey: 'stream1',
                    timestamp: 10000,
                    rawSnapshot: { type: 'Snapshot Generated' as const, items: ['new'] }
                }
            }
            
            const result = processSnapshot({})(state, action as any)
            
            expect(mockSerializer.deserializeSnapshot).toHaveBeenCalledWith({ type: 'Snapshot Generated', items: ['new'] })
            expect(result.publicData.subscribedStreams['stream1'].materializedView.items).toEqual(['new'])
            expect(result.publicData.subscribedStreams['stream1'].recentEvents).toHaveLength(1)
            expect(result.publicData.subscribedStreams['stream1'].recentEvents[0].event).toEqual({ type: 'Snapshot Generated', items: ['new'] })
        })
        
        it('should handle events that happened after snapshot', () => {
            const state = {
                publicData: {
                    subscribedStreams: {
                        'stream1': {
                            materializedView: { type: 'Snapshot Generated' as const, items: ['a'] },
                            recentEvents: [
                                { event: { type: 'Item Added' as const, item: 'b' }, timestamp: 20000 }
                            ]
                        }
                    }
                }
            }
            
            const action = {
                payload: {
                    streamKey: 'stream1',
                    timestamp: 15000,  // Snapshot comes BEFORE existing event
                    rawSnapshot: { type: 'Snapshot Generated' as const, items: ['x'] }
                }
            }
            
            const result = processSnapshot({})(state, action as any)
            
            // Should have snapshot + event after it
            expect(result.publicData.subscribedStreams['stream1'].recentEvents).toHaveLength(2)
            expect(result.publicData.subscribedStreams['stream1'].recentEvents[0].timestamp).toBe(15000)
            expect(result.publicData.subscribedStreams['stream1'].recentEvents[1].timestamp).toBe(20000)
            
            // Materialized view should be snapshot + event applied
            expect(result.publicData.subscribedStreams['stream1'].materializedView.items).toEqual(['x', 'b'])
        })
        
        it('should ignore events for unsubscribed streams', () => {
            const state = {
                publicData: {
                    subscribedStreams: {}
                }
            }
            
            const action = {
                payload: {
                    streamKey: 'nonexistent',
                    timestamp: 10000,
                    rawSnapshot: { type: 'Snapshot Generated' as const, items: ['a'] }
                }
            }
            
            const result = processSnapshot({})(state, action as any)
            
            expect(result).toBe(state)
            expect(mockSerializer.deserializeSnapshot).not.toHaveBeenCalled()
        })
        
        it('should handle deserialization failures gracefully', () => {
            const state = {
                publicData: {
                    subscribedStreams: {
                        'stream1': {
                            materializedView: { type: 'Snapshot Generated' as const, items: ['a'] },
                            recentEvents: []
                        }
                    }
                }
            }
            
            const action = {
                payload: {
                    streamKey: 'stream1',
                    timestamp: 10000,
                    rawSnapshot: { invalid: 'data' }
                }
            }
            
            // Mock deserialize to return null
            mockSerializer.deserializeSnapshot = vi.fn(() => null)
            
            const result = processSnapshot({})(state, action as any)
            
            // Should return unchanged state
            expect(result).toBe(state)
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
            mockSerializer.deserialize = vi.fn((params) => params.externalUpdate)
        })
        
        it('should process in-order event with fast path', () => {
            const state = {
                publicData: {
                    subscribedStreams: {
                        'stream1': {
                            materializedView: { type: 'Snapshot Generated' as const, items: ['a'] },
                            recentEvents: [
                                { event: { type: 'Item Added' as const, item: 'a' }, timestamp: 10000 }
                            ]
                        }
                    }
                }
            }
            
            const action = {
                payload: {
                    streamKey: 'stream1',
                    timestamp: 20000,  // After existing event
                    rawEvent: { type: 'Item Added' as const, item: 'b' }
                }
            }
            
            const result = processEvent({})(state, action as any)
            
            // Should use fast path
            expect(result.publicData.subscribedStreams['stream1'].materializedView.items).toEqual(['a', 'b'])
            expect(result.publicData.subscribedStreams['stream1'].recentEvents).toHaveLength(2)
            expect(result.publicData.subscribedStreams['stream1'].recentEvents[1].event).toEqual({ type: 'Item Added', item: 'b' })
        })
        
        it('should process out-of-order event with re-aggregation', () => {
            const state = {
                publicData: {
                    subscribedStreams: {
                        'stream1': {
                            materializedView: { type: 'Snapshot Generated' as const, items: ['a', 'c'] },
                            recentEvents: [
                                { event: { type: 'Snapshot Generated' as const, items: ['a'] }, timestamp: 10000 },
                                { event: { type: 'Item Added' as const, item: 'c' }, timestamp: 30000 }
                            ]
                        }
                    }
                }
            }
            
            const action = {
                payload: {
                    streamKey: 'stream1',
                    timestamp: 20000,  // BETWEEN snapshot and existing event
                    rawEvent: { type: 'Item Added' as const, item: 'b' }
                }
            }
            
            const result = processEvent({})(state, action as any)
            
            // Should re-aggregate in correct order: snapshot -> b (new) -> c (existing)
            expect(result.publicData.subscribedStreams['stream1'].materializedView.items).toEqual(['a', 'b', 'c'])
            
            // Recent events should be sorted by timestamp
            expect(result.publicData.subscribedStreams['stream1'].recentEvents).toHaveLength(3)
            expect(result.publicData.subscribedStreams['stream1'].recentEvents[0].timestamp).toBe(10000)  // Snapshot
            expect(result.publicData.subscribedStreams['stream1'].recentEvents[1].timestamp).toBe(20000)  // New event
            expect(result.publicData.subscribedStreams['stream1'].recentEvents[2].timestamp).toBe(30000)  // Existing event
        })
        
        it('should ignore events for unsubscribed streams', () => {
            const state = {
                publicData: {
                    subscribedStreams: {}
                }
            }
            
            const action = {
                payload: {
                    streamKey: 'nonexistent',
                    timestamp: 10000,
                    rawEvent: { type: 'Item Added' as const, item: 'a' }
                }
            }
            
            const result = processEvent({})(state, action as any)
            
            expect(result).toBe(state)
            expect(mockSerializer.deserialize).not.toHaveBeenCalled()
        })
        
        it('should handle deserialization failures gracefully', () => {
            const state = {
                publicData: {
                    subscribedStreams: {
                        'stream1': {
                            materializedView: { type: 'Snapshot Generated' as const, items: ['a'] },
                            recentEvents: []
                        }
                    }
                }
            }
            
            const action = {
                payload: {
                    streamKey: 'stream1',
                    timestamp: 10000,
                    rawEvent: { invalid: 'data' }
                }
            }
            
            // Mock deserialize to return null
            mockSerializer.deserialize = vi.fn(() => null)
            
            const result = processEvent({})(state, action as any)
            
            // Should return unchanged state
            expect(result).toBe(state)
        })
        
        it('should re-aggregate from createEmpty when no baseline snapshot', () => {
            const state = {
                publicData: {
                    subscribedStreams: {
                        'stream1': {
                            materializedView: { type: 'Snapshot Generated' as const, items: ['a', 'c'] },
                            recentEvents: [
                                { event: { type: 'Item Added' as const, item: 'a' }, timestamp: 20000 },
                                { event: { type: 'Item Added' as const, item: 'c' }, timestamp: 40000 }
                            ]
                        }
                    }
                }
            }
            
            const action = {
                payload: {
                    streamKey: 'stream1',
                    timestamp: 30000,  // Out of order
                    rawEvent: { type: 'Item Added' as const, item: 'b' }
                }
            }
            
            const result = processEvent({})(state, action as any)
            
            // Should re-aggregate from empty: a, b, c
            expect(result.publicData.subscribedStreams['stream1'].materializedView.items).toEqual(['a', 'b', 'c'])
        })
        
        it('should perform cleanup before processing events', () => {
            const state = {
                publicData: {
                    subscribedStreams: {
                        'stream1': {
                            materializedView: { type: 'Snapshot Generated' as const, items: ['a', 'b'] },
                            recentEvents: [
                                { event: { type: 'Snapshot Generated' as const, items: [] }, timestamp: 10000 },
                                { event: { type: 'Item Added' as const, item: 'a' }, timestamp: 20000 },
                                { event: { type: 'Item Added' as const, item: 'b' }, timestamp: 30000 }
                            ]
                        }
                    }
                }
            }
            
            const action = {
                payload: {
                    streamKey: 'stream1',
                    timestamp: 70000,  // Much later
                    rawEvent: { type: 'Item Added' as const, item: 'c' }
                }
            }
            
            const result = processEvent({})(state, action as any)
            
            // Old events should have been cleaned up
            // 30 seconds ago from 70000 is 40000, so all events (10000, 20000, 30000) are old
            // Should have synthetic snapshot + new event
            expect(result.publicData.subscribedStreams['stream1'].recentEvents.length).toBeLessThan(4)
            
            // Materialized view should still have all items
            expect(result.publicData.subscribedStreams['stream1'].materializedView.items).toEqual(['a', 'b', 'c'])
        })
        
        it('should ignore update events with timestamp earlier than most recent snapshot', () => {
            const state = {
                publicData: {
                    subscribedStreams: {
                        'stream1': {
                            materializedView: { type: 'Snapshot Generated' as const, items: ['a', 'b', 'c'] },
                            recentEvents: [
                                { event: { type: 'Snapshot Generated' as const, items: ['a', 'b', 'c'] }, timestamp: 50000 }
                            ]
                        }
                    }
                }
            }
            
            const action = {
                payload: {
                    streamKey: 'stream1',
                    timestamp: 40000,  // BEFORE the snapshot at 50000
                    rawEvent: { type: 'Item Added' as const, item: 'd' }
                }
            }
            
            const result = processEvent({})(state, action as any)
            
            // The event timestamp (40000) is before the most recent snapshot (50000)
            // The re-aggregation logic finds baseline snapshot at 50000
            // It collects events AFTER 50000 (none) + incoming event (40000)
            // After sorting: [event@40000]
            // It filters for UPDATE events to apply: [event@40000]
            // But these are NOT applied because they're before the baseline!
            // The newRecentEvents includes: [snapshot@50000, ...sortedEvents]
            
            // Recent events should have snapshot + the old event (even though it's before snapshot)
            expect(result.publicData.subscribedStreams['stream1'].recentEvents).toHaveLength(2)
            expect(result.publicData.subscribedStreams['stream1'].recentEvents[0].timestamp).toBe(50000)  // Snapshot first
            expect(result.publicData.subscribedStreams['stream1'].recentEvents[1].timestamp).toBe(40000)  // Old event (not applied)
            
            // Materialized view should be unchanged - only events AFTER snapshot are applied
            // The old event is NOT applied to the materialized view
            expect(result.publicData.subscribedStreams['stream1'].materializedView.items).toEqual(['a', 'b', 'c'])
        })
    })
})

