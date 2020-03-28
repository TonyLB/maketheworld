import { HTTPS_ADDRESS } from '../config'
import { fetchAllNeighborhoods } from './neighborhoods'
import { activateRoomDialog, closeRoomDialog } from './UI/roomDialog'
import { activateWorldDialog } from './UI/worldDialog'
import { activateNeighborhoodDialog, closeNeighborhoodDialog } from './UI/neighborhoodDialog'

export const fetchAndOpenRoomDialog = (roomId, nested=false) => (dispatch) => {
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
        .then(response => dispatch(activateRoomDialog({ nested, ...response })))
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

export const fetchAndOpenNeighborhoodDialog = (neighborhoodId, nested=false) => (dispatch) => {
    return fetch(`${HTTPS_ADDRESS}/neighborhood/${neighborhoodId}`,{
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
        .then(response => dispatch(activateNeighborhoodDialog({ nested, ...response })))
        .catch((err) => { console.log(err)})
}

export const putAndCloseNeighborhoodDialog = (neighborhoodData) => (dispatch) => {
    return fetch(`${HTTPS_ADDRESS}/neighborhood`,{
        method: 'PUT',
        body: JSON.stringify(neighborhoodData),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw response.error
        }
    })
    .then(() => dispatch(closeNeighborhoodDialog()))
    .catch((err) => { console.log(err)})
}

