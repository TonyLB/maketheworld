import { API, graphqlOperation } from 'aws-amplify'
import { getNeighborhoodTree } from '../graphql/queries'
import { changedPermanents } from '../graphql/subscriptions'

import { addSubscription } from './subscriptions'
import { fetchMaps } from './maps'
import { fetchSettings } from './settings'
import { fetchCharacters } from './characters'
import { fetchBackups } from './backups'
import { fetchGrants } from './grants'
import { fetchRoles } from './role'

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

    dispatch(addSubscription({ nodes: neighborhoodSubscription }))
    dispatch(fetchAllNeighborhoods())
    dispatch(fetchMaps)
    dispatch(fetchSettings)
    dispatch(fetchCharacters)
    dispatch(fetchBackups)
    dispatch(fetchGrants)
    dispatch(fetchRoles)
}
