import { LibraryCondition, LibraryAction } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus,
    LifeLinePubSub
} from '../lifeLine'

export const lifelineCondition: LibraryCondition = (_, getState) => {
    const status = getStatus(getState())

    return (status === 'CONNECTED')
}

export const subscribeAction: LibraryAction = ({ actions: { receiveLibrary } }) => async (dispatch) => {
    const lifeLineSubscription = LifeLinePubSub.subscribe(({ payload }) => {
        if (payload.messageType === 'Library') {
            const { Characters, Assets } = payload
            dispatch(receiveLibrary({ Assets, Characters }))
        }
    })
    await dispatch(socketDispatchPromise({ message: 'subscribe' }, { service: 'asset' }))

    return { internalData: { subscription: lifeLineSubscription } }
}

export const syncAction: LibraryAction = () => async (dispatch) => {
    //
    // TODO: Update values based on return value of socketDispatchPromise, rather
    // than counting implicitly on the subscription to receive that data
    //
    await dispatch(socketDispatchPromise({ message: 'fetchLibrary' }, { service: 'asset'}))
    return {}
}

export const unsubscribeAction: LibraryAction = ({ internalData: { subscription }}) => async () => {
    if (subscription) {
        await subscription.unsubscribe()
    }
    return {}
}
