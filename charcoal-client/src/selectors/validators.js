import { getMyCurrentCharacter } from './myCharacters'
import { getPermanentHeaders, getNeighborhoodPaths, rawAncestryCalculation } from './permanentHeaders'

const countUnique = (itemList) => (Object.values(itemList
    .reduce((previous, item) => ({ ...previous, [item]: true }), {}))
    .length
)

//
// Calculate what the state will look like after reparenting.
//
// TODO:  Remove denormalized Ancestry requirement from data, and recalculate
// as needed from underlying ParentId data.
//
const predictReparent = ({ PermanentId, ...change }) => ({ permanentHeaders, ...rest }) => {
    const newPermanentHeaders = {
        ...permanentHeaders,
        [PermanentId]: {
            ...(permanentHeaders[PermanentId] || {}),
            ...change
        }
    }
    const recalculatedPermanentHeaders = Object.values(newPermanentHeaders)
        .map((item) => (rawAncestryCalculation({ permanentHeaders: newPermanentHeaders })(item)))
        .reduce((previous, { PermanentId, ...item }) => ({
            ...previous,
            [PermanentId]: {
                PermanentId,
                ...item
            }
        }), {})
    return {
        ...rest,
        permanentHeaders: recalculatedPermanentHeaders
    }
}

const branchInconsistencies = (branchAncestry) => (state) => {
    const { permanentHeaders } = state
    const neighborhoodConsistency = (PermanentId) => {
        if (permanentHeaders[PermanentId].Topology === 'Connected') {
            return true
        }
        const paths = getNeighborhoodPaths(PermanentId)(state)
        const uniquePathRooms = Object.values([...paths.Exits, ...paths.Entries].reduce((previous, { RoomId }) => ({ ...previous, [RoomId]: true }), {}))
        return uniquePathRooms.length < 2
    }
    return branchAncestry.split(':')
        .map((PermanentId) => (permanentHeaders[PermanentId]))
        .filter(({ Type }) => (Type === 'NEIGHBORHOOD'))
        .filter(({ PermanentId }) => (!neighborhoodConsistency(PermanentId)))        
}

export const getNeighborhoodUpdateValidator = (state) => ({ PermanentId, ParentId, Visibility, Topology }) => {
    const character = getMyCurrentCharacter(state)
    const { Grants } = character

    const permanentHeaders = getPermanentHeaders(state)
    const previousNeighborhood = permanentHeaders[PermanentId]

    const parentLookup = ParentId || previousNeighborhood.ParentId || 'ROOT'

    if (((Topology && Topology !== previousNeighborhood.Topology) || (Visibility && Visibility !== previousNeighborhood.Visibility)) &&
        !(Grants[parentLookup].Moderate || Grants[PermanentId].Edit)) {
        return {
            valid: false,
            error: `You do not have permission to moderate neighborhood ${previousNeighborhood.Name}`
        }
    }
    //
    // Check for Topology update
    //
    if (Topology && Topology !== previousNeighborhood.Topology) {
        if (Topology === 'Connected' && !Grants[parentLookup].ExtendConnected) {
            return {
                valid: false,
                error: `You do not have permission to make a connected neighborhood within ${permanentHeaders[parentLookup].Name}`
            }
        }
        if (Topology === 'Dead-End') {
            const neighborhoodPaths = getNeighborhoodPaths(PermanentId)(state)
            if (countUnique(neighborhoodPaths.Exits.map(({ RoomId }) => (RoomId))) > 1) {
                return {
                    valid: false,
                    error: 'You may not set a neighborhood Dead-End when it has external exits to multiple rooms'
                }
            }
            if (countUnique(neighborhoodPaths.Entries.map(({ RoomId }) => (RoomId))) > 1) {
                return {
                    valid: false,
                    error: 'You may not set a neighborhood Dead-End when it has external entries from multiple rooms'
                }
            }
        }
    }
    //
    // Check for Visibility update
    //
    if (Visibility && Visibility !== previousNeighborhood.Visibility) {
        const parentLookup = ParentId || previousNeighborhood.ParentId || 'ROOT'
        if (Visibility === 'Public' && !Grants[parentLookup].ExtendPublic) {
            return {
                valid: false,
                error: `You do not have permission to make a public neighborhood within ${permanentHeaders[parentLookup].Name}`
            }
        }
    }
    //
    // Check for ParentId update
    //
    if (ParentId && (ParentId !== previousNeighborhood.ParentId)) {
        if (!Grants[PermanentId].Moderate) {
            return {
                valid: false,
                error: `You do not have permission to reparent ${previousNeighborhood.Name}`
            }
        }
        const newAncestry = `${permanentHeaders[ParentId].Ancestry}:${PermanentId}`
        const predictedState = predictReparent({PermanentId, ParentId, Visibility, Topology})(state)
        //
        // Check if the neighborhood being reparented INTO would be in violation
        //
        const directInconsistencies = branchInconsistencies(newAncestry)(predictedState)
        if (directInconsistencies.length) {
            return {
                valid: false,
                error: `Reparenting this way would make too many external paths on ${directInconsistencies[0].Name}`
            }
        }
        //
        // Check if neighborhoods connected to would now be in violation (as some of their
        // paths move from local to external)
        //
        const newPaths = getNeighborhoodPaths(PermanentId)(predictedState)
        const uniquePathRooms = Object.keys([...newPaths.Exits, ...newPaths.Entries]
            .reduce((previous, { RoomId }) => ({ ...previous, [RoomId]: true })))
        const inconsistentOutgoingViolations = uniquePathRooms
            .map((RoomId) => (predictedState.permanentHeaders[RoomId] && predictedState.permanentHeaders[RoomId].Ancestry))
            .filter((Ancestry) => (Ancestry))
            .map((Ancestry) => (branchInconsistencies(Ancestry)(predictedState)))
            .find((inconsistencies) => (inconsistencies.length))
        if (inconsistentOutgoingViolations) {
            return {
                valid: false,
                error: `Reparenting this way would make too many external paths on ${inconsistentOutgoingViolations[0].Name}`
            }
        }
        
    }
    return { valid: true }
}