import { registerSSM } from '../../stateSeekingMachine'
import { PlayerSubscriptionTemplate } from './playerSubscription'
import { EphemeraSubscriptionTemplate } from './ephemeraSubscription'

export { SUBSCRIPTION_SUCCESS } from './baseClasses'

export const registerPlayerSSM = (dispatch: any): void => {
    dispatch(registerSSM({ key: 'Subscribe::Player', template: new PlayerSubscriptionTemplate(), defaultIntent: 'SYNCHRONIZED' }))
}

export const registerEphemeraSSM = (dispatch: any): void => {
    dispatch(registerSSM({ key: 'Subscribe::Ephemera', template: new EphemeraSubscriptionTemplate(), defaultIntent: 'SYNCHRONIZED' }))
}