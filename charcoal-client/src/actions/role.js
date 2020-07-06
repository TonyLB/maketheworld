import { API, graphqlOperation } from 'aws-amplify'
import { getRoles } from '../graphql/queries'

export const ROLE_UPDATE = 'ROLE_UPDATE'

export const roleUpdate = (roleData) => ({
    type: ROLE_UPDATE,
    data: roleData
})

export const fetchRoles = (dispatch) => {
    return API.graphql(graphqlOperation(getRoles))
        .then(({ data }) => (data || {}))
        .then(({ getRoles }) => (getRoles || []))
        .then(response => dispatch(roleUpdate(response)))
        .catch((err) => { console.log(err)})
}
