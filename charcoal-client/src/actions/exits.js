import { API, graphqlOperation } from 'aws-amplify'
import { getExits } from '../graphql/queries'

import { neighborhoodUpdate } from './neighborhoods'

export const fetchExits = (dispatch) => {
    return API.graphql(graphqlOperation(getExits))
        .then(({ data }) => (data || {}))
        .then(({ getExits }) => (getExits || []))
        .then(response => dispatch(neighborhoodUpdate(response)))
        .catch((err) => { console.log(err)})
}
