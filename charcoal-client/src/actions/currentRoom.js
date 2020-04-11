import { API, graphqlOperation } from 'aws-amplify'
import { getRoom } from '../graphql/queries'

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
            .then(({ getRoom }) => (getRoom || []))
            .then((payload) => {
                dispatch(fetchCurrentRoomSuccess(payload))
                return payload
            })
    }
    else {
        return Promise.resolve({})
    }
}
