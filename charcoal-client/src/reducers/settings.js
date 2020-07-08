import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods'

export const reducer = (state = { ChatPrompt: 'What do you do?' }, action) => {
    const { type: actionType = 'NOOP', data = [] } = action || {}
    switch (actionType) {
        case NEIGHBORHOOD_UPDATE:
            return data
                .filter(({ Settings }) => (Settings))
                .map(({ Settings }) => (Settings))
                .reduce((previous, { ChatPrompt }) => ({ ...previous, ChatPrompt }), state)
        default: return state
    }
}

export default reducer