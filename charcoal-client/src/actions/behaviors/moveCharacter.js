import { API, graphqlOperation } from 'aws-amplify'
import { moveCharacter as moveCharacterGraphQL } from '../../graphql/mutations'

import { sendWorldMessage } from '../messages'

import { getCurrentName, getCurrentRoomId } from '../../selectors/connection'

export const moveCharacter = ({ ExitName, RoomId }) => (dispatch, getState) => {
    const state = getState()
    const { connection } = state
    if (connection.characterId) {
        const currentName = getCurrentName(state)
        const currentRoomId = getCurrentRoomId(state)
        dispatch(sendWorldMessage({ RoomId: currentRoomId, Message: `${currentName} left by the ${ExitName} exit.` }))
            .then(() => (API.graphql(graphqlOperation(moveCharacterGraphQL, {
                RoomId,
                CharacterId: connection.characterId
            }))))
        //
        // The "character has arrived" message, view of the room, and adjustment of subscriptions will be
        // handled as a response to the CharactersInPlay subscription update (so as to guarantee no race conditions)
        //
        .catch((err) => { console.log(err)})
    }    
}

export default moveCharacter