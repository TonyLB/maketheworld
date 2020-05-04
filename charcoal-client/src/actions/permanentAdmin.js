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
        .then(({
            PermanentId,
            Type,
            ParentId,
            Ancestry,
            Name,
            Description,
            Exits,
            Entries
        }) => ({
            roomId: PermanentId,
            type: Type,
            parentId: ParentId,
            ancestry: Ancestry,
            name: Name,
            description: Description,
            exits: Exits.map(({ PermanentId, Name, RoomId }) => ({ permanentId: PermanentId, name: Name, roomId: RoomId })),
            entries: Entries.map(({ PermanentId, Name, RoomId }) => ({ permanentId: PermanentId, name: Name, roomId: RoomId })),
        }))
        .then(response => dispatch(activateRoomDialog({ nested, ...response })))
        .catch((err) => { console.log(err)})
}

export const putAndCloseRoomDialog = ({
        roomId: PermanentId,
        name: Name,
        description: Description,
        parentId: ParentId,
        ancestry: Ancestry,
        exits: Exits = [],
        entries: Entries = []
    }) => (dispatch) => {
    return API.graphql(graphqlOperation(putRoom, {
            PermanentId,
            ParentId,
            Ancestry,
            Name,
            Description,
            Exits: Exits.map(({
                permanentId, name, roomId
            }) => ({ PermanentId: permanentId, Name: name, RoomId: roomId })),
            Entries: Entries.map(({
                permanentId, name, roomId
            }) => ({ PermanentId: permanentId, Name: name, RoomId: roomId }))

        }))
        .then(({ data }) => (data || {}))
        .then(({ getRoom }) => (getRoom || {}))
        .then(({
            PermanentId,
            Type,
            ParentId,
            Ancestry,
            Name,
            Description,
            // Exits,
            // Entries
        }) => ({
            roomId: PermanentId,
            type: Type,
            parentId: ParentId,
            ancestry: Ancestry,
            name: Name,
            description: Description,
            // exits: Exits.map(({ PermanentId, Name, RoomId }) => ({ permanentId: PermanentId, name: Name, roomId: RoomId })),
            // entries: Entries.map(({ PermanentId, Name, RoomId }) => ({ permanentId: PermanentId, name: Name, roomId: RoomId })),
        }))
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
            Visibility
        }) => ({
            neighborhoodId: PermanentId,
            type: Type,
            parentId: ParentId,
            ancestry: Ancestry,
            name: Name,
            description: Description,
            visibility: Visibility
        }))
        .then(response => dispatch(activateNeighborhoodDialog({ nested, ...response })))
        .catch((err) => { console.log(err)})
}

export const putAndCloseNeighborhoodDialog = (neighborhoodData) => (dispatch, getState) => {
    const state = getState()
    const CharacterId = getCharacterId(state)
    const { neighborhoodId, parentId, name, description, visibility } = neighborhoodData
    if (CharacterId) {
        return API.graphql(graphqlOperation(putNeighborhood, {
                CharacterId,
                PermanentId: neighborhoodId,
                ParentId: parentId,
                Name: name,
                Description: description,
                Visibility: visibility
            }))
        .then(() => dispatch(closeNeighborhoodDialog()))
        .catch((err) => { console.log(err)})
    }
}

