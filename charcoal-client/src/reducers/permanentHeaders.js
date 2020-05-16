import { NEIGHBORHOOD_UPDATE, NEIGHBORHOOD_MERGE } from '../actions/neighborhoods.js'
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
    const removedPaths = Object.values(permanentHeaders)
        .map(({ Type, Exits = [], Entries = [], ...rest }) => (Type === 'ROOM'
            ? {
                ...rest,
                Type,
                Exits: Exits.filter(({ RoomId }) => (RoomId !== PermanentId)),
                Entries: Entries.filter(({ RoomId }) => (RoomId !== PermanentId))
            }
            : { Type, ...rest }
        ))
        .reduce((previous, { PermanentId, ...rest }) => ({ ...previous, [PermanentId]: {
            PermanentId,
            ...rest
        }}), {})
    const addedExits = (Exits || []).reduce((previous, { RoomId, Name }) => (previous[RoomId] ? {
        ...previous,
        [RoomId]: {
            ...previous[RoomId],
            Entries: [
                ...(previous[RoomId].Entries || []),
                {
                    RoomId: PermanentId,
                    Name
                }
            ]
        }
    } : previous), removedPaths)
    const addedEntries = (Entries || []).reduce((previous, { RoomId, Name }) => (previous[RoomId] ? {
        ...previous,
        [RoomId]: {
            ...previous[RoomId],
            Exits: [
                ...(previous[RoomId].Exits || []),
                {
                    RoomId: PermanentId,
                    Name
                }
            ]
        }
    } : previous), addedExits)
    return {
        ...addedEntries,
        [PermanentId]: {
            ...change,
            PermanentId,
            ParentId,
            Ancestry: permanentHeaders[ParentId] ? `${permanentHeaders[ParentId].Ancestry || ''}:${PermanentId}` : PermanentId,
            Exits: (Exits || []).filter(({ RoomId }) => (permanentHeaders[RoomId])),
            Entries: (Entries || []).filter(({ RoomId }) => (permanentHeaders[RoomId]))
        }
    }
}

const mergeReducer = (state, data) => (
    data.reduce((previous, node) => {
        const { Type } = node
        switch(Type) {
            case 'NEIGHBORHOOD':
                return neighborhoodUpdate(node)(previous)
            case 'ROOM':
                return roomUpdate(node)(previous)
            default:
                return previous
        }
    }, state)
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