import {
    ISSMTemplate,
    STATE_SEEKING_MACHINE_REGISTER,
    STATE_SEEKING_EXTERNAL_CHANGE,
    registerSSM,
    externalStateChange
} from './index'

describe('stateSeekingMachine', () => {
    const testTemplate: ISSMTemplate = {
        initialState: 'INITIAL',
        states: {
            INITIAL: {
                key: 'INITIAL',
                choices: [],
                externals: []
            },
            CONNECTING: {
                key: 'CONNECTING',
                choices: [],
                externals: []
            }
        }
    }
    describe('registerSSM', () => {
        it('should correctly dispatch', () => {
            expect(registerSSM({ key: 'TEST', template: testTemplate })).toEqual({
                type: STATE_SEEKING_MACHINE_REGISTER,
                payload: {
                    key: 'TEST',
                    template: testTemplate
                }
            })
        })
    })
    describe('externalStateChange', () => {
        it('should correctly dispatch', () => {
            expect(externalStateChange({ key: 'TEST', newState: 'CONNECTING' })).toEqual({
                type: STATE_SEEKING_EXTERNAL_CHANGE,
                payload: {
                    key: 'TEST',
                    newState: 'CONNECTING'
                }
            })
        })
    })
})