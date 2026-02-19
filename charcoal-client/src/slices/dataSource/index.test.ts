import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDataSourceSlice, DataSourceSliceConfig } from './index'
import type { ClientSnapshotMessagePayload } from './baseClasses'
import { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Capture the processRawEnvelope (wrapper) passed to createInitializeAction for sidecar tests
let capturedProcessRawEnvelope: ((payload: ClientSnapshotMessagePayload<any>) => any) | null = null
vi.mock('./index.api', async (importOriginal) => {
    const mod = await importOriginal<typeof import('./index.api')>()
    return {
        ...mod,
        createInitializeAction: (...args: any[]) => {
            capturedProcessRawEnvelope = args[1]
            return (mod.createInitializeAction as (...a: any[]) => any)(...args)
        }
    }
})

// Test types
type TestSnapshot = {
    type: 'Snapshot'
    value: number
}

type TestUpdate = {
    type: 'Increment' | 'Decrement'
}

type TestEvent = TestSnapshot | TestUpdate

// Mock aggregator
const mockAggregator: DataSourceAggregator<TestSnapshot, TestUpdate> = {
    createEmpty: () => ({ type: 'Snapshot', value: 0 }),
    applyUpdate: (snapshot, envelope) => {
        if (envelope.header.type === 'Increment') {
            return {
                success: true,
                snapshot: { type: 'Snapshot', value: snapshot.value + 1 }
            }
        } else if (envelope.header.type === 'Decrement') {
            return {
                success: true,
                snapshot: { type: 'Snapshot', value: snapshot.value - 1 }
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
                sliceSelector: (state) => state.testDataSource
            }
            
            const { slice, selectors, publicActions } = createDataSourceSlice(config)
            
            // Check slice properties
            expect(slice.name).toBe('testDataSource')
            expect(slice.reducer).toBeDefined()
            expect(slice.actions).toBeDefined()
            
            // Check public actions exist
            expect(publicActions.processRawEnvelope).toBeDefined()
            
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
            expect(initialState.internalData.subscribeStreamKeys).toEqual([])
            expect(initialState.internalData.unsubscribeStreamKeys).toEqual([])
        })
        
        it('should create state machine actions', () => {
            const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                name: 'testDataSource',
                dataSourceKey: 'test.dataSource',
                aggregator: mockAggregator,
                eventSerializer: mockSerializer,
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
                sliceSelector: (state) => state.testDataSource
            }
            
            const result = createDataSourceSlice(config)
            
            // Check that all expected properties are returned
            expect(result.slice).toBeDefined()
            expect(result.selectors).toBeDefined()
            expect(result.publicActions).toBeDefined()
            expect(result.iterateAllSSMs).toBeDefined()
            
            // Check that subscription helper functions are returned
            expect(result.subscribeToStreams).toBeDefined()
            expect(typeof result.subscribeToStreams).toBe('function')
            expect(result.unsubscribeFromStreams).toBeDefined()
            expect(typeof result.unsubscribeFromStreams).toBe('function')
        })
        
        it('should accept custom promiseCache', () => {
            const customCache = {} as any  // Mock promise cache
            
            const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                name: 'testDataSource',
                dataSourceKey: 'test.dataSource',
                aggregator: mockAggregator,
                eventSerializer: mockSerializer,
                sliceSelector: (state) => state.testDataSource,
                promiseCache: customCache
            }
            
            const { slice } = createDataSourceSlice(config)
            
            // Should not throw and should create valid slice
            expect(slice).toBeDefined()
            expect(slice.reducer).toBeDefined()
        })

        describe('sidecar snapshot', () => {
            beforeEach(() => {
                capturedProcessRawEnvelope = null
            })

            it('when resolveSidecarSnapshot is configured, invokes resolver and dispatches processRawEnvelope with resolved payload and same timestamp', async () => {
                const resolvedSnapshot = { type: 'Snapshot' as const, value: 99 }
                const resolveSidecarSnapshot = vi.fn().mockResolvedValue(resolvedSnapshot)
                const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: mockSerializer,
                    sliceSelector: (state) => state.testDataSource,
                    resolveSidecarSnapshot
                }
                createDataSourceSlice(config)
                expect(capturedProcessRawEnvelope).toBeDefined()
                const streamKey = 'stream1'
                const timestamp = 1000
                const rawSnapshot = { type: 'Snapshot' as const, sidecarUrl: 'https://example.com/sidecar', createdAt: 500 }
                const dispatch = vi.fn()
                const result = capturedProcessRawEnvelope!({
                    streamKey,
                    timestamp,
                    header: { type: 'Snapshot' },
                    content: rawSnapshot
                })
                expect(typeof result).toBe('function')
                await (result as (d: any) => Promise<void>)(dispatch)
                expect(resolveSidecarSnapshot).toHaveBeenCalledWith(streamKey, 'https://example.com/sidecar', rawSnapshot)
                expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
                    payload: { streamKey, timestamp, header: { type: 'Snapshot' }, content: resolvedSnapshot }
                }))
            })

            it('when sidecarUrl is present but resolveSidecarSnapshot is not configured, does not dispatch processRawEnvelope', () => {
                const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: mockSerializer,
                    sliceSelector: (state) => state.testDataSource
                }
                createDataSourceSlice(config)
                expect(capturedProcessRawEnvelope).toBeDefined()
                const dispatch = vi.fn()
                const result = capturedProcessRawEnvelope!({
                    streamKey: 'stream1',
                    timestamp: 1000,
                    header: { type: 'Snapshot' },
                    content: { type: 'Snapshot' as const, sidecarUrl: 'https://example.com/sidecar' }
                })
                expect(result).toBeUndefined()
                expect(dispatch).not.toHaveBeenCalled()
            })
        })
    })
})

