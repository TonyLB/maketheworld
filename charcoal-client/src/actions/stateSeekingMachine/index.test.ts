import { mockFunction } from '../../lib/jestHelpers'
jest.mock('uuid', () => ({
    v4: jest.fn()
}))
import { v4 } from 'uuid'
import dijkstra from './dijkstra'
jest.mock('./dijkstra')
import { getHeartbeat } from '../../selectors/stateSeekingMachine'
jest.mock('../../selectors/stateSeekingMachine')

import exportCollection, {
    ISSMTemplate,
    IStateSeekingMachine,
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
const uuidMock = mockFunction(v4)
const dijkstraMock = mockFunction(dijkstra)

type testKeys = 'INITIAL' | 'CONNECTING' | 'CONNECTED'

describe('stateSeekingMachine', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    const internalCall = jest.fn()
    const testTemplate: ISSMTemplate<testKeys> = {
        initialState: 'INITIAL',
        states: {
            INITIAL: {
                stateType: 'CHOICE',
                key: 'INITIAL',
                choices: []
            },
            CONNECTING: {
                stateType: 'ATTEMPT',
                key: 'CONNECTING',
                action: internalCall,
                resolve: 'CONNECTED',
                reject: 'INITIAL'
            },
            CONNECTED: {
                stateType: 'CHOICE',
                key: 'CONNECTED',
                choices: []
            }
        }
    }
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })
    describe('registerSSM', () => {
        it('should correctly dispatch', () => {
            expect(registerSSM<testKeys>({ key: 'TEST', template: testTemplate })).toEqual({
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
        it('should dispatch nothing when state is already achieved', () => {
            const dispatch = jest.fn()
            const testSSM: IStateSeekingMachine<testKeys> = {
                key: 'testSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'INITIAL'
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    testSSM
                }
            })
            exportCollection.iterateOneSSM({ key: 'testSSM', heartbeat: 'testHeartbeat' })(dispatch, getState)
            expect(dispatch).not.toHaveBeenCalled()
        })
        it('should dispatch correctly when a first path item is defined', () => {
            const dispatch = jest.fn().mockReturnValueOnce({}).mockResolvedValueOnce({})
            const testSSM: IStateSeekingMachine<testKeys> = {
                key: 'testSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'CONNECTED'
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    machines: {
                        testSSM
                    }
                }
            })
            uuidMock.mockReturnValue('testUUIDHeartbeat')
            dijkstraMock.mockReturnValue(['CONNECTING'])
            const externalJest = jest.fn()
            jest.spyOn(exportCollection, 'externalStateChange').mockImplementation((payload) => externalJest)
            //
            // Set the iterateOneSSM dispatch to test its resolve function upon the return of the dispatch
            //
            exportCollection.iterateOneSSM({ key: 'testSSM', heartbeat: 'testHeartbeat' })(dispatch, getState)
                .then(() => {
                    expect(exportCollection.externalStateChange).toHaveBeenCalledWith({
                        key: 'testSSM',
                        newState: 'CONNECTED',
                        heartbeat: 'testUUIDHeartbeat'
                    })
                })
            expect(dispatch).toHaveBeenCalledWith(externalJest)
            expect(exportCollection.externalStateChange).toHaveBeenCalledWith({
                key: 'testSSM',
                newState: 'CONNECTING',
                heartbeat: 'testHeartbeat'
            })
            expect(dispatch).toHaveBeenCalledWith(internalCall)
        })
        it('should dispatch to reject status when an action throws an exception', () => {
            const dispatch = jest.fn().mockReturnValueOnce({}).mockRejectedValueOnce({})
            const testSSM: IStateSeekingMachine<testKeys> = {
                key: 'testSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'CONNECTED'
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    machines: {
                        testSSM
                    }
                }
            })
            uuidMock.mockReturnValue('testUUIDHeartbeat')
            dijkstraMock.mockReturnValue(['CONNECTING'])
            const externalJest = jest.fn()
            jest.spyOn(exportCollection, 'externalStateChange').mockImplementation((payload) => externalJest)
            //
            // Set the iterateOneSSM dispatch to test its resolve function upon the return of the dispatch
            //
            exportCollection.iterateOneSSM({ key: 'testSSM', heartbeat: 'testHeartbeat' })(dispatch, getState)
                .then(() => {
                    expect(exportCollection.externalStateChange).toHaveBeenCalledWith({
                        key: 'testSSM',
                        newState: 'INITIAL',
                        heartbeat: 'testUUIDHeartbeat'
                    })
                })
            expect(dispatch).toHaveBeenCalledWith(externalJest)
            expect(exportCollection.externalStateChange).toHaveBeenCalledWith({
                key: 'testSSM',
                newState: 'CONNECTING',
                heartbeat: 'testHeartbeat'
            })
            expect(dispatch).toHaveBeenCalledWith(internalCall)
        })
        it('should dispatch nothing when no function path exists', () => {
            const dispatch = jest.fn()
            const testSSM: IStateSeekingMachine<testKeys> = {
                key: 'testSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'CONNECTING'
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    machines: {
                        testSSM
                    }
                }
            })
            dijkstraMock.mockReturnValue([])
            exportCollection.iterateOneSSM({ key: 'testSSM', heartbeat: 'testHeartbeat' })(dispatch, getState)
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
            const testSSM: IStateSeekingMachine<testKeys> = {
                key: 'testSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'INITIAL'
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    machines: {
                        testSSMOne: {
                            ...testSSM,
                            key: 'testSSMOne'
                        },
                        testSSMTwo: {
                            ...testSSM,
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
            const testSSM: IStateSeekingMachine<testKeys> = {
                key: 'testSSM',
                template: testTemplate,
                currentState: 'INITIAL',
                desiredState: 'CONNECTED'
            }
            const getState = jest.fn().mockReturnValue({
                stateSeekingMachines: {
                    machines: {
                        testSSMOne: {
                            ...testSSM,
                            key: 'testSSMOne'
                        },
                        testSSMTwo: {
                            ...testSSM,
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