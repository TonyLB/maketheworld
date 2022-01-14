import { PlayerCondition, PlayerAction } from './baseClasses'
import { socketDispatchPromise } from '../../actions/communicationsLayer/lifeLine'
import { getLifeLine } from '../../selectors/communicationsLayer'
import { LifeLineData } from '../../actions/communicationsLayer/lifeLine/baseClass'

export const lifelineCondition: PlayerCondition = (_, getState) => {
    const state = getState()
    const { status } = getLifeLine(state)

    return (status === 'CONNECTED')
}

export const subscribeAction: PlayerAction = ({ actions: { receivePlayer } }) => async (dispatch, getState) => {
    const lifeLine = getLifeLine(getState()) as LifeLineData

    const lifeLineSubscription = lifeLine.subscribe(({ payload }) => {
        if (payload.messageType === 'Player') {
            const { PlayerName, CodeOfConductConsent, Characters } = payload
            dispatch(receivePlayer({ PlayerName, CodeOfConductConsent, Characters }))
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
