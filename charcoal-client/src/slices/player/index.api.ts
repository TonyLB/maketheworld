import { PlayerCondition, PlayerAction, PlayerPublic } from './baseClasses'
import {
    socketDispatch,
    socketDispatchPromise,
    getStatus,
    LifeLinePubSub
} from '../lifeLine'
import { LifeLinePubSubData } from '../lifeLine/lifeLine'
import { getMyAssets, getMySettings } from './selectors'
import { getSerialized } from '../personalAssets'
import { OnboardingKey, onboardingChapters } from '../../components/Onboarding/checkpoints'
import { PlayerSubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { CoordinationClientSessionInitializedMessage, isCoordinationClientMessage } from '@tonylb/mtw-interfaces/ts/coordination'
import { 
    subscribeToPlayerDataSource,
    unsubscribeFromPlayerDataSource
} from './playerDataSource'

export const lifelineCondition: PlayerCondition = (_, getState) => {
    const status = getStatus(getState())

    return (status === 'CONNECTED')
}

const mergePlayerInfo = (receivePlayer: any, payload: LifeLinePubSubData & { messageType: 'Player' }) => (dispatch: any, getState: any) => {
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

const EMPTY_PLAYER: PlayerPublic = {
    PlayerName: '',
    CodeOfConductConsent: false,
    Assets: [],
    Characters: [],
    Settings: { onboardCompleteTags: [] },
    SessionId: ''
}

export const subscribeAction: PlayerAction = ({ actions: { receivePlayer } }) => async (dispatch, getState) => {
    // Subscribe to the player data source for the 'self' stream
    // This will automatically handle out-of-order events, caching, and re-aggregation
    await dispatch(subscribeToPlayerDataSource(['self']))

    // Subscribe to LifeLinePubSub for coordination messages (SessionId)
    const lifeLineSubscription = LifeLinePubSub.subscribe(({ payload }) => {
        // Handle SessionInitialized coordination message - store SessionId once
        if (isCoordinationClientMessage(payload) && payload.messageType === 'SessionInitialized') {
            const sessionInitialized = payload as CoordinationClientSessionInitializedMessage
            const previous = (getState()?.player?.publicData as PlayerPublic | undefined) ?? EMPTY_PLAYER
            // Update player state with SessionId, preserving other fields
            dispatch(receivePlayer({
                ...previous,
                SessionId: sessionInitialized.SessionId
            }))
            return
        }

        // Legacy Player message handling (for backward compatibility during migration)
        if (payload.messageType === 'Player') {
            dispatch(mergePlayerInfo(receivePlayer, payload))
            return
        }
    })

    return { 
        internalData: { 
            subscription: lifeLineSubscription
        } 
    }
}

export const syncAction: PlayerAction = () => async () => {
    // No-op: Data is now read directly from playerDataSource via selectors
    // This action is kept for state machine compatibility but doesn't need to sync data
    return {}
}

// Removed legacy fetchDraftAsset (single-draft bootstrap). Multi-draft flow will drive subscriptions explicitly.

export const unsubscribeAction: PlayerAction = ({ internalData: { subscription }}) => async (dispatch) => {
    if (subscription) {
        subscription.unsubscribe?.()
    }
    
    // Unsubscribe from the player data source
    await dispatch(unsubscribeFromPlayerDataSource(['self']))
    
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

export const updateOnboardingComplete = ({ addTags = [], removeTags = [] }: { addTags?: OnboardingKey[], removeTags?: OnboardingKey[] }) => async (dispatch: any) => {
    await dispatch(socketDispatchPromise({
        message: 'updatePlayerSettings',
        actions: [
            { action: 'addOnboarding', values: addTags },
            { action: 'removeOnboarding', values: removeTags }
        ]
    }, { service: 'asset' }))
}

export const removeOnboardingComplete = (tags: OnboardingKey[]) => async (dispatch: any) => {
    await dispatch(updateOnboardingComplete({ removeTags: tags }))
}

type AddOnboardingCheckpointOptions = {
    requireSequence?: boolean;
    condition?: boolean;
}

export const addOnboardingComplete = (tags: OnboardingKey[], options?: AddOnboardingCheckpointOptions) => async (dispatch: any, getState: any) => {
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
    const next = (nextIndex === -1) ? undefined : currentPage?.subItems?.[nextIndex]?.key as OnboardingKey

    const updateTags = [
        ...tags,
        ...((currentPage && currentPage.subItems.length && (nextIndex === currentPage.subItems.length - 1) && tags.includes(next ?? '')) ? [currentPage.pageKey] : [])
    ].filter((tag) => (!onboardCompleteTags.includes(tag)))
    
    if (updateTags.length && condition && (!requireSequence || updateTags.includes(next ?? ''))) {
        await dispatch(updateOnboardingComplete({ addTags: updateTags }))
    }
}
