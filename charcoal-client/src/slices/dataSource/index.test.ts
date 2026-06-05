import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { createDataSourceSlice, DataSourceSliceConfig } from './index'
import { createSubscribeAction } from './index.api'
import { StreamEventPubSub, type StreamEventDeserializedPayload } from './streamEventPubSub'
import { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

const { socketDispatchPromiseMock } = vi.hoisted(() => ({
    socketDispatchPromiseMock: vi.fn()
}))

vi.mock('../lifeLine', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lifeLine')>()
    return {
        ...actual,
        getStatus: vi.fn(() => 'CONNECTED'),
        socketDispatchPromise: socketDispatchPromiseMock
    }
})

// Capture args passed to createInitializeAction
let capturedProcessEnvelope: ((payload: StreamEventDeserializedPayload) => any) | null = null
let capturedAfterProcessEnvelope: ((dispatch: any, getState: any, payload: StreamEventDeserializedPayload) => void) | undefined
vi.mock('./index.api', async (importOriginal) => {
    const mod = await importOriginal<typeof import('./index.api')>()
    return {
        ...mod,
        createInitializeAction: (...args: any[]) => {
            capturedProcessEnvelope = args[1]
            capturedAfterProcessEnvelope = args[4]
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
    createEmpty: (_streamKey) => ({ type: 'Snapshot', value: 0 }),
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

const baseSliceConfig = (): DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> => ({
    name: 'testDataSource',
    dataSourceKey: 'test.dataSource',
    aggregator: mockAggregator,
    eventSerializer: mockSerializer,
    sliceSelector: (state) => state.testDataSource
})

const buildIncrementPayload = (overrides?: Partial<StreamEventDeserializedPayload>): StreamEventDeserializedPayload => ({
    dataSourceKey: 'test.dataSource',
    streamKey: 'stream1',
    timestamp: 1000,
    header: {
        dataSourceKey: 'test.dataSource',
        streamKey: 'stream1',
        timestamp: 1000,
        type: 'Increment'
    },
    content: { type: 'Increment' as const },
    ...overrides
})

async function setupStoreWithStreamSubscriber(options: {
    afterProcessEnvelope?: (dispatch: any, getState: any, payload: StreamEventDeserializedPayload) => void
    requestIdTracking?: { headerField: 'RequestIds' }
}) {
    const sliceSelector = (state: any) => state.testDataSource
    const result = createDataSourceSlice({
        ...baseSliceConfig(),
        sliceSelector,
        ...options
    })
    const initial = result.slice.getInitialState()
    const store = configureStore({
        reducer: { testDataSource: result.slice.reducer },
        preloadedState: {
            testDataSource: {
                ...initial,
                publicData: {
                    activeStreamKeys: ['stream1'],
                    subscribedStreams: {
                        stream1: {
                            materializedView: { type: 'Snapshot', value: 0 },
                            recentEvents: [],
                            ...(options.requestIdTracking ? { confirmedRequestIds: [] as const } : {})
                        }
                    }
                }
            }
        }
    })
    const { createInitializeAction } = await vi.importActual<typeof import('./index.api')>('./index.api')
    const initThunk = createInitializeAction(
        'test.dataSource',
        result.publicActions.processEnvelope,
        undefined,
        sliceSelector,
        options.afterProcessEnvelope
    )
    await store.dispatch(initThunk({
        internalData: initial.internalData,
        publicData: store.getState().testDataSource.publicData
    }) as any)
    return { store, result, sliceSelector }
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
            expect(publicActions.processEnvelope).toBeDefined()
            
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

        describe('requestIdTracking', () => {
            beforeEach(() => {
                vi.clearAllMocks()
                socketDispatchPromiseMock.mockReturnValue((() => Promise.resolve({})) as any)
            })

            it('exports getConfirmedRequestIds when requestIdTracking is enabled', () => {
                const result = createDataSourceSlice({
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: mockSerializer,
                    sliceSelector: (state) => state.testDataSource,
                    requestIdTracking: { headerField: 'RequestIds' }
                })

                expect(result.getConfirmedRequestIds).toBeDefined()
                expect(typeof result.getConfirmedRequestIds).toBe('function')
            })

            it('does not export getConfirmedRequestIds when requestIdTracking is disabled', () => {
                const result = createDataSourceSlice({
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: mockSerializer,
                    sliceSelector: (state) => state.testDataSource
                })

                expect(result.getConfirmedRequestIds).toBeUndefined()
            })

            it('initializes confirmedRequestIds on subscribe when tracking is enabled', async () => {
                const subscribeAction = createSubscribeAction(
                    'test.dataSource',
                    (streamKey) => mockAggregator.createEmpty(streamKey),
                    { headerField: 'RequestIds' }
                )

                const action = subscribeAction({
                    internalData: {
                        incrementalBackoff: 0.5,
                        subscribeStreamKeys: ['newStream'],
                        unsubscribeStreamKeys: [],
                        streamEventSubscription: 'sub-1'
                    },
                    publicData: {
                        activeStreamKeys: [],
                        subscribedStreams: {}
                    }
                })

                const dispatch = vi.fn((thunk: any) => (
                    typeof thunk === 'function' ? thunk(dispatch, vi.fn()) : thunk
                ))

                const result = await action(dispatch, vi.fn())

                expect(result.publicData.subscribedStreams.newStream).toEqual({
                    materializedView: { type: 'Snapshot', value: 0 },
                    recentEvents: [],
                    confirmedRequestIds: []
                })
            })
        })

        describe('afterProcessEnvelope', () => {
            beforeEach(() => {
                capturedProcessEnvelope = null
                capturedAfterProcessEnvelope = undefined
            })

            it('passes afterProcessEnvelope to createInitializeAction when configured', () => {
                const afterSpy = vi.fn()
                createDataSourceSlice({
                    ...baseSliceConfig(),
                    afterProcessEnvelope: afterSpy
                })
                expect(capturedAfterProcessEnvelope).toBe(afterSpy)
            })

            it('passes undefined when afterProcessEnvelope is omitted', () => {
                createDataSourceSlice(baseSliceConfig())
                expect(capturedAfterProcessEnvelope).toBeUndefined()
            })

            it('invokes callback after processEnvelope when configured', async () => {
                const afterSpy = vi.fn()
                const payload = buildIncrementPayload()
                const { store } = await setupStoreWithStreamSubscriber({ afterProcessEnvelope: afterSpy })

                StreamEventPubSub.publish(payload)

                expect(afterSpy).toHaveBeenCalledTimes(1)
                expect(afterSpy).toHaveBeenCalledWith(
                    expect.any(Function),
                    expect.any(Function),
                    payload
                )
                expect(afterSpy.mock.calls[0][1]()).toEqual(store.getState())
            })

            it('does not invoke callback when afterProcessEnvelope is omitted', async () => {
                const afterSpy = vi.fn()
                await setupStoreWithStreamSubscriber({})

                StreamEventPubSub.publish(buildIncrementPayload())

                expect(afterSpy).not.toHaveBeenCalled()
            })

            it('getState inside callback sees reducer commit after processEnvelope', async () => {
                const payload = buildIncrementPayload({
                    timestamp: 2000,
                    header: {
                        dataSourceKey: 'test.dataSource',
                        streamKey: 'stream1',
                        timestamp: 2000,
                        type: 'Increment',
                        RequestIds: ['req-A']
                    }
                })
                let confirmedAtCallback: string[] = []
                let sliceResult!: ReturnType<typeof createDataSourceSlice<TestSnapshot, TestUpdate>>
                const { store, result } = await setupStoreWithStreamSubscriber({
                    requestIdTracking: { headerField: 'RequestIds' },
                    afterProcessEnvelope: (dispatch, getState, envelope) => {
                        confirmedAtCallback = sliceResult.getConfirmedRequestIds!(getState(), envelope.streamKey)
                    }
                })
                sliceResult = result

                StreamEventPubSub.publish(payload)

                expect(confirmedAtCallback).toEqual(['req-A'])
                expect(result.getConfirmedRequestIds!(store.getState(), 'stream1')).toEqual(['req-A'])
                expect(store.getState().testDataSource.publicData.subscribedStreams.stream1.materializedView).toEqual({
                    type: 'Snapshot',
                    value: 1
                })
            })
        })

        describe('processEnvelope action creator', () => {
            beforeEach(() => {
                capturedProcessEnvelope = null
                capturedAfterProcessEnvelope = undefined
            })

            it('when Snapshot is passed, returns action object with correct payload', () => {
                const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: mockSerializer,
                    sliceSelector: (state) => state.testDataSource
                }
                createDataSourceSlice(config)
                expect(capturedProcessEnvelope).toBeDefined()
                const resolvedSnapshot = { type: 'Snapshot' as const, value: 99 }
                const payload: StreamEventDeserializedPayload = {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 1000,
                    header: { dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 1000, type: 'Snapshot' },
                    content: resolvedSnapshot
                }
                const action = capturedProcessEnvelope!(payload)
                expect(action).toHaveProperty('type')
                expect(action).toHaveProperty('payload')
                expect(action.payload).toEqual(payload)
            })

            it('when inline event is passed, returns action object with correct payload', () => {
                const config: DataSourceSliceConfig<TestSnapshot, TestUpdate, any, any> = {
                    name: 'testDataSource',
                    dataSourceKey: 'test.dataSource',
                    aggregator: mockAggregator,
                    eventSerializer: mockSerializer,
                    sliceSelector: (state) => state.testDataSource
                }
                createDataSourceSlice(config)
                expect(capturedProcessEnvelope).toBeDefined()
                const inlinePayload: StreamEventDeserializedPayload = {
                    dataSourceKey: 'test.dataSource',
                    streamKey: 'stream1',
                    timestamp: 1000,
                    header: { dataSourceKey: 'test.dataSource', streamKey: 'stream1', timestamp: 1000, type: 'Increment' },
                    content: { type: 'Increment' as const }
                }
                const action = capturedProcessEnvelope!(inlinePayload)
                expect(action).toHaveProperty('type')
                expect(action.payload).toEqual(inlinePayload)
            })
        })
    })
})

