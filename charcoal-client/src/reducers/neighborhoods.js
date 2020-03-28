import { NEIGHBORHOOD_UPDATE, NEIGHBORHOOD_MERGE } from '../actions/neighborhoods.js'

const mergeSubtree = (state, { ancestryList, permanent }) => {
    if (ancestryList.length) {
        const pullOut = (state && state[ancestryList[0]] && state[ancestryList[0]].children) || {}
        return {
            ...state,
            [ancestryList[0]]: {
                ...state[ancestryList[0]],
                children: mergeSubtree(pullOut, {
                    ancestryList: ancestryList.slice(1),
                    permanent
                })
            }
        }
    }
    else {
        return {
            ...state,
            [permanent.permanentId]: permanent
        }
    }
}

const mergeReducer = (state, permanents) => (
    permanents.reduce((state, permanent) => {
        const ancestryList = (permanent.ancestry && permanent.ancestry.split(':').slice(0, -1)) || []
        return mergeSubtree(state, { ancestryList, permanent})
    }, state)
)

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", data = {} } = action
    switch (actionType) {
        case NEIGHBORHOOD_UPDATE:
            return data || state
        case NEIGHBORHOOD_MERGE:
            return mergeReducer(state, action.permanentData || [])

        default: return state
    }
}

export default reducer