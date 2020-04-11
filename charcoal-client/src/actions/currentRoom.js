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

export const fetchCurrentRoom = () => (dispatch, getState) => {
    const { connection, currentRoom } = getState()

    if (!(currentRoom && currentRoom.meta && currentRoom.meta.fetching) && connection.roomId){
        dispatch(fetchCurrentRoomAttempt())
        return API.graphql(graphqlOperation(getRoom, { PermanentId: connection.roomId }))
            .then(({ data }) => (data || {}))
            .then(({ getRoom }) => (getRoom || []))
            .then((payload) => (dispatch(fetchCurrentRoomSuccess(payload))))
    }
}
