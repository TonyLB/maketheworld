import { registerSSM } from '../../stateSeekingMachine'
import { PlayerSubscriptionTemplate } from './playerSubscription'

export { SUBSCRIPTION_SUCCESS } from './baseClasses'

export const registerPlayerSSM = (dispatch: any): void => {
    dispatch(registerSSM({ key: 'Subscribe::Player', template: new PlayerSubscriptionTemplate(), defaultIntent: 'SYNCHRONIZED' }))
}
