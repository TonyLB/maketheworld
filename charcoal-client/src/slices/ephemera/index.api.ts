import { EphemeraCondition, EphemeraAction } from './baseClasses'
import { socketDispatchPromise } from '../lifeLine'
import { LifeLinePubSub, getStatus } from '../lifeLine'

export const lifelineCondition: EphemeraCondition = (_, getState) => {
    const status = getStatus(getState())

    return (status === 'CONNECTED')
}

export const subscribeAction: EphemeraAction = ({ actions: { receiveEphemera } }) => async (dispatch, getState) => {

    const lifeLineSubscription = LifeLinePubSub.subscribe(({ payload }) => {
        if (payload.messageType === 'Ephemera') {
            const { updates } = payload
            updates.forEach((update) => { dispatch(receiveEphemera(update)) })
        }
    })

    return { internalData: { subscription: lifeLineSubscription } }
}

export const syncAction: EphemeraAction = () => async (dispatch) => {
    await dispatch(socketDispatchPromise({ message: 'fetchEphemera' }))
    return {}
}

export const unsubscribeAction: EphemeraAction = ({ internalData: { subscription }}) => async () => {
    if (subscription) {
        await subscription.unsubscribe()
    }
    return {}
}
