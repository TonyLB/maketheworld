import { API, graphqlOperation } from 'aws-amplify'
import { getNeighborhood } from '../graphql/queries'
import { putNeighborhood } from '../graphql/mutations'

import { HTTPS_ADDRESS } from '../config'
import { fetchAllNeighborhoods, neighborhoodMerge } from './neighborhoods'
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
        return response.json()
    })
    .then((permanentId) => ({
        ...roomData,
        type: 'ROOM',
        permanentId,
        ancestry: roomData.parentAncestry ? `${roomData.parentAncestry}:${permanentId}` : permanentId
    }))
    .then((roomData) => dispatch(neighborhoodMerge([roomData])))
    .then(() => dispatch(closeRoomDialog()))
    .catch((err) => { console.log(err)})
}

export const fetchAndOpenWorldDialog = () => (dispatch) => {
    dispatch(fetchAllNeighborhoods())
    dispatch(activateWorldDialog())
}

export const fetchAndOpenNeighborhoodDialog = (neighborhoodId, nested=false) => (dispatch) => {
    return API.graphql(graphqlOperation(getNeighborhood, { 'PermanentId': neighborhoodId }))
        .then(({ data }) => (data || {}))
        .then(({ getNeighborhood }) => (getNeighborhood || {}))
        .then(({
            PermanentId,
            Type,
            ParentId,
            Ancestry,
            Name,
            Description
        }) => ({
            neighborhoodId: PermanentId,
            type: Type,
            parentId: ParentId,
            ancestry: Ancestry,
            name: Name,
            description: Description
        }))
        .then(response => dispatch(activateNeighborhoodDialog({ nested, ...response })))
        .catch((err) => { console.log(err)})
}

export const putAndCloseNeighborhoodDialog = (neighborhoodData) => (dispatch) => {
    const { neighborhoodId, parentId, name, description } = neighborhoodData
    return API.graphql(graphqlOperation(putNeighborhood, {
            PermanentId: neighborhoodId,
            ParentId: parentId,
            Name: name,
            Description: description
        }))
    .then(() => dispatch(closeNeighborhoodDialog()))
    .catch((err) => { console.log(err)})
}

