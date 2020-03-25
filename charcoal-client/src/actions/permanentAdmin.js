import { HTTPS_ADDRESS } from '../config'
import { activateRoomDialog } from './UI/roomDialog'

export const fetchAndOpenRoomDialog = (roomId) => (dispatch) => {
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