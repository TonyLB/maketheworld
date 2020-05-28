import {
    RECEIVE_CHARACTER_CHANGES
} from '../actions/characters.js'

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", characterChanges = [] } = action
    switch (actionType) {
        case RECEIVE_CHARACTER_CHANGES:
            return characterChanges.reduce((previous, { CharacterId, ...rest }) => ({
                ...previous,
                [CharacterId]: {
                    ...(previous[CharacterId] || {}),
                    CharacterId,
                    ...rest
                }
            }), state)
        default: return state
    }
}

export default reducer