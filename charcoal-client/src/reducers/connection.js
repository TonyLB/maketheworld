import { CONNECTION_REGISTER } from '../actions/connection.js'

export const reducer = (state = '', action) => {
    const { type: actionType = 'NOOP', payload = '' } = action || {}
    switch (actionType) {
        case CONNECTION_REGISTER:
            const { connectionId } = payload
            return connectionId
        default: return state
    }
}

export default reducer