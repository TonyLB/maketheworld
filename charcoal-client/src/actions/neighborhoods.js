import { API, graphqlOperation } from 'aws-amplify'
import { getNeighborhoodTree } from '../graphql/queries'
import { changedPermanents, changedRoom } from '../graphql/subscriptions'

import { addSubscription } from './subscriptions'
import { fetchMaps } from './maps'
import { fetchSettings } from './settings'
import { fetchCharacters } from './characters'

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
    const roomSubscription = API.graphql(graphqlOperation(changedRoom))
        .subscribe({
            next: (roomData) => {
                const { value = {} } = roomData
                const { data = {} } = value
                const { changedRoom = {} } = data
                dispatch(neighborhoodUpdate([{ Room: changedRoom }]))
            }
        })

    dispatch(addSubscription({ nodes: neighborhoodSubscription }))
    dispatch(addSubscription({ rooms: roomSubscription }))
    dispatch(fetchAllNeighborhoods())
    dispatch(fetchMaps)
    dispatch(fetchSettings)
    dispatch(fetchCharacters)
}
