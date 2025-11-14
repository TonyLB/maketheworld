import { PlayerCondition, PlayerAction, PlayerPublic } from './baseClasses'
import {
    socketDispatch,
    socketDispatchPromise,
    getStatus,
    LifeLinePubSub
} from '../lifeLine'
import { LifeLinePubSubData } from '../lifeLine/lifeLine'
import { getSerialized } from '../personalAssets'
import { OnboardingKey, onboardingChapters } from '../../components/Onboarding/checkpoints'
import { 
    unsubscribeFromPlayerDataSource
} from './playerDataSource'
import { getPlayerName } from '../settings'

export const lifelineCondition: PlayerCondition = (_, getState) => {
    const status = getStatus(getState())
    return (status === 'CONNECTED')
}

// Hold condition: Wait for PlayerName to be populated from SessionInitialized message
// This ensures we can subscribe to playerDataSource with the actual player name
export const playerNameCondition: PlayerCondition = (_, getState) => {
    const playerName = getPlayerName(getState())
    return playerName !== ''
}

const mergePlayerInfo = (receivePlayer: any, payload: LifeLinePubSubData & { messageType: 'Player' }) => (dispatch: any, getState: any) => {
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
    // SessionId is now stored in settings slice, not passed to receivePlayer
    dispatch(receivePlayer({ PlayerName, CodeOfConductConsent, Assets: newAssets, Characters, Settings, SessionId: '' }))
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
    // Note: playerDataSource now auto-subscribes via onReady callback when it reaches READY state
    // SessionInitialized is now handled in the lifeLine slice (set up early, before player slice subscribes)
    
    // Subscribe to LifeLinePubSub for legacy Player message handling (for backward compatibility during migration)
    const lifeLineSubscription = LifeLinePubSub.subscribe(({ payload }) => {
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

export const unsubscribeAction: PlayerAction = ({ internalData: { subscription }}) => async (dispatch, getState) => {
    if (subscription) {
        subscription.unsubscribe?.()
    }
    
    // Get the actual PlayerName from settings to unsubscribe from the correct stream
    const playerName = getPlayerName(getState())
    if (playerName) {
        // Unsubscribe from the player data source
        await dispatch(unsubscribeFromPlayerDataSource([playerName]))
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
