import { API, graphqlOperation } from 'aws-amplify'
import { moveCharacter as moveCharacterGraphQL, updateMessages } from '../../graphql/mutations'
import { v4 as uuidv4 } from 'uuid'

import { getActiveCharactersInRoom } from '../../selectors/charactersInPlay'
import { getCurrentRoom, getVisibleExits, getCurrentName, getCurrentRoomId } from '../../selectors/activeCharacter'
import { getPermanentHeaders } from '../../selectors/permanentHeaders'

import { getCharacters } from '../../selectors/characters'

export const moveCharacter = (CharacterId) => ({ ExitName, RoomId }) => (dispatch, getState) => {
    const state = getState()
    const characters = getCharacters(state)
    const permanentHeaders = getPermanentHeaders(state)
    const destinationRoom = RoomId
        ? {
            ...permanentHeaders[RoomId],
            Exits: getVisibleExits(CharacterId)(state, RoomId)
        }
        : {
            ...getCurrentRoom(CharacterId)(state),
            Exits: getVisibleExits(CharacterId)(state)
        }
    const currentName = getCurrentName(CharacterId)(state)
    const currentRoomId = getCurrentRoomId(CharacterId)(state)
    const currentRoomCharacters = (currentRoomId && getActiveCharactersInRoom({ currentRoomId })(state).map(({ CharacterId }) => (CharacterId))) || []
    const destinationRoomCharacters = RoomId && getActiveCharactersInRoom({ RoomId })(state)
    if (CharacterId) {
        const updates = { Updates: [
            {
                putMessage: {
                    MessageId: uuidv4(),
                    RoomId,
                    Characters: [ ...currentRoomCharacters, CharacterId],
                    DisplayProtocol: "World",
                    WorldMessage: {
                        Message: `${currentName} left by the ${ExitName} exit.`
                    }
                }
            },
            {
                putMessage: {
                    MessageId: uuidv4(),
                    TimeOffset: 1,
                    Characters: [CharacterId],
                    DisplayProtocol: "RoomDescription",
                    RoomDescription: {
                        RoomId,
                        Description: destinationRoom.Description,
                        Name: destinationRoom.Name,
                        Ancestry: destinationRoom.Ancestry,
                        Exits: destinationRoom.Exits.map(({ Name, RoomId, Visibility }) => ({ Name, RoomId, Visibility })),
                        Characters: [characters[CharacterId], ...destinationRoomCharacters].map(({ CharacterId, Name, Pronouns, FirstImpression, OneCoolThing, Outfit }) => ({ CharacterId, Name, Pronouns, FirstImpression, OneCoolThing, Outfit }))
                    }
                }
            },
            {
                putMessage: {
                    MessageId: uuidv4(),
                    TimeOffset: 2,
                    RoomId,
                    Characters: [ ...((destinationRoomCharacters || []).map(({ CharacterId }) => (CharacterId))), CharacterId],
                    DisplayProtocol: "World",
                    WorldMessage: {
                        Message: `${currentName} has arrived.`
                    }
                }
            }
        ]}
        console.log(`Updates: ${JSON.stringify(updates, null, 4)}`)
        const messagePromise = API.graphql(graphqlOperation(updateMessages, updates))

        return Promise.all([
                messagePromise,
                API.graphql(graphqlOperation(moveCharacterGraphQL, {
                    RoomId,
                    CharacterId
                }))
            ])
            .catch((err) => { console.log(err)})

    }    
}

export default moveCharacter