import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods'
import { SETTINGS_UPDATE } from '../actions/settings'

export const reducer = (state = { ChatPrompt: 'What do you do?' }, action) => {
    const { type: actionType = 'NOOP', data = [] } = action || {}
    switch (actionType) {
        case SETTINGS_UPDATE:
            return {
                ...state,
                ...data
            }
        case NEIGHBORHOOD_UPDATE:
            return data
                .filter(({ Settings }) => (Settings))
                .map(({ Settings }) => (Settings))
                .reduce((previous, { ChatPrompt }) => ({ ...previous, ChatPrompt }), state)
        default: return state
    }
}

export default reducer