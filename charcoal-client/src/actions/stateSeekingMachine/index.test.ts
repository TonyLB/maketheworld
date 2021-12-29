import { mockFunction } from '../../lib/jestHelpers'
jest.mock('uuid', () => ({
    v4: jest.fn()
}))
import { v4 } from 'uuid'
jest.mock('./dijkstra')
import dijkstra from './dijkstra'
jest.mock('../../selectors/stateSeekingMachine')
import { getHeartbeat, getSSMState } from '../../selectors/stateSeekingMachine'

import { testKeys, TestData, TestTemplate, TestSSM } from './baseClasses'

import exportCollection, {
    STATE_SEEKING_MACHINE_REGISTER,
    STATE_SEEKING_EXTERNAL_CHANGE,
    STATE_SEEKING_MACHINE_HEARTBEAT,
    registerSSM,
    assertIntent,
    externalStateChange,
    iterateAllSSMs,
    STATE_SEEKING_ASSERT_DESIRE
} from './index'

const getHeartbeatMock = mockFunction(getHeartbeat)
const getSSMStateMock = mockFunction(getSSMState)
const uuidMock = mockFunction(v4)
const dijkstraMock = mockFunction(dijkstra)

describe('stateSeekingMachine', () => {
    const internalAction = jest.fn().mockResolvedValue({})
    const testTemplate = new TestTemplate()
    const internalCall = (testTemplate.states.CONNECTING as any).action
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        jest.useFakeTimers()
    })
    afterEach(() => {
        jest.useRealTimers()
    })
    describe('registerSSM', () => {
        it('should correctly dispatch', () => {
            const dispatch = jest.fn()
            const getState = jest.fn()
            getSSMStateMock.mockReturnValue(() => (null))
            registerSSM<testKeys>({ key: 'TEST', template: testTemplate })(dispatch, getState)
            expect(dispatch).toHaveBeenCalledWith({
                type: STATE_SEEKING_MACHINE_REGISTER,
                payload: {
                    key: 'TEST',
                    template: testTemplate
                }
            })
        })
    })
    describe('externalStateChange', () => {
        it('should dispatch without heartbeat when heartbeat matches current', () => {
            const dispatch = jest.fn()
            const getState = jest.fn()
            getHeartbeatMock.mockReturnValue('testHeartbeat')
            externalStateChange<testKeys>({ key: 'TEST', newState: 'CONNECTING', heartbeat: 'testHeartbeat' })(dispatch, getState)
            jest.runAllTimers()
            expect(dispatch).not.toHaveBeenCalledWith({
                type: STATE_SEEKING_MACHINE_HEARTBEAT,
                payload: 'testHeartbeat'
            })
            expect(dispatch).toHaveBeenCalledWith({
                type: STATE_SEEKING_EXTERNAL_CHANGE,
                payload: {
                    key: 'TEST',
                    newState: 'CONNECTING'
                }
            })
        })
        it('should dispatch with heartbeat when heartbeat has new value', () => {
            const dispatch = jest.fn()
            const getState = jest.fn()
            getHeartbeatMock.mockReturnValue('testHeartbeat')
            externalStateChange<testKeys>({ key: 'TEST', newState: 'CONNECTING', heartbeat: 'testNextHeartbeat' })(dispatch, getState)
            jest.runAllTimers()
            expect(dispatch).toHaveBeenCalledWith({
                type: STATE_SEEKING_MACHINE_HEARTBEAT,
                payload: 'testNextHeartbeat'
            })
            expect(dispatch).toHaveBeenCalledWith({
                type: STATE_SEEKING_EXTERNAL_CHANGE,
                payload: {
                    key: 'TEST',
                    newState: 'CONNECTING'
                }
            })
        })
        it('should dispatch with generated heartbeat when heartbeat is not passed', () => {
            const dispatch = jest.fn()
            const getState = jest.fn()
            getHeartbeatMock.mockReturnValue('testHeartbeat')
            uuidMock.mockReturnValue('testUUIDHeartbeat')
            externalStateChange<testKeys>({ key: 'TEST', newState: 'CONNECTING' })(dispatch, getState)
            jest.runAllTimers()
            expect(dispatch).toHaveBeenCalledWith({
                type: STATE_SEEKING_MACHINE_HEARTBEAT,
                payload: 'testUUIDHeartbeat'
            })
            expect(dispatch).toHaveBeenCalledWith({
                type: STATE_SEEKING_EXTERNAL_CHANGE,
                payload: {
                    key: 'TEST',
                    newState: 'CONNECTING'
                }
            })
        })
    })
    describe('assertIntent', () => {
        it('should dispatch without heartbeat when heartbeat matches current', () => {
            const dispatch = jest.fn()
            const getState = jest.fn()
            getHeartbeatMock.mockReturnValue('testHeartbeat')
            assertIntent<testKeys>({ key: 'TEST', newState: 'CONNECTING', heartbeat: 'testHeartbeat' })(dispatch, getState)
            expect(dispatch).not.toHaveBeenCalledWith({
                type: STATE_SEEKING_MACHINE_HEARTBEAT,
                payload: 'testHeartbeat'
            })
            expect(dispatch).toHaveBeenCalledWith({
                type: STATE_SEEKING_ASSERT_DESIRE,
                payload: {
                    key: 'TEST',
                    newState: 'CONNECTING'
                }
            })
        })
        it('should dispatch with heartbeat when heartbeat has new value', () => {
            const dispatch = jest.fn()
            const getState = jest.fn()
            getHeartbeatMock.mockReturnValue('testHeartbeat')
            assertIntent<testKeys>({ key: 'TEST', newState: 'CONNECTING', heartbeat: 'testNextHeartbeat' })(dispatch, getState)
            expect(dispatch).toHaveBeenCalledWith({
                type: STATE_SEEKING_MACHINE_HEARTBEAT,
                payload: 'testNextHeartbeat'
            })
            expect(dispatch).toHaveBeenCalledWith({
                type: STATE_SEEKING_ASSERT_DESIRE,
                payload: {
                    key: 'TEST',
                    newState: 'CONNECTING'
                }
            })
        })
        it('should dispatch with generated heartbeat when heartbeat is not passed', () => {
            const dispatch = jest.fn()
            const getState = jest.fn()
            getHeartbeatMock.mockReturnValue('testHeartbeat')
            uuidMock.mockReturnValue('testUUIDHeartbeat')
            assertIntent<testKeys>({ key: 'TEST', newState: 'CONNECTING' })(dispatch, getState)
            jest.runAllTimers()
            expect(dispatch).toHaveBeenCalledWith({
                type: STATE_SEEKING_MACHINE_HEARTBEAT,
                payload: 'testUUIDHeartbeat'
            })
            expect(dispatch).toHaveBeenCalledWith({
                type: STATE_SEEKING_ASSERT_DESIRE,
                payload: {
                    key: 'TEST',
                    newState: 'CONNECTING'
                }
            })
        })
    })
    describe('iterateOneSSM', () => {
        beforeEach(() => {
            internalCall.mockReturnValue(internalAction)
        })
        it('should dispatch nothing when state is already achieved', () => {
            const dispatch = jest.fn()
            const localTestSSM: TestSSM = {
                key: 'testSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'INITIAL',
                data: new TestData()
            };
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    localTestSSM
                }
            })
            return exportCollection.iterateOneSSM({ key: 'testSSM', heartbeat: 'testHeartbeat' })(dispatch, getState)
                .then(() => {
                    expect(dispatch).not.toHaveBeenCalled()
                })
        })
        it('should dispatch correctly when a first path item is defined', () => {
            const dispatch = jest.fn().mockReturnValueOnce({}).mockResolvedValueOnce({})
            const localTestSSM: TestSSM = {
                key: 'localTestSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'CONNECTED',
                data: new TestData()
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    machines: {
                        localTestSSM
                    }
                }
            })
            uuidMock.mockReturnValue('testUUIDHeartbeat')
            dijkstraMock.mockReturnValue(['CONNECTING'])
            const internalJest = jest.fn()
            jest.spyOn(exportCollection, 'internalStateChange').mockImplementation((payload) => internalJest)
            //
            // Set the iterateOneSSM dispatch to test its resolve function upon the return of the dispatch
            //
            return exportCollection.iterateOneSSM({ key: 'localTestSSM', heartbeat: 'testHeartbeat' })(dispatch, getState)
                .then(() => {
                    expect(exportCollection.internalStateChange).toHaveBeenCalledWith({
                        key: 'localTestSSM',
                        newState: 'CONNECTED',
                        heartbeat: 'testUUIDHeartbeat',
                        data: {}
                    })
                    expect(dispatch).toHaveBeenCalledWith(internalJest)
                    expect(internalCall).toHaveBeenCalledWith({ valOne: '', valTwo: '' })
                    expect(dispatch).toHaveBeenCalledWith(internalAction)
                })
        })
        it('should update data when the action returns data', () => {
            const dispatch = jest.fn().mockReturnValueOnce({}).mockResolvedValueOnce({ valTwo: '456' })
            const localTestSSM: TestSSM = {
                key: 'localTestSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'CONNECTED',
                data: {
                    valOne: '123',
                    valTwo: 'ABC'
                }
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    machines: {
                        localTestSSM
                    }
                }
            })
            uuidMock.mockReturnValue('testUUIDHeartbeat')
            dijkstraMock.mockReturnValue(['CONNECTING'])
            const internalJest = jest.fn()
            jest.spyOn(exportCollection, 'internalStateChange').mockImplementation((payload) => internalJest)
            //
            // Set the iterateOneSSM dispatch to test its resolve function upon the return of the dispatch
            //
            return exportCollection.iterateOneSSM({ key: 'localTestSSM', heartbeat: 'testHeartbeat' })(dispatch, getState)
                .then(() => {
                    expect(exportCollection.internalStateChange).toHaveBeenCalledWith({
                        key: 'localTestSSM',
                        newState: 'CONNECTED',
                        heartbeat: 'testUUIDHeartbeat',
                        data: {
                            valTwo: '456'
                        }
                    })
                    expect(dispatch).toHaveBeenCalledWith(internalJest)
                    expect(internalCall).toHaveBeenCalledWith({ valOne: '123', valTwo: 'ABC' })
                    expect(dispatch).toHaveBeenCalledWith(internalAction)
                })
        })
        it('should dispatch to reject status when an action throws an exception', () => {
            const dispatch = jest.fn().mockImplementation((value) => (value))
            const localTestSSM: TestSSM = {
                key: 'localTestSSM',
                template: testTemplate,
                currentState: 'CONNECTING',
                desiredState: 'CONNECTED',
                data: new TestData()
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    machines: {
                        localTestSSM
                    }
                }
            })
            uuidMock.mockReturnValue('testUUIDHeartbeat')
            dijkstraMock.mockReturnValue(['CONNECTING'])
            const internalJest = jest.fn().mockReturnValue('internalStateChange')
            jest.spyOn(exportCollection, 'internalStateChange').mockImplementation((payload) => internalJest)
            internalCall.mockClear().mockRejectedValueOnce({})
            //
            // Set the iterateOneSSM dispatch to test its resolve function upon the return of the dispatch
            //
            return exportCollection.iterateOneSSM({ key: 'localTestSSM', heartbeat: 'testHeartbeat' })(dispatch, getState)
                .then(() => {
                    expect(exportCollection.internalStateChange).toHaveBeenCalledWith({
                        data: {},
                        key: 'localTestSSM',
                        newState: 'INITIAL',
                        heartbeat: 'testUUIDHeartbeat'
                    })
                    expect(dispatch).toHaveBeenCalledWith(internalJest)
                    expect(internalCall).toHaveBeenCalledWith({ valOne: '', valTwo: '' })
                })
        })
        it('should dispatch nothing when no function path exists', () => {
            const dispatch = jest.fn()
            const localTestSSM: TestSSM = {
                key: 'localTestSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'CONNECTING',
                data: new TestData()
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    machines: {
                        localTestSSM
                    }
                }
            })
            dijkstraMock.mockReturnValue([])
            exportCollection.iterateOneSSM({ key: 'localTestSSM', heartbeat: 'testHeartbeat' })(dispatch, getState)
            expect(dispatch).not.toHaveBeenCalled()
        })
    })
    describe('iterateAllSSMs', () => {
        let iterateOneMock: any = null
        beforeEach(() => {
            iterateOneMock = (jest.spyOn(exportCollection, 'iterateOneSSM') as jest.SpyInstance).mockImplementation((payload) => {
                return { type: 'TEST_ITERATE_ONE', payload }
            })
        })
        afterEach(() => {
            iterateOneMock.mockRestore()
        })
        it('should dispatch nothing when all SSMs are in desired states', () => {
            const dispatch = jest.fn()
            const localTestSSM: TestSSM = {
                key: 'testSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'INITIAL',
                data: new TestData()
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    machines: {
                        testSSMOne: {
                            ...localTestSSM,
                            key: 'testSSMOne'
                        },
                        testSSMTwo: {
                            ...localTestSSM,
                            key: 'testSSMTwo'
                        }
                    }
                }
            })
            iterateAllSSMs(dispatch, getState)
            expect(dispatch).not.toHaveBeenCalled()
            iterateOneMock.mockRestore()
        })
        it('should dispatch an iterate for each SSM with a desired state change', () => {
            const dispatch = jest.fn()
            uuidMock.mockReturnValue('testUUIDHeartbeat')
            const localTestSSM: TestSSM = {
                key: 'testSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'CONNECTED',
                data: new TestData()
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    machines: {
                        testSSMOne: {
                            ...localTestSSM,
                            key: 'testSSMOne'
                        },
                        testSSMTwo: {
                            ...localTestSSM,
                            key: 'testSSMTwo'
                        }
                    }
                }
            })
            dijkstraMock.mockReturnValue(['CONNECTING'])
            iterateAllSSMs(dispatch, getState)
            expect(dispatch).toHaveBeenCalledWith({ type: 'TEST_ITERATE_ONE', payload: { key: 'testSSMOne', heartbeat: 'testUUIDHeartbeat' } })
            expect(dispatch).toHaveBeenCalledWith({ type: 'TEST_ITERATE_ONE', payload: { key: 'testSSMTwo', heartbeat: 'testUUIDHeartbeat' } })
        })
    })
})