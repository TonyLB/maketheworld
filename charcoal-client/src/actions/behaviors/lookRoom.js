import { receiveMessage } from '../messages'
import { getActiveCharactersInRoom } from '../../selectors/charactersInPlay'
import { getCharacterId } from '../../selectors/connection'
import { getCurrentRoom, getVisibleExits } from '../../selectors/currentRoom'

export const lookRoom = (props) => (dispatch, getState) => {
    const { Recap = false, showNeighborhoods = false, previousAncestry = '' } = props || {}
    const state = getState()
    const { permanentHeaders = {} } = state
    const currentRoom = {
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
                    protocol: 'neighborhoodDescription',
                    Description: neighborhoodData.description,
                    Name: neighborhoodData.name,
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
            Exits: currentRoom.Exits,
            Players,
            ...( Recap ? { Recap: currentRoom.Recap } : {})
        }
        dispatch(receiveMessage({
            protocol: 'roomDescription',
            ...roomDescription
        }))
    }
    else {
        console.log('No currentRoom data!')
    }
}

export default lookRoom