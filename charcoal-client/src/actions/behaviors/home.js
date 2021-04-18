import { API, graphqlOperation } from 'aws-amplify'
import { moveCharacter as moveCharacterGraphQL } from '../../graphql/mutations'

import { sendWorldMessage } from '../messages'

import { getCurrentName, getCurrentRoomId } from '../../selectors/activeCharacter'
import { getMyCharacterById } from '../../selectors/myCharacters'

export const goHome = (CharacterId) => (dispatch, getState) => {
    const state = getState()
    const currentCharacter = getMyCharacterById(CharacterId)(state)
    const homeId = (currentCharacter && currentCharacter.HomeId) || 'VORTEX'
    if (CharacterId) {
        const currentName = getCurrentName(CharacterId)(state)
        const currentRoomId = getCurrentRoomId(CharacterId)(state)
        dispatch(sendWorldMessage({ RoomId: currentRoomId, Message: `${currentName} went home.` }))
            .then(() => (API.graphql(graphqlOperation(moveCharacterGraphQL, {
                RoomId: homeId,
                CharacterId
            }))))
            //
            // The "character has arrived" message, view of the room, and adjustment of subscriptions will be
            // handled as a response to the CharactersInPlay subscription update (so as to guarantee no race conditions)
            //
            .catch((err) => { console.log(err)})
    }    
}

export default goHome