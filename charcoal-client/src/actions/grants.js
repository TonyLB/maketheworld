import { API, graphqlOperation } from 'aws-amplify'
import { getGrants } from '../graphql/queries'

import { neighborhoodUpdate } from './neighborhoods.js'

export const fetchGrants = (dispatch) => {
    return API.graphql(graphqlOperation(getGrants))
        .then(({ data }) => (data || {}))
        .then(({ getGrants }) => (getGrants || []))
        .then((grantChanges) => (dispatch(neighborhoodUpdate(grantChanges))))
}
