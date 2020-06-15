import {
    RECEIVE_CHARACTER_CHANGES
} from '../actions/characters.js'
import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods'

const mergeCharacter = (previous, { CharacterId, ...rest }) => ({
    ...previous,
    [CharacterId]: {
        ...(previous[CharacterId] || {}),
        CharacterId,
        ...rest
    }
})

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", characterChanges = [] } = action
    switch (actionType) {
        case RECEIVE_CHARACTER_CHANGES:
            return characterChanges.reduce(mergeCharacter, state)
        case NEIGHBORHOOD_UPDATE:
            return action.data
                .filter(({ Character }) => (Character))
                .map(({ Character }) => (Character))
                .reduce(mergeCharacter, state)
        default: return state
    }
}

export default reducer