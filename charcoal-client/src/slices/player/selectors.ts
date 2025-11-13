import { PlayerPublic } from './baseClasses'
import { Selector, RootState } from '../../store'
import { playerDataSourceSelectors } from './playerDataSource'
import { PlayerSnapshot } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'

// Helper to get the materialized view from playerDataSource
const getPlayerSnapshot = (state: RootState): PlayerSnapshot | null => {
    // Guard against undefined playerDataSource (during initial render)
    // The selector wrapper expects the root state, but we need to ensure the slice exists
    if (!state || !state.playerDataSource) {
        return null
    }
    try {
        // getSubscribedStreams is wrapped to use sliceSelector, so it expects root state
        const subscribedStreams = playerDataSourceSelectors.getSubscribedStreams(state)
        // Check for 'self' first (what we subscribed to), then check activeStreamKeys
        // Backend rewrites 'self' to actual player name, so events may come with actual name
        let stream = subscribedStreams?.['self']
        if (!stream) {
            // Check if there's a stream with the actual player name
            const activeStreamKeys = playerDataSourceSelectors.getActiveStreamKeys(state)
            const actualStreamKey = activeStreamKeys.find(key => key !== 'self')
            if (actualStreamKey) {
                stream = subscribedStreams?.[actualStreamKey]
            }
        }
        return stream?.materializedView || null
    } catch (error) {
        // If the slice isn't fully initialized yet, return null
        return null
    }
}

// Helper to get SessionId from player slice (handled separately via coordination messages)
const getSessionId = (state: RootState): string => {
    return state.player?.publicData?.SessionId || ''
}

// Helper to get PlayerName - try to get from playerDataSource stream key, fallback to player slice
const getPlayerName = (state: RootState): string => {
    // The stream key should be the player name after subscriptions lambda processes it
    // For now, we'll use 'self' as fallback, but ideally we'd get the actual name from the stream
    return state.player?.publicData?.PlayerName || 'self'
}

export const getPlayer = (state: RootState): PlayerPublic => {
    const snapshot = getPlayerSnapshot(state)
    const sessionId = getSessionId(state)
    const playerName = getPlayerName(state)
    
    if (!snapshot) {
        return {
            PlayerName: playerName,
            CodeOfConductConsent: false,
            Assets: [],
            Characters: [],
            Settings: { onboardCompleteTags: [] },
            SessionId: sessionId
        }
    }
    
    return {
        PlayerName: playerName,
        CodeOfConductConsent: true,
        Assets: snapshot.assets,
        Characters: snapshot.characters,
        Settings: snapshot.settings,
        SessionId: sessionId
    }
}

export const getMyCharacters = (state: RootState): PlayerPublic['Characters'] => {
    const snapshot = getPlayerSnapshot(state)
    return snapshot?.characters || []
}

export const getMyAssets = (state: RootState): PlayerPublic['Assets'] => {
    const snapshot = getPlayerSnapshot(state)
    return snapshot?.assets || []
}

export const getMyDraftAssets = (state: RootState): PlayerPublic['Assets'] => {
    const snapshot = getPlayerSnapshot(state)
    return (snapshot?.assets || []).filter((asset: any) => (asset?.zone === 'Draft'))
}

export const getMyPersonalAssets = (state: RootState): PlayerPublic['Assets'] => {
    const snapshot = getPlayerSnapshot(state)
    return (snapshot?.assets || []).filter((asset: any) => (asset?.zone === 'Personal'))
}

export const getMySettings = (state: RootState): PlayerPublic['Settings'] => {
    const snapshot = getPlayerSnapshot(state)
    return snapshot?.settings || { onboardCompleteTags: [] }
}

const guestCharacter = (guestId: string, guestName: string): PlayerPublic['Characters'][number] => ({
    CharacterId: `CHARACTER#${guestId}`,
    Name: guestName,
    Pronouns: 'they/them'
})

export const getMyCharacterByKey = (key: string | undefined): Selector<any> => (state) => {
    if (key === 'Guest') {
        const settings = getMySettings(state)
        const { guestId, guestName } = settings
        if (!(guestId && guestName)) {
            throw new Error('Guest character requested but no guestId found in settings')
        }
        return guestCharacter(guestId, guestName)
    }
    const Characters = getMyCharacters(state)
    return Characters.find(({ scopedId }) => (scopedId === key))
}

export const getMyCharacterById = (key: string | undefined): Selector<any> => (state) => {
    const settings = getMySettings(state)
    const { guestId, guestName } = settings
    if (key === `CHARACTER#${guestId}`) {
        if (!(guestId && guestName)) {
            throw new Error('Guest character requested but no guestId found in settings')
        }
        return guestCharacter(guestId, guestName)
    }
    const Characters = getMyCharacters(state)
    return Characters.find(({ CharacterId }) => (CharacterId === key))
}

//
// Selector types - these now read from RootState instead of PlayerPublic
//
export type PlayerSelectors = {
    getPlayer: (state: RootState) => PlayerPublic;
    getMyCharacters: (state: RootState) => PlayerPublic['Characters'];
    getMyAssets: (state: RootState) => PlayerPublic['Assets'];
    getMyDraftAssets: (state: RootState) => PlayerPublic['Assets'];
    getMyPersonalAssets: (state: RootState) => PlayerPublic['Assets'];
    getMySettings: (state: RootState) => PlayerPublic['Settings'];
}
