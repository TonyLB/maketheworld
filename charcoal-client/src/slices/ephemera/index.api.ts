import { EphemeraCondition, EphemeraAction } from './baseClasses'
import { socketDispatchPromise } from '../../actions/communicationsLayer/lifeLine'
import { getLifeLine } from '../../selectors/communicationsLayer'
import { LifeLineData } from '../../actions/communicationsLayer/lifeLine/baseClass'

export const lifelineCondition: EphemeraCondition = (_, getState) => {
    const state = getState()
    const { status } = getLifeLine(state)

    return (status === 'CONNECTED')
}

export const subscribeAction: EphemeraAction = ({ actions: { receiveEphemera } }) => async (dispatch, getState) => {
    const lifeLine = getLifeLine(getState()) as LifeLineData

    const lifeLineSubscription = lifeLine.subscribe(({ payload }) => {
        if (payload.messageType === 'Ephemera') {
            const { updates } = payload
            updates.forEach((update) => { dispatch(receiveEphemera(update)) })
        }
    })

    return { internalData: { subscription: lifeLineSubscription } }
}

export const syncAction: EphemeraAction = () => async (dispatch) => {
    await dispatch(socketDispatchPromise('fetchEphemera')({}))
    return {}
}

export const unsubscribeAction: EphemeraAction = ({ internalData: { subscription }}) => async () => {
    if (subscription) {
        await subscription.unsubscribe()
    }
    return {}
}
