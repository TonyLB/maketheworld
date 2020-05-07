import { API, graphqlOperation } from 'aws-amplify'
import { getRoles } from '../graphql/queries'
import { changedRole } from '../graphql/subscriptions'

import { addSubscription } from './subscriptions'

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

export const subscribeRoleChanges = () => (dispatch) => {
    const roleSubscription = API.graphql(graphqlOperation(changedRole))
    .subscribe({
        next: (message) => {
            const { value = {} } = message
            const { data = {} } = value
            const { changedRole = {} } = data
            const { RoleId, Name, Actions } = changedRole
            dispatch(roleUpdate([{ RoleId, Name, Actions }]))
        }
    })

    dispatch(addSubscription({ role: roleSubscription }))
    dispatch(fetchRoles)

}
