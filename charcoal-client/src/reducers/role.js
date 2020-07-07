import { ROLE_UPDATE } from '../actions/role.js'
import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods.js'

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", data = [] } = action
    switch (actionType) {
        case ROLE_UPDATE:
            return data.filter(({ RoleId }) => (RoleId)).reduce((previous, { RoleId, ...rest }) => ({
                ...previous,
                [RoleId]: rest
            }), state)
        case NEIGHBORHOOD_UPDATE:
            return data.map(({ Role }) => (Role || {})).filter(({ RoleId }) => (RoleId)).reduce((previous, { RoleId, ...rest }) => ({
                ...previous,
                [RoleId]: rest
            }), state)
        default: return state
    }
}

export default reducer