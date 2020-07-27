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
    .then(({ addCharacterInPlay = [] }) => (addCharacterInPlay))
    .then((Items) => ((Items && Items[0]) || {}))
    .then((result) => {
        console.log(`RegisterCharacter results: ${JSON.stringify(result, null, 4)}`)
        return result
    })
    .then(({ CharacterInPlay = {} }) => CharacterInPlay)
    .then(({ CharacterId, RoomId }) => {
        dispatch(connectionRegister({ characterId: CharacterId, roomId: RoomId }))
        dispatch(setName(name))
    })

}
