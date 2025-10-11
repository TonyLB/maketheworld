import { describe, it, expect } from 'vitest'
import { createDataSourceSlice, DataSourceSliceConfig } from './index'
import { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Test types
type TestSnapshot = {
    type: 'Snapshot Generated'
    value: number
}

type TestUpdate = {
    type: 'Increment' | 'Decrement'
}

type TestEvent = TestSnapshot | TestUpdate

// Type guards
const isTestSnapshot = (event: TestEvent): event is TestSnapshot => event.type === 'Snapshot Generated'
const isTestUpdate = (event: TestEvent): event is TestUpdate => event.type === 'Increment' || event.type === 'Decrement'

// Mock aggregator
const mockAggregator: DataSourceAggregator<TestSnapshot, TestUpdate> = {
    createEmpty: () => ({ type: 'Snapshot Generated', value: 0 }),
    applyUpdate: (snapshot, update) => {
        if (update.type === 'Increment') {
            return {
                success: true,
                snapshot: { type: 'Snapshot Generated', value: snapshot.value + 1 }
            }
        } else if (update.type === 'Decrement') {
            return {
                success: true,
                snapshot: { type: 'Snapshot Generated', value: snapshot.value - 1 }
            }
        }
        return {
            success: false,
            error: new Error('Unknown update type'),
            snapshot
        }
    }
}

// Mock serializer
const mockSerializer: DataSourceEventSerializer<TestUpdate, any, TestSnapshot, any> = {
    serialize: (params) => params.update as any,
    deserialize: (params) => params.externalUpdate,
    serializeSnapshot: (snapshot) => snapshot,
    deserializeSnapshot: (externalSnapshot) => externalSnapshot
}

describe('dataSource slice', () => {
    
    describe('createDataSourceSlice', () => {
        it('should create a valid slice with correct structure', () => {
            const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                name: 'testDataSource',
                dataSourceKey: 'test.dataSource',
                aggregator: mockAggregator,
                eventSerializer: mockSerializer,
                isSnapshot: isTestSnapshot,
                isUpdate: isTestUpdate,
                sliceSelector: (state) => state.testDataSource
            }
            
            const { slice, selectors, publicActions } = createDataSourceSlice(config)
            
            // Check slice properties
            expect(slice.name).toBe('testDataSource')
            expect(slice.reducer).toBeDefined()
            expect(slice.actions).toBeDefined()
            
            // Check public actions exist
            expect(publicActions.processRawSnapshot).toBeDefined()
            expect(publicActions.processRawEvent).toBeDefined()
            
            // Check selectors exist
            expect(selectors.getActiveStreamKeys).toBeDefined()
            expect(selectors.getSubscribedStreams).toBeDefined()
        })
        
        it('should have correct initial state', () => {
            const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                name: 'testDataSource',
                dataSourceKey: 'test.dataSource',
                aggregator: mockAggregator,
                eventSerializer: mockSerializer,
                isSnapshot: isTestSnapshot,
                isUpdate: isTestUpdate,
                sliceSelector: (state) => state.testDataSource
            }
            
            const { slice } = createDataSourceSlice(config)
            
            const initialState = slice.getInitialState()
            
            // Check initial state machine state
            expect(initialState.meta.currentState).toBe('INITIAL')
            
            // Check initial public data
            expect(initialState.publicData.activeStreamKeys).toEqual([])
            expect(initialState.publicData.subscribedStreams).toEqual({})
            
            // Check initial internal data
            expect(initialState.internalData.incrementalBackoff).toBe(0.5)
        })
        
        it('should create state machine actions', () => {
            const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                name: 'testDataSource',
                dataSourceKey: 'test.dataSource',
                aggregator: mockAggregator,
                eventSerializer: mockSerializer,
                isSnapshot: isTestSnapshot,
                isUpdate: isTestUpdate,
                sliceSelector: (state) => state.testDataSource
            }
            
            const { slice } = createDataSourceSlice(config)
            
            // Check state machine actions
            expect(slice.actions.setIntent).toBeDefined()
            expect(slice.actions.internalStateChange).toBeDefined()
        })
        
        it('should return subscription and unsubscription helpers', () => {
            const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                name: 'testDataSource',
                dataSourceKey: 'test.dataSource',
                aggregator: mockAggregator,
                eventSerializer: mockSerializer,
                isSnapshot: isTestSnapshot,
                isUpdate: isTestUpdate,
                sliceSelector: (state) => state.testDataSource
            }
            
            const result = createDataSourceSlice(config)
            
            // Check that all expected properties are returned
            expect(result.slice).toBeDefined()
            expect(result.selectors).toBeDefined()
            expect(result.publicActions).toBeDefined()
            expect(result.iterateAllSSMs).toBeDefined()
        })
        
        it('should accept custom promiseCache', () => {
            const customCache = {} as any  // Mock promise cache
            
            const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                name: 'testDataSource',
                dataSourceKey: 'test.dataSource',
                aggregator: mockAggregator,
                eventSerializer: mockSerializer,
                isSnapshot: isTestSnapshot,
                isUpdate: isTestUpdate,
                sliceSelector: (state) => state.testDataSource,
                promiseCache: customCache
            }
            
            const { slice } = createDataSourceSlice(config)
            
            // Should not throw and should create valid slice
            expect(slice).toBeDefined()
            expect(slice.reducer).toBeDefined()
        })
    })
})

