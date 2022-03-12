import { PlayerCondition, PlayerAction } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus,
    LifeLinePubSub
} from '../lifeLine'

export const lifelineCondition: PlayerCondition = (_, getState) => {
    const status = getStatus(getState())

    return (status === 'CONNECTED')
}

export const subscribeAction: PlayerAction = ({ actions: { receivePlayer } }) => async (dispatch) => {
    const lifeLineSubscription = LifeLinePubSub.subscribe(({ payload }) => {
        if (payload.messageType === 'Player') {
            const { PlayerName, CodeOfConductConsent, Characters, Assets } = payload
            dispatch(receivePlayer({ PlayerName, CodeOfConductConsent, Assets, Characters }))
        }
    })

    return { internalData: { subscription: lifeLineSubscription } }
}

export const syncAction: PlayerAction = () => async (dispatch) => {
    //
    // TODO: Update values based on return value of socketDispatchPromise, rather
    // than counting implicitly on the subscription to receive that data
    //
    await dispatch(socketDispatchPromise('whoAmI')({}))
    return {}
}

export const unsubscribeAction: PlayerAction = ({ internalData: { subscription }}) => async () => {
    if (subscription) {
        await subscription.unsubscribe()
    }
    return {}
}
