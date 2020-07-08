import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods.js'
import { rawAncestryCalculation } from '../selectors/permanentHeaders'

//
// Accept an incoming neighborhood item and update the permanentHeaders to consistenly include new data
//
const neighborhoodUpdate = ({ PermanentId = 'PLACEHOLDER', ParentId, ...change }) => (permanentHeaders) => {
    const previousNeighborhood = permanentHeaders[PermanentId] || {}
    const newPermanentHeaders = {
        ...permanentHeaders,
        [PermanentId]: rawAncestryCalculation({ permanentHeaders })({
            ...(permanentHeaders[PermanentId] || {}),
            PermanentId,
            Type: 'NEIGHBORHOOD',
            ...(ParentId !== undefined ? { ParentId } : {}),
            ...change
        })
    }

    if (ParentId !== undefined) {
        if (!previousNeighborhood.PermanentId) {
            //
            // For a newly received item, check whether there are descendants waiting to be
            // attached and given ancestry.
            //
            const recalculatedPermanentHeaders = {
                ...newPermanentHeaders,
                ...(Object.values(newPermanentHeaders)
                    //
                    // For each element that was waiting for this parent
                    //
                    .filter(({ ParentId }) => (ParentId === PermanentId))
                    //
                    // Select the item itself, and every descendant
                    //
                    .map(({ PermanentId: mappingPermanentId }) => (Object.values(newPermanentHeaders)
                        .filter(({ PermanentId, Ancestry = '' }) => (
                            Ancestry.startsWith(`${mappingPermanentId}:`) ||
                            PermanentId === mappingPermanentId
                        ))
                    ))
                    .reduce((previous, itemList) => ([ ...previous, ...itemList ]), [])
                    //
                    // ... calculate its ancestry, and map into the new headers.
                    //
                    .map((item) => (rawAncestryCalculation({ permanentHeaders: newPermanentHeaders })(item)))
                    .reduce((previous, { PermanentId, ...item }) => ({
                        ...previous,
                        [PermanentId]: {
                            PermanentId,
                            ...item
                        }
                    }), {})
                )
            }
            return recalculatedPermanentHeaders
        }
        if (previousNeighborhood && ParentId !== previousNeighborhood.ParentId) {
            //
            // For a change of ParentId, find all descendants and calculate their new ancestry
            //
            const recalculatedPermanentHeaders = {
                ...newPermanentHeaders,
                ...(Object.values(newPermanentHeaders)
                    .filter(({ Ancestry = '' }) => (Ancestry.startsWith(`${previousNeighborhood.Ancestry}:`)))
                    .map((item) => (rawAncestryCalculation({ permanentHeaders: newPermanentHeaders })(item)))
                    .reduce((previous, { PermanentId, ...item }) => ({
                        ...previous,
                        [PermanentId]: {
                            PermanentId,
                            Type: 'NEIGHBORHOOD',
                            ...item
                        }
                    }), {})
                )
            }
            return recalculatedPermanentHeaders
        }
    }
    return newPermanentHeaders
}

//
// Accept an incoming room item and update the permanentHeaders to consistenly include new data
//

const roomUpdate = ({ PermanentId, ParentId, Exits = [], Entries = [], ...change }) => (permanentHeaders) => {
    return {
        ...permanentHeaders,
        [PermanentId]: {
            ...change,
            PermanentId,
            ParentId,
            Type: 'ROOM',
            Ancestry: permanentHeaders[ParentId] ? `${permanentHeaders[ParentId].Ancestry || ParentId}:${PermanentId}` : PermanentId,
        }
    }
}

const mergeReducer = (state, data) => (
    data.reduce((previous, { Neighborhood, Room }) => {
        if (Neighborhood) {
            return neighborhoodUpdate(Neighborhood)(previous)
        }
        if (Room) {
            return roomUpdate(Room)(previous)
        }
        return previous
    }, state)
)

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", data = [] } = action
    switch (actionType) {
        case NEIGHBORHOOD_UPDATE:
            return mergeReducer(state, data)
        default: return state
    }
}

export default reducer