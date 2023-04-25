import { PlayerCondition, PlayerAction, PlayerPublic } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus,
    LifeLinePubSub
} from '../lifeLine'
import { LifeLinePubSubData } from '../lifeLine/lifeLine'
import { getMyAssets, getMySettings } from './selectors'
import { getSerialized } from '../personalAssets'

export const lifelineCondition: PlayerCondition = (_, getState) => {
    const status = getStatus(getState())

    return (status === 'CONNECTED')
}

const mergePlayerInfo = (receivePlayer: any, payload: LifeLinePubSubData & { messageType: 'Player' }) => (dispatch, getState) => {
    const { PlayerName, CodeOfConductConsent, Characters, Assets, Settings } = payload
    const state = getState()
    const currentAssets = getMyAssets(state?.player?.publicData)
    const assetsToPreserve = currentAssets
        .map(({ AssetId }) => (AssetId))
        .filter((checkId) => (
            Assets.find(({ AssetId }) => (AssetId === checkId)) ||
            !Boolean(getSerialized(checkId)(state))
        ))
    const newAssets = [
        ...currentAssets.filter(({ AssetId }) => (assetsToPreserve.includes(AssetId))),
        ...Assets.filter(({ AssetId }) => (!assetsToPreserve.includes(AssetId)))
    ]
    dispatch(receivePlayer({ PlayerName, CodeOfConductConsent, Assets: newAssets, Characters, Settings }))
}

export const subscribeAction: PlayerAction = ({ actions: { receivePlayer } }) => async (dispatch) => {
    const lifeLineSubscription = LifeLinePubSub.subscribe(({ payload }) => {
        if (payload.messageType === 'Player') {
            dispatch(mergePlayerInfo(receivePlayer, payload))
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

export const addOnboardingComplete = (tags: PlayerPublic["Settings"]["onboardCompleteTags"]) => async (dispatch, getState) => {
    const { onboardCompleteTags } = getMySettings(getState()?.player?.publicData)
    const updateTags = tags.filter((tag) => (!onboardCompleteTags.includes(tag)))
    if (updateTags.length) {
        await dispatch(socketDispatchPromise({
            message: 'updatePlayerSettings',
            action: 'addOnboarding',
            values: updateTags
        }, { service: 'asset' }))
    }
}
