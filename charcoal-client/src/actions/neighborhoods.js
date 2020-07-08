import { API, graphqlOperation } from 'aws-amplify'
import { syncPermanents as syncPermanentsGQL } from '../graphql/queries'
import { changedPermanents } from '../graphql/subscriptions'

import { addSubscription } from './subscriptions'

export const NEIGHBORHOOD_UPDATE = 'NEIGHBORHOOD_UPDATE'

export const neighborhoodUpdate = (neighborhoods) => ({
    type: NEIGHBORHOOD_UPDATE,
    data: neighborhoods
})

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
