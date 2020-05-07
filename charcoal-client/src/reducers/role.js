import { ROLE_UPDATE } from '../actions/role.js'

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", data = [] } = action
    switch (actionType) {
        case ROLE_UPDATE:
            return data.filter(({ RoleId }) => (RoleId)).reduce((previous, { RoleId, ...rest }) => ({
                ...previous,
                [RoleId]: rest
            }), state)
        default: return state
    }
}

export default reducer