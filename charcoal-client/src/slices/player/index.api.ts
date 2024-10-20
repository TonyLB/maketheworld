import { PlayerCondition, PlayerAction, PlayerPublic } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus,
    LifeLinePubSub
} from '../lifeLine'
import { LifeLinePubSubData } from '../lifeLine/lifeLine'
import { getMyAssets, getMySettings, getPlayer } from './selectors'
import { addItem, getSerialized, receiveWMLEvent } from '../personalAssets'
import { OnboardingKey, onboardingChapters } from '../../components/Onboarding/checkpoints'

export const lifelineCondition: PlayerCondition = (_, getState) => {
    const status = getStatus(getState())

    return (status === 'CONNECTED')
}

const mergePlayerInfo = (receivePlayer: any, payload: LifeLinePubSubData & { messageType: 'Player' }) => (dispatch, getState) => {
    const { PlayerName, CodeOfConductConsent, Characters, Assets, Settings, SessionId } = payload
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
    dispatch(receivePlayer({ PlayerName, CodeOfConductConsent, Assets: newAssets, Characters, Settings, SessionId }))
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

export const fetchDraftAsset: PlayerAction = () => async (dispatch, getState) => {
    await dispatch(addItem({ key: 'ASSET#draft' }))
    const state = getState().player.publicData
    const player = getPlayer(state)
    await Promise.all([
        dispatch(socketDispatchPromise({ message: 'subscribe', source: 'mtw.wml', detailType: 'Asset Edited', AssetId: `ASSET#draft[${player.PlayerName}]` }, { service: 'subscriptions' })),
        dispatch(socketDispatchPromise({ message: 'subscribe', source: 'mtw.wml', detailType: 'Merge Conflict', AssetId: `ASSET#draft[${player.PlayerName}]` }, { service: 'subscriptions' }))
    ])
    LifeLinePubSub.subscribe(({ payload }) => {
        if (payload.messageType === 'Subscription' && payload.source === 'mtw.wml' && payload.AssetId === `ASSET#draft[${player.PlayerName}]`) {
            dispatch(receiveWMLEvent('ASSET#draft')({ event: payload }))
        }
    })
    return {}
}

export const unsubscribeAction: PlayerAction = ({ internalData: { subscription }}) => async () => {
    if (subscription) {
        subscription.unsubscribe?.()
    }
    return {
        publicData: {
            Assets: [],
            Characters: [],
            PlayerName: '',
            Settings: { onboardCompleteTags: [] },
            SessionId: ''
        }
    }
}

export const updateOnboardingComplete = ({ addTags = [], removeTags = [] }: { addTags?: OnboardingKey[], removeTags?: OnboardingKey[] }) => async (dispatch) => {
    await dispatch(socketDispatchPromise({
        message: 'updatePlayerSettings',
        actions: [
            { action: 'addOnboarding', values: addTags },
            { action: 'removeOnboarding', values: removeTags }
        ]
    }, { service: 'asset' }))
}

export const removeOnboardingComplete = (tags: OnboardingKey[]) => async (dispatch) => {
    await dispatch(updateOnboardingComplete({ removeTags: tags }))
}

type AddOnboardingCheckpointOptions = {
    requireSequence?: boolean;
    condition?: boolean;
}

export const addOnboardingComplete = (tags: OnboardingKey[], options?: AddOnboardingCheckpointOptions) => async (dispatch, getState) => {
    const { requireSequence = false, condition = true } = options || {}
    const publicData = getState()?.player?.publicData
    const { onboardCompleteTags } = getMySettings(publicData)
    //
    // A local duplication of the functionality abstracted in getNextOnboarding ... should
    // really figure out how to not repeat, but Redux and SSM makes that complicated
    //
    const firstChapterUnfinished = !(onboardCompleteTags.includes(`endMTWNavigation`))
    const index = firstChapterUnfinished ? 0 : onboardingChapters.findIndex(({ chapterKey }) => (onboardCompleteTags.includes(`active${chapterKey}`)))
    const currentChapter = index === -1 ? undefined : onboardingChapters[index]
    const currentPage = currentChapter ? currentChapter.pages.find((check) => (!onboardCompleteTags.includes(check.pageKey))) : undefined
    const nextIndex = currentPage ? currentPage.subItems.findIndex(({ key }) => (!onboardCompleteTags.includes(key))) : -1
    const next = (nextIndex === -1) ? undefined : currentPage.subItems[nextIndex].key as OnboardingKey

    const updateTags = [
        ...tags,
        ...((currentPage && currentPage.subItems.length && (nextIndex === currentPage.subItems.length - 1) && tags.includes(next)) ? [currentPage.pageKey] : [])
    ].filter((tag) => (!onboardCompleteTags.includes(tag)))
    
    if (updateTags.length && condition && (!requireSequence || updateTags.includes(next))) {
        await dispatch(updateOnboardingComplete({ addTags: updateTags }))
    }
}
