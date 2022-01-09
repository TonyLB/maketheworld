import { produce, immerable } from 'immer'
import { StateSeekingMachineModule } from '../../reducers/stateSeekingMachine'
import { getLifeLine, getSubscriptionStatus } from './index'

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

    describe('getSubscriptionStatus', () => {
        it('should return INITIAL on null state', () => {
            expect(getSubscriptionStatus({})).toEqual('INITIAL')
        })
        it('should return INITIAL when all global subscriptions initial', () => {
            expect(getSubscriptionStatus({ communicationsLayer: { appSyncSubscriptions: {
                ephemera: { status: 'INITIAL' },
                permanents: { status: 'INITIAL' },
                player: { status: 'INITIAL'}
            }}})).toEqual('INITIAL')
        })
        it('should return CONNECTING when any subscription is connecting', () => {
            expect(getSubscriptionStatus({ communicationsLayer: { appSyncSubscriptions: {
                ephemera: { status: 'CONNECTED' },
                permanents: { status: 'CONNECTING' },
                player: { status: 'CONNECTED'}
            }}})).toEqual('CONNECTING')
        })
        it('should return CONNECTED when all subscriptions are connected', () => {
            expect(getSubscriptionStatus({ communicationsLayer: { appSyncSubscriptions: {
                ephemera: { status: 'CONNECTED' },
                permanents: { status: 'CONNECTED' },
                player: { status: 'CONNECTED'}
            }}})).toEqual('CONNECTED')
        })
        it('should return ERROR when any subscription is error', () => {
            expect(getSubscriptionStatus({ communicationsLayer: { appSyncSubscriptions: {
                ephemera: { status: 'CONNECTED' },
                permanents: { status: 'ERROR' },
                player: { status: 'CONNECTED'}
            }}})).toEqual('ERROR')
        })
    })
})