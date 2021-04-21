import { getCurrentRoomId } from '../../selectors/activeCharacter'
import { socketDispatch } from '../communicationsLayer/lifeLine'

export const lookRoom = (CharacterId) => (props) => (dispatch, getState) => {
    const { RoomId, showNeighborhoods = false, previousAncestry = '' } = props || {}
    const state = getState()
    const currentRoomId = RoomId ? RoomId : getCurrentRoomId(CharacterId)(state)
    if (currentRoomId) {
        dispatch(socketDispatch('look')({ CharacterId, PermanentId: `ROOM#${currentRoomId}`}))
        //
        // TODO:  Extend the PerceptionService to include all of the more complicated functionality
        // below.
        //
        // const permanentHeaders = getPermanentHeaders(state)
        // const currentRoom = RoomId
        //     ? {
        //         ...permanentHeaders[RoomId],
        //         Exits: getVisibleExits(CharacterId)(state, RoomId)
        //     }
        //     : {
        //         ...getCurrentRoom(CharacterId)(state),
        //         Exits: getVisibleExits(CharacterId)(state)
        //     }
        // const currentAncestry = currentRoom.Ancestry
        // const neighborhoodList = (showNeighborhoods && currentAncestry && currentAncestry
        //     .split(':')
        //     .slice(0, -1)
        //     .reduce(({ accumulatedAncestry, ancestryList }, item) => ({
        //         accumulatedAncestry: `${accumulatedAncestry}:${item}`,
        //         ancestryList: ((previousAncestry && previousAncestry.startsWith(accumulatedAncestry))
        //             ? ancestryList
        //             : [ ...ancestryList, `${item}`])
        //     }), { accumulatedAncestry: '', ancestryList: [] }).ancestryList) || []
    
        // if (currentRoom && currentRoom.Name) {
        //     neighborhoodList.forEach((NeighborhoodId) => {
        //         const neighborhoodData = permanentHeaders && permanentHeaders[NeighborhoodId]
        //         if (neighborhoodData) {
        //             dispatch(receiveMessage({
        //                 Target: CharacterId,
        //                 DisplayProtocol: 'neighborhoodDescription',
        //                 Description: neighborhoodData.Description,
        //                 Name: neighborhoodData.Name,
        //                 NeighborhoodId
        //             }))
        //         }
        //     })
        //     const Characters = getActiveCharactersInRoom({ RoomId: currentRoom.PermanentId, myCharacterId: CharacterId })(state)
        //     const RoomDescription = {
        //         Description: currentRoom.Description,
        //         Name: currentRoom.Name,
        //         Ancestry: currentRoom.Ancestry,
        //         RoomId: currentRoom.PermanentId,
        //         Exits: currentRoom.Exits.map(({ RoomId, Name, Visibility }) => ({ RoomId, Name, Visibility })),
        //         Characters: Characters.map(({ CharacterId, Name, Pronouns, FirstImpression, OneCoolThing, Outfit }) => ({ CharacterId, Name, Pronouns, FirstImpression, OneCoolThing, Outfit }))
        //     }
        //     return API.graphql(graphqlOperation(updateMessages, { Updates: [{
        //         putMessage: {
        //             MessageId: uuidv4(),
        //             Characters: [CharacterId],
        //             DisplayProtocol: "RoomDescription",
        //             RoomDescription
        //         }
        //     }]}))
        // }
        // else {
        //     console.log('No currentRoom data!')
    }
}

export default lookRoom