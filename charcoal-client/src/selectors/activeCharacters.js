import { objectMap } from '../lib/objects'
import {
    ACTIVE_CHARACTER_FSM_INVALID,
    ACTIVE_CHARACTER_FSM_SUBSCRIBING,
    ACTIVE_CHARACTER_FSM_SUBSCRIBED,
    ACTIVE_CHARACTER_FSM_CONNECTING,
    ACTIVE_CHARACTER_FSM_CONNECTED,
    ACTIVE_CHARACTER_FSM_RECONNECTING
} from '../actions/activeCharacters'
import { getMessages } from './messages'

export const getActiveCharacters = (reduxState) => {
    const activeCharacters = (reduxState && reduxState.activeCharacters) || {}
    return objectMap(activeCharacters, ({
        state,
        ...rest }) => ({
            ...rest,
            state,
            isSubscribing: state === ACTIVE_CHARACTER_FSM_SUBSCRIBING,
            isSubscribed: [
                ACTIVE_CHARACTER_FSM_SUBSCRIBED,
                ACTIVE_CHARACTER_FSM_CONNECTING,
                ACTIVE_CHARACTER_FSM_CONNECTED,
                ACTIVE_CHARACTER_FSM_RECONNECTING
            ].includes(state),
            isConnecting: state === ACTIVE_CHARACTER_FSM_CONNECTING,
            isConnected: [ACTIVE_CHARACTER_FSM_RECONNECTING, ACTIVE_CHARACTER_FSM_CONNECTED].includes(state)
        }))
}

export const getActiveCharacterState = (CharacterId) => (reduxState) => {
    const { state = ACTIVE_CHARACTER_FSM_INVALID } = ((reduxState && reduxState.activeCharacters) ?? {})[CharacterId] ?? {}
    return state
}

export const getSubscribedCharacterIds = (state) => {
    const myCharacters = state.player?.Characters ?? []
    const activeCharacters = getActiveCharacters(state)
    return myCharacters.filter((characterId) => (activeCharacters[characterId]?.isSubscribed))
}

export const getActiveCharacterInPlayMessages = (CharacterId) => (state) => {
    const messages = getMessages(state)
    return messages
        .filter(({ Target, ThreadId }) => (Target === CharacterId && ThreadId === undefined))
}