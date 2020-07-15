import { API, graphqlOperation } from 'aws-amplify'
import { syncPermanents as syncPermanentsGQL } from '../graphql/queries'
import { changedPermanents } from '../graphql/subscriptions'

import { addSubscription } from './subscriptions'

export const NEIGHBORHOOD_UPDATE = 'NEIGHBORHOOD_UPDATE'

export const neighborhoodUpdate = (neighborhoods) => ({
    type: NEIGHBORHOOD_UPDATE,
    data: neighborhoods
})

export const syncPermanents = ({ ExclusiveStartKey }) => async (dispatch) => {
    const permanentsResults = await API.graphql(graphqlOperation(syncPermanentsGQL, { exclusiveStartKey: ExclusiveStartKey, limit: 100 }))
        .catch((err) => { console.log(err)})
    const { data = {} } = permanentsResults || {}
    const { syncPermanents: syncPermanentsData = {} } = data
    const { Items = [], LastEvaluatedKey = null } = syncPermanentsData
    dispatch(neighborhoodUpdate(Items))
    if (LastEvaluatedKey) {
        dispatch(syncPermanents({ ExclusiveStartKey: LastEvaluatedKey }))
    }
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
    dispatch(syncPermanents({}))
}
