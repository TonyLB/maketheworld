import { API, graphqlOperation } from 'aws-amplify'
import { getNeighborhoodTree } from '../graphql/queries'
import { changedNeighborhood, changedRoom } from '../graphql/subscriptions'

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
        Description
    }) => ({
        permanentId: PermanentId,
        type: Type,
        parentId: ParentId,
        ancestry: Ancestry,
        name: Name,
        description: Description
    }))))
    .then(response => dispatch(neighborhoodUpdate(response)))
    .catch((err) => { console.log(err)})
}

export const subscribePermanentHeaderChanges = () => (dispatch) => {
    const neighborhoodSubscription = API.graphql(graphqlOperation(changedNeighborhood))
        .subscribe({
            next: (neighborhoodData) => {
                const { value = {} } = neighborhoodData
                const { data = {} } = value
                const { changedNeighborhood = {} } = data
                const { PermanentId, Type, ParentId, Ancestry, Name, Description } = changedNeighborhood
                dispatch(neighborhoodUpdate([{
                    permanentId: PermanentId,
                    type: Type,
                    parentId: ParentId,
                    ancestry: Ancestry,
                    name: Name,
                    description: Description
                }]))
            }
        })
    const roomSubscription = API.graphql(graphqlOperation(changedRoom))
        .subscribe({
            next: (roomData) => {
                const { value = {} } = roomData
                const { data = {} } = value
                const { changedRoom = {} } = data
                const { PermanentId, Type, ParentId, Ancestry, Name, Description } = changedRoom
                dispatch(neighborhoodUpdate([{
                    permanentId: PermanentId,
                    type: Type,
                    parentId: ParentId,
                    ancestry: Ancestry,
                    name: Name,
                    description: Description
                }]))
            }
        })

    dispatch(addSubscription({ neighborhoods: neighborhoodSubscription }))
    dispatch(addSubscription({ rooms: roomSubscription }))
    dispatch(fetchAllNeighborhoods())
}
