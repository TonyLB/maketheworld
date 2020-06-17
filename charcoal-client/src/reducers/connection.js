import { CONNECTION_REGISTER, DISCONNECT_REGISTER } from '../actions/connection.js'

export const reducer = (state = '', action) => {
    const { type: actionType = 'NOOP', payload = '' } = action || {}
    switch (actionType) {
        case CONNECTION_REGISTER:
            const { characterId } = payload
            return {
                characterId
            }
        case DISCONNECT_REGISTER:
            return {}
        default: return state
    }
}

export default reducer