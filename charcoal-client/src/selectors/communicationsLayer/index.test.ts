import { produce, immerable } from 'immer'
import { StateSeekingMachineModule } from '../../reducers/stateSeekingMachine'
import { getLifeLine } from './index'

describe('communicationsLayer selectors', () => {
    describe('getLifeLine', () => {
        const testStateSeekingMachineModule: StateSeekingMachineModule = {
            [immerable]: true,
            lastEvaluation: '100',
            heartbeat: '100',
            machines: {
                LifeLine: {
                    key: 'LifeLine',
                    currentState: 'CONNECTED',
                    desiredState: 'CONNECTED',
                    template: {
                        initialState: 'INITIAL',
                        states: {}
                    }
                }
            }
        }
        it('should return a default on null state', () => {
            expect(getLifeLine({})).toEqual({ status: 'INITIAL' })
        })

        it('should return a default when webSocket not defined in communicationsLayer', () => {
            expect(getLifeLine({
                communicationsLayer: {},
                stateSeekingMachines: produce(testStateSeekingMachineModule, draftModule => {
                    draftModule.machines.LifeLine.currentState = 'INITIAL'
                })
            })).toEqual({ status: 'INITIAL' })
        })

        it('should return webSocket info when defined', () => {
            expect(getLifeLine({
                stateSeekingMachines: produce(testStateSeekingMachineModule, draftModule => {
                    draftModule.machines.LifeLine.data = {
                        webSocket: 'ABC',
                        pingInterval: 123,
                        refreshTimeout: 456
                    }
                })
            })).toEqual({
                status: 'CONNECTED',
                webSocket: 'ABC',
                pingInterval: 123,
                refreshTimeout: 456
            })
        })
    })

})