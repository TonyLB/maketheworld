import { receiveMessage } from '../messages'
import { getActiveCharactersInRoom } from '../../selectors/charactersInPlay'
import { getCharacterId } from '../../selectors/connection'
import { getCurrentRoom, getVisibleExits } from '../../selectors/currentRoom'
import { getPermanentHeaders } from '../../selectors/permanentHeaders'

export const lookRoom = (props) => (dispatch, getState) => {
    const { RoomId, Recap = [], showNeighborhoods = false, previousAncestry = '' } = props || {}
    const state = getState()
    const permanentHeaders = getPermanentHeaders(state)
    const currentRoom = RoomId
        ? {
            ...permanentHeaders[RoomId],
            Exits: getVisibleExits(state, RoomId)
        }
        : {
            ...getCurrentRoom(state),
            Exits: getVisibleExits(state)
        }
    const currentAncestry = currentRoom.Ancestry
    const neighborhoodList = (showNeighborhoods && currentAncestry && currentAncestry
        .split(':')
        .slice(0, -1)
        .reduce(({ accumulatedAncestry, ancestryList }, item) => ({
            accumulatedAncestry: `${accumulatedAncestry}:${item}`,
            ancestryList: ((previousAncestry && previousAncestry.startsWith(accumulatedAncestry))
                ? ancestryList
                : [ ...ancestryList, `${item}`])
        }), { accumulatedAncestry: '', ancestryList: [] }).ancestryList) || []
    const myCharacterId = getCharacterId(state)

    if (currentRoom && currentRoom.Name) {
        neighborhoodList.forEach((NeighborhoodId) => {
            const neighborhoodData = permanentHeaders && permanentHeaders[NeighborhoodId]
            if (neighborhoodData) {
                dispatch(receiveMessage({
                    DisplayProtocol: 'neighborhoodDescription',
                    Description: neighborhoodData.Description,
                    Name: neighborhoodData.Name,
                    NeighborhoodId
                }))
            }
        })
        const Players = getActiveCharactersInRoom({ RoomId: currentRoom.PermanentId, myCharacterId })(state)
        const roomDescription = {
            Description: currentRoom.Description,
            Name: currentRoom.Name,
            Ancestry: currentRoom.Ancestry,
            RoomId: currentRoom.RoomId,
            ParentId: currentRoom.ParentId,
            Exits: currentRoom.Exits,
            Players,
            ...( Recap ? { Recap } : {})
        }
        dispatch(receiveMessage({
            DisplayProtocol: 'roomDescription',
            ...roomDescription
        }))
    }
    else {
        console.log('No currentRoom data!')
    }
}

export default lookRoom