import { NEIGHBORHOOD_UPDATE, NEIGHBORHOOD_MERGE } from '../actions/neighborhoods.js'

//
// ToDo:  Refactor the reducer to be *much* smarter (modelling, perhaps, on the predict functions in the selector/validator
// package), so that we can then trust it to accurate predict chains of alterations and present them for assertion-based
// validation.
//

const mergeReducer = (state, data) => (
    data.reduce((previous, { PermanentId, ...rest }) => ({ ...previous, [PermanentId]: { PermanentId, ...rest }}), state)
)

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", data = [] } = action
    switch (actionType) {
        case NEIGHBORHOOD_UPDATE:
            return mergeReducer(state, data)
        case NEIGHBORHOOD_MERGE:
            return mergeReducer(state, action.permanentData || [])
        default: return state
    }
}

export default reducer