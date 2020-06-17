import { API, graphqlOperation } from 'aws-amplify'
import { addCharacterInPlay } from '../graphql/mutations'

import { connectionRegister } from './connection'

export const SET_NAME = 'SET_NAME'

export const setName = (name) => ({
    type: SET_NAME,
    payload: name
})

export const registerCharacter = ({ name, characterId }) => (dispatch) => {
    return API.graphql(graphqlOperation(addCharacterInPlay, {
        CharacterId: characterId
    }))
    .then(({ data = {} }) => (data))
    .then(({ addCharacterInPlay = {} }) => (addCharacterInPlay))
    .then(({ CharacterId, RoomId }) => {
        dispatch(connectionRegister({ characterId: CharacterId, roomId: RoomId }))
        dispatch(setName(name))
    })

}
