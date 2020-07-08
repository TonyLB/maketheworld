import { API, graphqlOperation } from 'aws-amplify'
import { getNeighborhoodTree, syncPermanents as syncPermanentsGQL } from '../graphql/queries'
import { changedPermanents } from '../graphql/subscriptions'

import { addSubscription } from './subscriptions'
import { fetchMaps } from './maps'

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
    .then(response => dispatch(neighborhoodUpdate(response)))
    .catch((err) => { console.log(err)})
}

export const syncPermanents = (dispatch) => {
    return API.graphql(graphqlOperation(syncPermanentsGQL))
        .then(({ data }) => (data || {}))
        .then(({ syncPermanents }) => (syncPermanents || []))
        .then(response => dispatch(neighborhoodUpdate(response)))
        .catch((err) => { console.log(err)})
}

export const subscribePermanentHeaderChanges = () => (dispatch) => {
    const neighborhoodSubscription = API.graphql(graphqlOperation(changedPermanents))
        .subscribe({
            next: (neighborhoodData) => {
                const { value = {} } = neighborhoodData
                const { data = {} } = value
                const { changedPermanents = [] } = data
                dispatch(neighborhoodUpdate(changedPermanents))
            }
        })

    dispatch(addSubscription({ nodes: neighborhoodSubscription }))
    dispatch(syncPermanents)
}
