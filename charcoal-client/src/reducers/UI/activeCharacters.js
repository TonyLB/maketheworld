import {
    ACTIVATE_CHARACTER,
    DEACTIVATE_CHARACTER,
    ACTIVE_CHARACTER_FSM_INITIAL
} from '../../actions/UI/activeCharacters'

export const reducer = (state = {}, action = {}) => {
    const {
        type,
        CharacterId = ''
    } = action

    switch (type) {

        case ACTIVATE_CHARACTER:
            if (CharacterId && !state[CharacterId]) {
                return {
                    ...state,
                    [CharacterId]: {
                        CharacterId,
                        status: ACTIVE_CHARACTER_FSM_INITIAL
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

        default:
            return state
    }
}

export default reducer