import { MAPS_UPDATE } from '../actions/maps'
import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods'

const mergeMap = (state, { MapId, Rooms = [], ...rest }) => ({
    ...state,
    [MapId]: {
        ...(state[MapId] || {}),
        MapId,
        Rooms: Rooms.reduce((previous, { PermanentId, ...roomRest }) => ({
            ...previous,
            [PermanentId]: {
                PermanentId,
                ...roomRest
            }
        }), {}),
        ...rest
    }
})

export const reducer = (state = {}, action) => {
    const { type: actionType = 'NOOP', data = [] } = action || {}
    switch (actionType) {
        case MAPS_UPDATE:
            return data.reduce(mergeMap, state)
        case NEIGHBORHOOD_UPDATE:
            return data
                .filter(({ Map }) => (Map))
                .map(({ Map }) => (Map))
                .reduce(mergeMap, state)
        default: return state
    }
}

export default reducer