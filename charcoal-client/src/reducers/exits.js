import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods'

const mergeExit = (previous, { FromRoomId, ToRoomId, Name, Delete = false }) => ([
    ...previous.filter(({ FromRoomId: filterFrom, ToRoomId: filterTo }) => (FromRoomId !== filterFrom || ToRoomId !== filterTo)),
    ...(Delete ? [] : [{
        FromRoomId,
        ToRoomId,
        Name
    }])
])

export const reducer = (state = [], action = {}) => {
    const { type = "NOOP", data = {} } = action
    switch (type) {
        case NEIGHBORHOOD_UPDATE:
            return data.filter(({ Exit }) => (Exit)).map(({ Exit }) => (Exit)).reduce(mergeExit, state)
        default: return state
    }
}

export default reducer