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
    serialize: (params) => params.content as any,
    deserialize: async (params) => params.content
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

            it('when Snapshot is passed, passes raw content to deserialize and dispatches with serializer result', async () => {
                const resolvedSnapshot = { type: 'Snapshot' as const, value: 99 }
                const deserialize = vi.fn().mockResolvedValue(resolvedSnapshot)
                const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: { ...mockSerializer, deserialize },
                    sliceSelector: (state) => state.testDataSource
                }
                createDataSourceSlice(config)
                expect(capturedProcessRawEnvelope).toBeDefined()
                const rawContent = { type: 'Snapshot' as const, sidecarUrl: 'https://example.com/sidecar', createdAt: 500 }
                const dispatch = vi.fn()
                const result = capturedProcessRawEnvelope!({
                    streamKey: 'stream1',
                    timestamp: 1000,
                    header: { type: 'Snapshot' },
                    content: rawContent
                })
                expect(typeof result).toBe('function')
                await (result as (d: any) => Promise<void>)(dispatch)
                expect(deserialize).toHaveBeenCalledWith(expect.objectContaining({
                    content: rawContent,
                    header: expect.objectContaining({ type: 'Snapshot', dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 1000 })
                }))
                expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
                    payload: expect.objectContaining({
                        streamKey: 'stream1',
                        timestamp: 1000,
                        header: { type: 'Snapshot' },
                        content: resolvedSnapshot
                    })
                }))
            })

            it('when inline payload is passed, returns async thunk that awaits deserialize and dispatches resolved content', async () => {
                const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: mockSerializer,
                    sliceSelector: (state) => state.testDataSource
                }
                createDataSourceSlice(config)
                expect(capturedProcessRawEnvelope).toBeDefined()
                const inlinePayload = { streamKey: 'stream1', timestamp: 1000, header: { type: 'Increment' }, content: { type: 'Increment' as const } }
                const dispatch = vi.fn()
                const result = capturedProcessRawEnvelope!(inlinePayload)
                expect(typeof result).toBe('function')
                await (result as (d: any) => Promise<void>)(dispatch)
                expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
                    payload: expect.objectContaining({
                        streamKey: 'stream1',
                        timestamp: 1000,
                        header: { type: 'Increment' },
                        content: { type: 'Increment' }
                    })
                }))
            })

            it('when inline event is passed, thunk calls deserialize with correct params', async () => {
                const deserialize = vi.fn((params: any) => params.content)
                const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: { ...mockSerializer, deserialize },
                    sliceSelector: (state) => state.testDataSource
                }
                createDataSourceSlice(config)
                expect(capturedProcessRawEnvelope).toBeDefined()
                const externalContent = { type: 'Increment' as const }
                const payload = { streamKey: 'stream1', timestamp: 1000, header: { type: 'Increment' }, content: externalContent }
                const dispatch = vi.fn()
                const result = capturedProcessRawEnvelope!(payload)
                await (result as (d: any) => Promise<void>)(dispatch)
                expect(deserialize).toHaveBeenCalledWith(expect.objectContaining({
                    content: externalContent,
                    header: expect.objectContaining({ type: 'Increment', dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 1000 })
                }))
            })

            it('when inline snapshot is passed, thunk calls deserialize with correct params', async () => {
                const deserialize = vi.fn((params: any) => params.content)
                const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: { ...mockSerializer, deserialize },
                    sliceSelector: (state) => state.testDataSource
                }
                createDataSourceSlice(config)
                expect(capturedProcessRawEnvelope).toBeDefined()
                const externalSnapshot = { type: 'Snapshot' as const, value: 42 }
                const payload = { streamKey: 'stream1', timestamp: 1000, header: { type: 'Snapshot' }, content: externalSnapshot }
                const dispatch = vi.fn()
                const result = capturedProcessRawEnvelope!(payload)
                await (result as (d: any) => Promise<void>)(dispatch)
                expect(deserialize).toHaveBeenCalledWith(expect.objectContaining({
                    content: externalSnapshot,
                    header: expect.objectContaining({ type: 'Snapshot', dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 1000 })
                }))
            })

            it('when deserialize returns null, thunk does not dispatch', async () => {
                const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: { ...mockSerializer, deserialize: () => null },
                    sliceSelector: (state) => state.testDataSource
                }
                createDataSourceSlice(config)
                expect(capturedProcessRawEnvelope).toBeDefined()
                const dispatch = vi.fn()
                const result = capturedProcessRawEnvelope!({
                    streamKey: 'stream1',
                    timestamp: 1000,
                    header: { type: 'Increment' },
                    content: { type: 'Increment' as const }
                })
                await (result as (d: any) => Promise<void>)(dispatch)
                expect(dispatch).not.toHaveBeenCalled()
            })

            it('when deserialize returns null for Snapshot, thunk does not dispatch', async () => {
                const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: { ...mockSerializer, deserialize: async () => null },
                    sliceSelector: (state) => state.testDataSource
                }
                createDataSourceSlice(config)
                expect(capturedProcessRawEnvelope).toBeDefined()
                const dispatch = vi.fn()
                const result = capturedProcessRawEnvelope!({
                    streamKey: 'stream1',
                    timestamp: 1000,
                    header: { type: 'Snapshot' },
                    content: { type: 'Snapshot' as const, value: 1 }
                })
                await (result as (d: any) => Promise<void>)(dispatch)
                expect(dispatch).not.toHaveBeenCalled()
            })

            it('when Snapshot content is passed and deserialize returns null, thunk does not dispatch', async () => {
                const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: { ...mockSerializer, deserialize: async () => null },
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
                expect(typeof result).toBe('function')
                await (result as (d: any) => Promise<void>)(dispatch)
                expect(dispatch).not.toHaveBeenCalled()
            })
        })
    })
})

