import { registerSSM, assertIntent } from '../../stateSeekingMachine'
import { PermanentsSubscriptionTemplate } from './permanentsSubscription'
import { PlayerSubscriptionTemplate } from './playerSubscription'
import { EphemeraSubscriptionTemplate } from './ephemeraSubscription'

export { SUBSCRIPTION_SUCCESS } from './baseClasses'
export { SET_PERMANENTS_LAST_SYNC } from './permanentsSubscription'

export const registerPermanentsSSM = (dispatch: any): void => {
    dispatch(registerSSM({ key: 'Subscribe::Permanents', template: new PermanentsSubscriptionTemplate() }))
    dispatch(assertIntent({ key: 'Subscribe::Permanents', newState: 'SYNCHRONIZED' }))
}

export const registerPlayerSSM = (dispatch: any): void => {
    dispatch(registerSSM({ key: 'Subscribe::Player', template: new PlayerSubscriptionTemplate() }))
    dispatch(assertIntent({ key: 'Subscribe::Player', newState: 'SYNCHRONIZED' }))
}

export const registerEphemeraSSM = (dispatch: any): void => {
    dispatch(registerSSM({ key: 'Subscribe::Ephemera', template: new EphemeraSubscriptionTemplate() }))
    dispatch(assertIntent({ key: 'Subscribe::Ephemera', newState: 'SYNCHRONIZED' }))
}