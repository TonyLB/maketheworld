import { API, graphqlOperation } from 'aws-amplify'
import { v4 as uuidv4 } from 'uuid'
import { getNeighborhood, getRoom } from '../graphql/queries'
import { updatePermanents } from '../graphql/mutations'

import { activateRoomDialog, closeRoomDialog } from './UI/roomDialog'
import { activateWorldDialog } from './UI/worldDialog'
import { activateNeighborhoodDialog, closeNeighborhoodDialog } from './UI/neighborhoodDialog'
import { getPermanentHeaders  } from '../selectors/permanentHeaders'
import { getGrantsByResource } from '../selectors/grants'
import { getCharacterId } from '../selectors/connection'

export const fetchAndOpenRoomDialog = (roomId, nested=false) => (dispatch, getState) => {
    const { exits } = getState()

    return API.graphql(graphqlOperation(getRoom, { 'PermanentId': roomId }))
        .then(({ data }) => (data || {}))
        .then(({ getRoom }) => (getRoom || {}))
        .then(({ PermanentId, ...rest }) => dispatch(activateRoomDialog({
            nested,
            RoomId: PermanentId,
            ...rest,
            Exits: exits.filter(({ FromRoomId }) => (roomId === FromRoomId)).map(({ ToRoomId, Name }) => ({ RoomId: ToRoomId, Name })),
            Entries: exits.filter(({ ToRoomId }) => (roomId === ToRoomId)).map(({ FromRoomId, Name }) => ({ RoomId: FromRoomId, Name }))
        })))
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
    }) => (dispatch, getState) => {
    const { exits = [] } = getState()
    const finalExits = [
        ...(Exits.map(({ RoomId: ToRoomId, Name }) => ({ FromRoomId: PermanentId, ToRoomId, Name }))),
        ...(Entries.map(({ RoomId: FromRoomId, Name }) => ({ ToRoomId: PermanentId, FromRoomId, Name })))
    ]
    const existingExits = exits.filter(({ FromRoomId, ToRoomId }) => (FromRoomId === PermanentId || ToRoomId === PermanentId))
    const exitsToPut = finalExits.filter((exit) => (!existingExits.find((compare) => (compare.FromRoomId === exit.FromRoomId && compare.ToRoomId === exit.ToRoomId && compare.Name === exit.Name))))
    const exitsToDelete = existingExits.filter((exit) => (!finalExits.find((compare) => (compare.FromRoomId === exit.FromRoomId && compare.ToRoomId === exit.ToRoomId))))
    return API.graphql(graphqlOperation(updatePermanents, { Updates: [
            { putRoom: {
                PermanentId,
                ParentId,
                Name,
                Description,
                Retired
            }},
            ...(exitsToDelete.map((exit) => ({ deleteExit: exit }))),
            ...(exitsToPut.map((exit) => ({ putExit: exit })))
        ]}))
        .then(() => dispatch(closeRoomDialog()))
        .catch((err) => { console.log(err)})
}

export const fetchAndOpenWorldDialog = () => (dispatch) => {
    dispatch(activateWorldDialog())
}

export const fetchAndOpenNeighborhoodDialog = (neighborhoodId, nested=false) => (dispatch, getState) => {
    const state = getState()
    const Grants = getGrantsByResource(state)[neighborhoodId]
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
            Topology
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
    const myCharacterId = getCharacterId(state)
    const GrantsByResource = getGrantsByResource(state)
    const { neighborhoodId, parentId, mapId, name, description, visibility, topology = 'Dead-End', retired = false, grants=[] } = neighborhoodData
    const PermanentId = neighborhoodId || uuidv4()
    const currentGrants = GrantsByResource[neighborhoodId]
    const grantsToRevoke = currentGrants.filter(({ CharacterId }) => (!grants.find((grant) => (grant.CharacterId === CharacterId))))
    const grantsToPut = grants.filter(({ CharacterId, Roles, Actions }) => (!currentGrants.find((grant) => (grant.CharacterId === CharacterId && grant.Actions === Actions && grant.Roles === Roles))))
    const ownGrants = (neighborhoodId || grants.find(({ CharacterId }) => (CharacterId === myCharacterId))) ? [] : [ { CharacterId: myCharacterId, Roles: 'ADMIN' } ]
    return API.graphql(graphqlOperation(updatePermanents, { Updates: [
            { putNeighborhood:
                {
                    PermanentId,
                    ParentId: parentId,
                    ContextMapId: mapId,
                    Name: name,
                    Description: description,
                    Visibility: visibility,
                    Topology: topology,
                    Retired: retired
                }
            },
            ...(grantsToRevoke.map(({ CharacterId }) => ({
                revokeGrant: { CharacterId, Resource: PermanentId }
            }))),
            ...([ ...grantsToPut, ...ownGrants ].map((grant) => ({
                putGrant: {
                    ...grant,
                    Resource: PermanentId
                }
            })))
        ]
    }))
    .then(() => dispatch(closeNeighborhoodDialog()))
    .catch((err) => { console.log(err)})
}

export const setNeighborhoodRetired = ({ PermanentId, Retired }) => (dispatch, getState) => {
    const state = getState()
    const permanentHeaders = getPermanentHeaders(state)
    const { Name, Description, ParentId, ContextMapId, Visibility, Topology } = permanentHeaders[PermanentId]
    if (Name) {
        return API.graphql(graphqlOperation(updatePermanents, { Updates: [{ putNeighborhood:
            {
                PermanentId,
                ParentId,
                ContextMapId,
                Name,
                Description,
                Visibility,
                Topology,
                Retired
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
