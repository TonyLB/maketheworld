import {
    ADD_SUBSCRIPTION,
    REMOVE_ALL_SUBSCRIPTIONS
} from '../actions/subscriptions.js'

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP" } = action
    switch (actionType) {
        case REMOVE_ALL_SUBSCRIPTIONS:
            return {}
        case ADD_SUBSCRIPTION:
            //
            // TODO:  Create logic to check if an overwrite occurs, and unsubscribe if needed.
            //
            return {
                ...state,
                ...action.subscription
            }
        default: return state
    }
}

export default reducer