import { PLAYER_UPDATE } from '../actions/communicationsLayer/appSyncSubscriptions/playerSubscription'

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", data = {} } = action
    switch (actionType) {
        case PLAYER_UPDATE:
            return {
                ...state,
                ...data
            }
        default: return state
    }
}

export default reducer