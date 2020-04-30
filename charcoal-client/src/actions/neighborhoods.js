import { API, graphqlOperation } from 'aws-amplify'
import { getNeighborhoodTree } from '../graphql/queries'
import { changedNode, changedRoom } from '../graphql/subscriptions'

import { addSubscription } from './subscriptions'

export const NEIGHBORHOOD_UPDATE = 'NEIGHBORHOOD_UPDATE'
export const NEIGHBORHOOD_MERGE = 'NEIGHBORHOOD_MERGE'

export const neighborhoodUpdate = (neighborhoods) => ({
    type: NEIGHBORHOOD_UPDATE,
    data: neighborhoods
})

export const neighborhoodMerge = (permanentData) => ({
    type: NEIGHBORHOOD_MERGE,
    permanentData
})

export const fetchAllNeighborhoods = () => (dispatch) => {
    return API.graphql(graphqlOperation(getNeighborhoodTree))
    .then(({ data }) => (data || {}))
    .then(({ getNeighborhoodTree }) => (getNeighborhoodTree || []))
    .then((neighborhoodTree) => (neighborhoodTree.map(({
        PermanentId,
        Type,
        ParentId,
        Ancestry,
        Name,
        Description,
        Visibility
    }) => ({
        permanentId: PermanentId,
        type: Type,
        parentId: ParentId,
        ancestry: Ancestry,
        name: Name,
        description: Description,
        visibility: Visibility
    }))))
    .then(response => dispatch(neighborhoodUpdate(response)))
    .catch((err) => { console.log(err)})
}

export const subscribePermanentHeaderChanges = () => (dispatch) => {
    const neighborhoodSubscription = API.graphql(graphqlOperation(changedNode))
        .subscribe({
            next: (neighborhoodData) => {
                const { value = {} } = neighborhoodData
                const { data = {} } = value
                const { changedNode = {} } = data
                const { PermanentId, Type, ParentId, Ancestry, Name, Description, Visibility } = changedNode
                dispatch(neighborhoodUpdate([{
                    permanentId: PermanentId,
                    type: Type,
                    parentId: ParentId,
                    ancestry: Ancestry,
                    name: Name,
                    description: Description,
                    visibility: Visibility
                }]))
            }
        })
    const roomSubscription = API.graphql(graphqlOperation(changedRoom))
        .subscribe({
            next: (roomData) => {
                const { value = {} } = roomData
                const { data = {} } = value
                const { changedRoom = {} } = data
                const { PermanentId, Type, ParentId, Ancestry, Name, Description, Visibility } = changedRoom
                dispatch(neighborhoodUpdate([{
                    permanentId: PermanentId,
                    type: Type,
                    parentId: ParentId,
                    ancestry: Ancestry,
                    name: Name,
                    description: Description,
                    visibility: Visibility
                }]))
            }
        })

    dispatch(addSubscription({ nodes: neighborhoodSubscription }))
    dispatch(addSubscription({ rooms: roomSubscription }))
    dispatch(fetchAllNeighborhoods())
}
