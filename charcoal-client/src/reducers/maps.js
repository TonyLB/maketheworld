import { MAPS_UPDATE } from '../actions/maps'

export const reducer = (state = {}, action) => {
    const { type: actionType = 'NOOP', data = [] } = action || {}
    switch (actionType) {
        case MAPS_UPDATE:
            return data.reduce((previous, { MapId, Rooms, ...rest }) => ({
                ...previous,
                [MapId]: {
                    ...(previous[MapId] || {}),
                    MapId,
                    Rooms: Rooms.reduce((previous, { PermanentId, ...roomRest }) => ({
                        ...previous,
                        [PermanentId]: {
                            PermanentId,
                            ...roomRest
                        }
                    }), (previous[MapId] || {}).Rooms || []),
                    ...rest
                }
            }), state)
        default: return state
    }
}

export default reducer