import { API, graphqlOperation } from 'aws-amplify'
import { getNeighborhood, getRoom } from '../graphql/queries'
import { putNeighborhood, putRoom } from '../graphql/mutations'

import { fetchAllNeighborhoods } from './neighborhoods'
import { activateRoomDialog, closeRoomDialog } from './UI/roomDialog'
import { activateWorldDialog } from './UI/worldDialog'
import { activateNeighborhoodDialog, closeNeighborhoodDialog } from './UI/neighborhoodDialog'
import { getCharacterId } from '../selectors/connection'

export const fetchAndOpenRoomDialog = (roomId, nested=false) => (dispatch) => {
    return API.graphql(graphqlOperation(getRoom, { 'PermanentId': roomId }))
        .then(({ data }) => (data || {}))
        .then(({ getRoom }) => (getRoom || {}))
        .then(({ PermanentId, ...rest }) => dispatch(activateRoomDialog({ nested, RoomId: PermanentId, ...rest })))
        .catch((err) => { console.log(err)})
}

export const putAndCloseRoomDialog = ({
        RoomId: PermanentId,
        Name,
        Description,
        ParentId,
        Ancestry,
        Exits = [],
        Entries = []
    }) => (dispatch) => {
    return API.graphql(graphqlOperation(putRoom, {
            PermanentId,
            ParentId,
            Ancestry,
            Name,
            Description,
            Exits,
            Entries
        }))
        .then(({ data }) => (data || {}))
        .then(({ getRoom }) => (getRoom || {}))
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
            Description,
            Visibility,
            Topology,
            Grants
        }) => ({
            neighborhoodId: PermanentId,
            type: Type,
            parentId: ParentId,
            ancestry: Ancestry,
            name: Name,
            description: Description,
            visibility: Visibility,
            topology: Topology,
            grants: Grants
        }))
        .then(response => dispatch(activateNeighborhoodDialog({ nested, ...response })))
        .catch((err) => { console.log(err)})
}

export const putAndCloseNeighborhoodDialog = (neighborhoodData) => (dispatch, getState) => {
    const state = getState()
    const CharacterId = getCharacterId(state)
    const { neighborhoodId, parentId, name, description, visibility, topology = 'Dead-End', grants=[] } = neighborhoodData
    if (CharacterId) {
        return API.graphql(graphqlOperation(putNeighborhood, {
                CharacterId,
                PermanentId: neighborhoodId,
                ParentId: parentId,
                Name: name,
                Description: description,
                Visibility: visibility,
                Topology: topology,
                Grants: grants
            }))
        .then(() => dispatch(closeNeighborhoodDialog()))
        .catch((err) => { console.log(err)})
    }
}

