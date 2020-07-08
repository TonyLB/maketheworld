import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods.js'

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", data = [] } = action
    switch (actionType) {
        case NEIGHBORHOOD_UPDATE:
            return data.map(({ Role }) => (Role || {})).filter(({ RoleId }) => (RoleId)).reduce((previous, { RoleId, ...rest }) => ({
                ...previous,
                [RoleId]: rest
            }), state)
        default: return state
    }
}

export default reducer