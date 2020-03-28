import { HTTPS_ADDRESS } from '../config'
import { activateRoomDialog, closeRoomDialog } from './UI/roomDialog'
import { fetchAllNeighborhoods } from './neighborhoods'
import { activateWorldDialog } from './UI/worldDialog'

export const fetchAndOpenRoomDialog = (roomId) => (dispatch) => {
    dispatch(fetchAllNeighborhoods())
    return fetch(`${HTTPS_ADDRESS}/room/${roomId}`,{
            method: 'GET',
            headers: {
                'accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw response.error
            }
            return response
        })
        .then(response => response.json())
        .then(response => dispatch(activateRoomDialog(response)))
        .catch((err) => { console.log(err)})
}

export const putAndCloseRoomDialog = (roomData) => (dispatch) => {
    return fetch(`${HTTPS_ADDRESS}/room`,{
        method: 'PUT',
        body: JSON.stringify(roomData),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw response.error
        }
    })
    .then(() => dispatch(closeRoomDialog()))
    .catch((err) => { console.log(err)})
}

export const fetchAndOpenWorldDialog = () => (dispatch) => {
    dispatch(fetchAllNeighborhoods())
    dispatch(activateWorldDialog())
}