import { PlayerCondition, PlayerAction, PlayerPublic } from './baseClasses'
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
            const { PlayerName, CodeOfConductConsent, Characters, Assets, Settings } = payload
            dispatch(receivePlayer({ PlayerName, CodeOfConductConsent, Assets, Characters, Settings }))
        }
    })

    return { internalData: { subscription: lifeLineSubscription } }
}

//
// TODO: Once fetchNotification is working consistently, combine into syncAction
// to run the two in parallel with a Promise.all
//
export const fetchNotifications: PlayerAction = () => async (dispatch) => {
    await dispatch(socketDispatchPromise({ message: 'syncNotification' }))
    return {}
}

export const syncAction: PlayerAction = () => async (dispatch) => {
    //
    // TODO: Update values based on return value of socketDispatchPromise, rather
    // than counting implicitly on the subscription to receive that data
    //
    await dispatch(socketDispatchPromise({ message: 'whoAmI' }, { service: 'asset' }))
    return {}
}

export const unsubscribeAction: PlayerAction = ({ internalData: { subscription }}) => async () => {
    if (subscription) {
        await subscription.unsubscribe()
    }
    return {}
}

export const removeOnboardingComplete = (tags: PlayerPublic["Settings"]["onboardCompleteTags"]) => async (dispatch) => {
    await dispatch(socketDispatchPromise({
        message: 'updatePlayerSettings',
        action: 'removeOnboarding',
        values: tags
    }, { service: 'asset' }))
}

export const addOnboardingComplete = (tags: PlayerPublic["Settings"]["onboardCompleteTags"]) => async (dispatch) => {
    await dispatch(socketDispatchPromise({
        message: 'updatePlayerSettings',
        action: 'addOnboarding',
        values: tags
    }, { service: 'asset' }))
}
