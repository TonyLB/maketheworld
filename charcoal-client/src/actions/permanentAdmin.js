import { API, graphqlOperation } from 'aws-amplify'
import { getNeighborhood, getRoom } from '../graphql/queries'
import { updatePermanents } from '../graphql/mutations'

import { fetchAllNeighborhoods } from './neighborhoods'
import { activateRoomDialog, closeRoomDialog } from './UI/roomDialog'
import { activateWorldDialog } from './UI/worldDialog'
import { activateNeighborhoodDialog, closeNeighborhoodDialog } from './UI/neighborhoodDialog'
import { getCharacterId } from '../selectors/connection'
import { getPermanentHeaders  } from '../selectors/permanentHeaders'

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
        Retired,
        Exits = [],
        Entries = []
    }) => (dispatch) => {
    return API.graphql(graphqlOperation(updatePermanents, { Updates: [ { putRoom: {
            PermanentId,
            ParentId,
            Name,
            Description,
            Retired,
            Exits,
            Entries
        }}]}))
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
            ContextMapId,
            Name,
            Description,
            Visibility,
            Topology,
            Grants
        }) => ({
            neighborhoodId: PermanentId,
            type: Type,
            parentId: ParentId,
            mapId: ContextMapId,
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
    const { neighborhoodId, parentId, mapId, name, description, visibility, topology = 'Dead-End', retired = false, grants=[] } = neighborhoodData
    if (CharacterId) {
        return API.graphql(graphqlOperation(updatePermanents, { Updates: [ { putNeighborhood:
                {
                    CharacterId,
                    PermanentId: neighborhoodId,
                    ParentId: parentId,
                    ContextMapId: mapId,
                    Name: name,
                    Description: description,
                    Visibility: visibility,
                    Topology: topology,
                    Retired: retired,
                    Grants: grants
                }
            }]}))
        .then(() => dispatch(closeNeighborhoodDialog()))
        .catch((err) => { console.log(err)})
    }
}

export const setNeighborhoodRetired = ({ PermanentId, Retired }) => (dispatch, getState) => {
    const state = getState()
    const permanentHeaders = getPermanentHeaders(state)
    const CharacterId = getCharacterId(state)
    const { Name, Description, ParentId, ContextMapId, Visibility, Topology, Grants } = permanentHeaders[PermanentId]
    if (Name) {
        return API.graphql(graphqlOperation(updatePermanents, { Updates: [{ putNeighborhood:
            {
                CharacterId,
                PermanentId,
                ParentId,
                ContextMapId,
                Name,
                Description,
                Visibility,
                Topology,
                Retired,
                Grants: Grants || []
            }
        }]}))
        .catch((err) => { console.log(err)})
    }
}

export const setRoomRetired = ({ PermanentId, Retired }) => (dispatch, getState) => {
    const state = getState()
    const permanentHeaders = getPermanentHeaders(state)
    const { Name, Description, ParentId, Visibility, Exits, Entries } = permanentHeaders[PermanentId]
    if (Name) {
        return API.graphql(graphqlOperation(updatePermanents, { Updates: [ { putRoom: {
            PermanentId,
            ParentId,
            Name,
            Description,
            Visibility,
            Retired,
            Exits,
            Entries
        } }]}))
        .catch((err) => { console.log(err)})
    }
}
