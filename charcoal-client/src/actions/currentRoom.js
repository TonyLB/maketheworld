import { API, graphqlOperation } from 'aws-amplify'
import { getRoom, getRoomRecap } from '../graphql/queries'

export const FETCH_CURRENT_ROOM_SUCCESS = 'FETCH_CURRENT_ROOM_SUCCESS'
export const FETCH_CURRENT_ROOM_ATTEMPT = 'FETCH_CURRENT_ROOM_ATTEMPT'

export const fetchCurrentRoomAttempt = () => ({
    type: FETCH_CURRENT_ROOM_ATTEMPT
})

export const fetchCurrentRoomSuccess = (payload) => ({
    type: FETCH_CURRENT_ROOM_SUCCESS,
    payload
})

export const fetchCurrentRoom = (overrideRoomId) => (dispatch, getState) => {
    const { connection, charactersInPlay, currentRoom } = getState()

    const currentRoomId = overrideRoomId || (connection && connection.characterId && charactersInPlay && charactersInPlay[connection.characterId] && charactersInPlay[connection.characterId].RoomId)
    if (!(currentRoom && currentRoom.meta && currentRoom.meta.fetching) && currentRoomId){
        dispatch(fetchCurrentRoomAttempt())
        return API.graphql(graphqlOperation(getRoom, { PermanentId: currentRoomId }))
            .then(({ data }) => (data || {}))
            .then(({ getRoom }) => (getRoom || {}))
            .then((room) => {
                const getRecap = API.graphql(graphqlOperation(getRoomRecap, { PermanentId: currentRoomId }))
                    .then(({ data }) => (data || {}))
                    .then(({ getRoomRecap }) => (getRoomRecap || []))
                return getRecap.then((Recap) => {
                    const finalResult = { ...room, Recap }
                    dispatch(fetchCurrentRoomSuccess(finalResult))
                    return finalResult
                })
            })
    }
    else {
        return Promise.resolve()
    }
}
