import { API, graphqlOperation } from 'aws-amplify'
import { moveCharacter as moveCharacterGraphQL } from '../../graphql/mutations'

import { sendMessage } from '../messages'

import { getCurrentName, getCurrentRoomId } from '../../selectors/connection'
import { getMyCurrentCharacter } from '../../selectors/myCharacters'

export const goHome = () => (dispatch, getState) => {
    const state = getState()
    const { connection } = state
    const currentCharacter = getMyCurrentCharacter(state)
    const homeId = (currentCharacter && currentCharacter.HomeId) || 'VORTEX'
    if (connection.characterId) {
        const currentName = getCurrentName(state)
        const currentRoomId = getCurrentRoomId(state)
        dispatch(sendMessage({ RoomId: currentRoomId, Message: `${currentName} went home.` }))
            .then(() => (API.graphql(graphqlOperation(moveCharacterGraphQL, {
                RoomId: homeId,
                CharacterId: connection.characterId
            }))))
            //
            // The "character has arrived" message, view of the room, and adjustment of subscriptions will be
            // handled as a response to the CharactersInPlay subscription update (so as to guarantee no race conditions)
            //
            .catch((err) => { console.log(err)})
    }    
}

export default goHome