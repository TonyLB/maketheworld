import { API, graphqlOperation } from 'aws-amplify'
import { moveCharacter as moveCharacterGraphQL } from '../../graphql/mutations'

export const moveCharacter = (RoomId) => (dispatch, getState) => {
    const { connection } = getState()
    if (connection.characterId) {
        return API.graphql(graphqlOperation(moveCharacterGraphQL, {
            RoomId,
            CharacterId: connection.characterId
        }))
        .catch((err) => { console.log(err)})
    }    
}

export default moveCharacter