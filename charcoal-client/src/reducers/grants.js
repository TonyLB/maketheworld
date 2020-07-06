import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods'

const mergeGrant = (previous, { CharacterId, Resource, Roles = '', Actions = '' }) => ({
    ...previous,
    [CharacterId]: [
        ...(previous[CharacterId] || []).filter((grant) => (grant.Resource !== Resource)),
        {
            CharacterId,
            Resource,
            Roles,
            Actions
        }
    ]
})

export const reducer = (state = {}, action = {}) => {
    const { type = "NOOP", data = {} } = action
    switch (type) {
        case NEIGHBORHOOD_UPDATE:
            return data.filter(({ Grant }) => (Grant)).map(({ Grant }) => (Grant)).reduce(mergeGrant, state)
        default: return state
    }
}

export default reducer