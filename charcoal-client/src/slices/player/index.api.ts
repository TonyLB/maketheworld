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
import {
    PlayerAggregator,
    PlayerEventSerializer
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'
import { PlayerSubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { CoordinationClientSessionInitializedMessage, isCoordinationClientMessage } from '@tonylb/mtw-interfaces/ts/coordination'

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

type PlayerSnapshotState = ReturnType<PlayerAggregator['createEmpty']>

const toPlayerPublic = (args: {
    streamKey: string;
    snapshot: PlayerSnapshotState;
    previous?: PlayerPublic;
    sessionId?: string;
}): PlayerPublic => {
    const { streamKey, snapshot, previous = EMPTY_PLAYER, sessionId } = args
    // SessionId is received once via SessionInitialized coordination message and stored in player state.
    // Fallback to previous.SessionId is kept for safety during migration.
    return {
        PlayerName: streamKey,
        CodeOfConductConsent: true,
        Assets: snapshot.assets,
        Characters: snapshot.characters,
        Settings: snapshot.settings,
        SessionId: sessionId ?? previous.SessionId ?? ''
    }
}

const isPlayerSubscriptionMessage = (payload: LifeLinePubSubData): payload is PlayerSubscriptionClientMessage => (
    typeof payload === 'object' &&
    payload !== null &&
    'messageType' in payload &&
    payload.messageType === 'StreamEvent' &&
    'dataSourceKey' in payload &&
    payload.dataSourceKey === 'mtw.assets.players'
)

export const subscribeAction: PlayerAction = ({ actions: { receivePlayer } }) => async (dispatch, getState) => {
    const aggregator = new PlayerAggregator()
    const serializer = new PlayerEventSerializer()
    let materialized: PlayerSnapshotState = aggregator.createEmpty()
    let currentPlayerName: string | undefined

    const lifeLineSubscription = LifeLinePubSub.subscribe(({ payload }) => {
        if (payload.messageType === 'Player') {
            dispatch(mergePlayerInfo(receivePlayer, payload))
            currentPlayerName = payload.PlayerName
            materialized = {
                type: 'Snapshot',
                assets: payload.Assets,
                characters: payload.Characters,
                settings: payload.Settings
            }
            return
        }

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

        if (isPlayerSubscriptionMessage(payload)) {
            const update = serializer.deserialize({
                dataSourceKey: payload.dataSourceKey,
                streamKey: payload.streamKey,
                externalUpdate: payload.update
            })
            if (!update) {
                return
            }
            const aggregation = aggregator.applyUpdate(materialized, update)
            if (!aggregation.success) {
                console.error('mtw.assets.players aggregation failed', aggregation.error)
                return
            }
            materialized = aggregation.snapshot
            currentPlayerName = payload.streamKey ?? currentPlayerName
            const previous = (getState()?.player?.publicData as PlayerPublic | undefined) ?? EMPTY_PLAYER
            if (!currentPlayerName) {
                console.warn('mtw.assets.players: Received update without streamKey; ignoring snapshot update.')
                return previous
            }
            // SessionId comes from stored player state (set via SessionInitialized message)
            const next = toPlayerPublic({
                streamKey: currentPlayerName,
                snapshot: materialized,
                previous,
                sessionId: previous.SessionId
            })
            dispatch(receivePlayer(next))
        }
    })

    await dispatch(socketDispatchPromise({
        message: 'subscribe',
        dataSourceKey: 'mtw.assets.players',
        streamKeys: ['self']
    }, { service: 'subscriptions' }))

    return { internalData: { subscription: lifeLineSubscription } }
}

export const syncAction: PlayerAction = () => async () => {
    return {}
}

// Removed legacy fetchDraftAsset (single-draft bootstrap). Multi-draft flow will drive subscriptions explicitly.

export const unsubscribeAction: PlayerAction = ({ internalData: { subscription }}) => async (dispatch) => {
    if (subscription) {
        subscription.unsubscribe?.()
    }
    await dispatch(socketDispatchPromise({
        message: 'unsubscribe',
        dataSourceKey: 'mtw.assets.players',
        streamKeys: ['self']
    }, { service: 'subscriptions' }))
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
