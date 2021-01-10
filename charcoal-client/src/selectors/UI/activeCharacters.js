import { objectMap } from '../../lib/objects'
import {
    ACTIVE_CHARACTER_FSM_INVALID,
    ACTIVE_CHARACTER_FSM_SUBSCRIBING,
    ACTIVE_CHARACTER_FSM_SUBSCRIBED,
    ACTIVE_CHARACTER_FSM_CONNECTING,
    ACTIVE_CHARACTER_FSM_CONNECTED,
    ACTIVE_CHARACTER_FSM_RECONNECTING
} from '../../actions/UI/activeCharacters'

export const getActiveCharactersUI = (state) => {
    const activeCharacters = (state && state.UI?.activeCharacters) || {}
    return objectMap(activeCharacters, ({
        state,
        ...rest }) => ({
            ...rest,
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

export const getActiveCharacterState = (CharacterId) => (state) => {
    const { state:fsmState = ACTIVE_CHARACTER_FSM_INVALID } = ((state && state.UI?.activeCharacters) ?? {})[CharacterId] ?? {}
    return fsmState
}