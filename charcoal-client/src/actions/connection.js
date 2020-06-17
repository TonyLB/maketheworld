import { API, graphqlOperation } from 'aws-amplify'
import { disconnectCharacterInPlay } from '../graphql/mutations'

import { getCharacterId } from '../selectors/connection'

export const CONNECTION_REGISTER = 'CONNECTION_REGISTER'
export const DISCONNECT_REGISTER = 'DISCONNECT_REGISTER'

export const connectionRegister = ({ characterId, roomId }) => (dispatch, getState) => {
    dispatch({
        type: CONNECTION_REGISTER,
        payload: {
            characterId,
            roomId
        }
    })
}

export const disconnectRegister = {
    type: DISCONNECT_REGISTER
}

export const disconnect = () => (dispatch, getState) => {
    const state = getState()
    const currentCharacterId = getCharacterId(state)
    if (currentCharacterId) {
        API.graphql(graphqlOperation(disconnectCharacterInPlay, { CharacterId: currentCharacterId }))
    }
    dispatch(disconnectRegister)
}