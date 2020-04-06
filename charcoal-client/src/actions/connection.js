import { addCharacterInPlay } from './characters.js'

export const CONNECTION_REGISTER = 'CONNECTION_REGISTER'

export const connectionRegister = ({ characterId, connectionId }) => (dispatch) => {
    dispatch(addCharacterInPlay({ characterId, connectionId }))
    return ({
        type: CONNECTION_REGISTER,
        payload: { connectionId }
    })
}
