import { UPDATE_CLIENT_SETTINGS } from '../actions/clientSettings.js'

export const reducer = (state = {}, action) => {
    const { type: actionType = 'NOOP', settings = {} } = action || {}
    switch (actionType) {
        case UPDATE_CLIENT_SETTINGS:
            return {
                ...state,
                ...settings
            }
        default: return state
    }
}

export default reducer