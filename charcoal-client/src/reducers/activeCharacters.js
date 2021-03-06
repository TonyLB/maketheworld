import {
    ACTIVATE_CHARACTER,
    DEACTIVATE_CHARACTER,
    ACTIVE_CHARACTER_FSM_INITIAL,
    ACTIVE_CHARACTER_SUBSCRIBE_ATTEMPT,
    ACTIVE_CHARACTER_FSM_SUBSCRIBING,
    ACTIVE_CHARACTER_SUBSCRIBE_SUCCESS,
    ACTIVE_CHARACTER_FSM_SUBSCRIBED,
    ACTIVE_CHARACTER_SUBSCRIBE_FAIL,
    ACTIVE_CHARACTER_CONNECT_ATTEMPT,
    ACTIVE_CHARACTER_FSM_CONNECTING,
    ACTIVE_CHARACTER_CONNECT_SUCCESS,
    ACTIVE_CHARACTER_FSM_CONNECTED,
    ACTIVE_CHARACTER_CONNECT_FAIL,
    ACTIVE_CHARACTER_RECONNECT_ATTEMPT,
    ACTIVE_CHARACTER_FSM_RECONNECTING
} from '../actions/activeCharacters'

export const reducer = (state = {}, action = {}) => {
    const {
        type,
        CharacterId = ''
    } = action

    const transitionHelper = (endState, props = {}) => {
        if (CharacterId && state[CharacterId]) {
            return {
                ...state,
                [CharacterId]: {
                    ...state[CharacterId],
                    state: endState,
                    ...props
                }
            }
        }
        else {
            return state
        }

    }

    switch (type) {

        case ACTIVATE_CHARACTER:
            if (CharacterId && !state[CharacterId]) {
                return {
                    ...state,
                    [CharacterId]: {
                        CharacterId,
                        state: ACTIVE_CHARACTER_FSM_INITIAL
                    }
                }
            }
            else {
                return state
            }

        case DEACTIVATE_CHARACTER:
            if (CharacterId) {
                return Object.entries(state)
                    .filter(([key]) => (key !== CharacterId))
                    .reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {})
            }
            else {
                return state
            }

        case ACTIVE_CHARACTER_SUBSCRIBE_ATTEMPT:
            return transitionHelper(ACTIVE_CHARACTER_FSM_SUBSCRIBING)

        case ACTIVE_CHARACTER_SUBSCRIBE_SUCCESS:
            return transitionHelper(ACTIVE_CHARACTER_FSM_SUBSCRIBED, { subscriptions: { messages: action.subscription } })

        case ACTIVE_CHARACTER_SUBSCRIBE_FAIL:
            return transitionHelper(ACTIVE_CHARACTER_FSM_INITIAL)

        case ACTIVE_CHARACTER_CONNECT_ATTEMPT:
            return transitionHelper(ACTIVE_CHARACTER_FSM_CONNECTING)

        case ACTIVE_CHARACTER_CONNECT_SUCCESS:
            return transitionHelper(ACTIVE_CHARACTER_FSM_CONNECTED, { connection: action.connection })

        case ACTIVE_CHARACTER_CONNECT_FAIL:
            return transitionHelper(ACTIVE_CHARACTER_FSM_SUBSCRIBED)

        case ACTIVE_CHARACTER_RECONNECT_ATTEMPT:
            return transitionHelper(ACTIVE_CHARACTER_FSM_RECONNECTING)

        default:
            return state
    }
}

export default reducer