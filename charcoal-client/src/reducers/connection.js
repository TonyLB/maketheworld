import { CONNECTION_REGISTER } from '../actions/connection.js'

export const reducer = (state = '', action) => {
    const { type: actionType = 'NOOP', payload = '' } = action || {}
    switch (actionType) {
        case CONNECTION_REGISTER:
            const { connectionId, characterId, roomId } = payload
            return {
                connectionId,
                characterId,
                roomId
            }
        default: return state
    }
}

export default reducer