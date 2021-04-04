import { immerable } from 'immer'
import { StateSeekingMachineModule } from '../../reducers/stateSeekingMachine'
import { ISSMTemplate } from '../../actions/stateSeekingMachine'
import { getHeartbeat, getLastEvaluation, getSSMState } from './index'

type testKeys = 'INITIAL' | 'CONNECTING' | 'CONNECTED'

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
    lastEvaluation: '500',
    heartbeat: '100',
    machines: {
        test: {
            key: 'test',
            currentState: 'INITIAL',
            desiredState: 'INITIAL',
            template: testTemplate
        }
    }
}

describe('stateSeekingMachine selectors', () => {
    it('should return heartbeat', () => {
        expect(getHeartbeat({ stateSeekingMachines: testState })).toEqual('100')
    })
    it('should return lastEvaluation', () => {
        expect(getLastEvaluation({ stateSeekingMachines: testState })).toEqual('500')
    })
    it('should return getSSMState', () => {
        expect(getSSMState('test')({ stateSeekingMachines: testState })).toEqual('INITIAL')
    })
})