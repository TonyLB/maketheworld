import { immerable } from 'immer'
import reducer, { StateSeekingMachineModule } from './index'
import {
    ISSMTemplate,
    STATE_SEEKING_MACHINE_REGISTER,
    STATE_SEEKING_MACHINE_HEARTBEAT,
    STATE_SEEKING_EXTERNAL_CHANGE,
    STATE_SEEKING_INTERNAL_CHANGE,
    STATE_SEEKING_ASSERT_DESIRE
} from '../../actions/stateSeekingMachine'

type testKeys = 'INITIAL' | 'CONNECTING' | 'CONNECTED'

class TestData {
    valOne: string = ''
    valTwo: string = ''
}

const testTemplate: ISSMTemplate<testKeys, TestData> = {
    initialState: 'INITIAL',
    initialData: new TestData(),
    states: {
        INITIAL: {
            stateType: 'CHOICE',
            key: 'INITIAL',
            choices: []
        },
        CONNECTING: {
            stateType: 'ATTEMPT',
            key: 'CONNECTING',
            action: jest.fn(),
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

const testState: StateSeekingMachineModule = {
    [immerable]: true,
    lastEvaluation: '100',
    heartbeat: '100',
    machines: {
        test: {
            key: 'test',
            currentState: 'INITIAL',
            desiredState: 'INITIAL',
            template: testTemplate,
            data: new TestData()
        }
    }
}

describe('stateSeekingMachine reducer', () => {
    it('should return unchanged on a no-op', () => {
        expect(reducer(testState, { type: 'NO-OP' })).toEqual(testState)
    })
    it('should register a state-seeking machine', () => {
        expect(reducer(testState, {
            type: STATE_SEEKING_MACHINE_REGISTER,
            payload: {
                key: 'testTwo',
                template: testTemplate
            }
        })).toEqual({
            [immerable]: true,
            lastEvaluation: '100',
            heartbeat: '100',
            machines: {
                test: {
                    key: 'test',
                    currentState: 'INITIAL',
                    desiredState: 'INITIAL',
                    template: testTemplate,
                    data: new TestData()
                },
                testTwo: {
                    key: 'testTwo',
                    currentState: 'INITIAL',
                    desiredState: 'INITIAL',
                    template: testTemplate,
                    data: new TestData()
                }
            }
        })
    })
    it('should not override existing state-seeking machine on register', () => {
        expect(reducer({
            [immerable]: true,
            lastEvaluation: '100',
            heartbeat: '100',
            machines: {
                test: {
                    key: 'test',
                    currentState: 'CONNECTED',
                    desiredState: 'CONNECTED',
                    template: testTemplate,
                    data: new TestData()
                }
            }
        }, {
            type: STATE_SEEKING_MACHINE_REGISTER,
            payload: {
                key: 'test',
                template: testTemplate
            }
        })).toEqual({
            [immerable]: true,
            lastEvaluation: '100',
            heartbeat: '100',
            machines: {
                test: {
                    key: 'test',
                    currentState: 'CONNECTED',
                    desiredState: 'CONNECTED',
                    template: testTemplate,
                    data: new TestData()
                }
            }
        })
    })
    it('should register a heartbeat', () => {
        expect(reducer(testState, {
            type: STATE_SEEKING_MACHINE_HEARTBEAT,
            payload: '200'
        })).toEqual({
            [immerable]: true,
            lastEvaluation: '100',
            heartbeat: '200', 
            machines: {
                test: {
                    key: 'test',
                    currentState: 'INITIAL',
                    desiredState: 'INITIAL',
                    template: testTemplate,
                    data: new TestData()
                }
            }
        })
    })
    it('should register an external state-change', () => {
        expect(reducer(testState, {
            type: STATE_SEEKING_EXTERNAL_CHANGE,
            payload: { key: 'test', newState: 'CONNECTING' }
        })).toEqual({
            [immerable]: true,
            lastEvaluation: '100',
            heartbeat: '100',
            machines: {
                test: {
                    key: 'test',
                    currentState: 'CONNECTING',
                    desiredState: 'INITIAL',
                    template: testTemplate,
                    data: new TestData()
                }
            }
        })
    })
    it('should register an internal state-change', () => {
        expect(reducer(testState, {
            type: STATE_SEEKING_INTERNAL_CHANGE,
            payload: { key: 'test', newState: 'CONNECTING', data: { valOne: '123' } }
        })).toEqual({
            [immerable]: true,
            lastEvaluation: '100',
            heartbeat: '100',
            machines: {
                test: {
                    key: 'test',
                    currentState: 'CONNECTING',
                    desiredState: 'INITIAL',
                    template: testTemplate,
                    data: {
                        valOne: '123',
                        valTwo: ''
                    }
                }
            }
        })
    })
    it('should register asserting desire', () => {
        expect(reducer(testState, {
            type: STATE_SEEKING_ASSERT_DESIRE,
            payload: { key: 'test', newState: 'CONNECTED' }
        })).toEqual({
            [immerable]: true,
            lastEvaluation: '100',
            heartbeat: '100',
            machines: {
                test: {
                    key: 'test',
                    currentState: 'INITIAL',
                    desiredState: 'CONNECTED',
                    template: testTemplate,
                    data: new TestData()
                }
            }
        })
    })
})