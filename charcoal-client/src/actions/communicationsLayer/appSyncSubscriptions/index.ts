import { registerSSM, assertIntent } from '../../stateSeekingMachine'
import { PermanentsSubscriptionTemplate } from './permanentsSubscription'
import { PlayerSubscriptionTemplate } from './playerSubscription'
import { EphemeraSubscriptionTemplate } from './ephemeraSubscription'

export { SUBSCRIPTION_SUCCESS } from './baseClasses'
export { SET_PERMANENTS_LAST_SYNC } from './permanentsSubscription'

export const registerPermanentsSSM = (dispatch: any): void => {
    dispatch(registerSSM({ key: 'Subscribe::Permanents', template: new PermanentsSubscriptionTemplate(), defaultIntent: 'SYNCHRONIZED' }))
}

export const registerPlayerSSM = (dispatch: any): void => {
    dispatch(registerSSM({ key: 'Subscribe::Player', template: new PlayerSubscriptionTemplate(), defaultIntent: 'SYNCHRONIZED' }))
}

export const registerEphemeraSSM = (dispatch: any): void => {
    dispatch(registerSSM({ key: 'Subscribe::Ephemera', template: new EphemeraSubscriptionTemplate(), defaultIntent: 'SYNCHRONIZED' }))
}