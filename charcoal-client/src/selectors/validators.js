import { getMyCurrentCharacter } from './myCharacters'
import { getPermanentHeaders, getNeighborhoodPaths } from './permanentHeaders'
import { storeReducer } from '../store/'
import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods.js'

const countUnique = (itemList) => (Object.values(itemList
    .reduce((previous, item) => ({ ...previous, [item]: true }), {}))
    .length
)

const branchInconsistencies = (branchAncestry = '') => (state) => {
    const permanentHeaders = getPermanentHeaders(state)
    const neighborhoodConsistency = (PermanentId) => {
        if (permanentHeaders[PermanentId].Topology === 'Connected') {
            return true
        }
        const paths = getNeighborhoodPaths(PermanentId)(state)
        const uniquePathRooms = Object.keys([...paths.Exits, ...paths.Entries].reduce((previous, { RoomId }) => ({ ...previous, [RoomId]: true }), {}))
        return uniquePathRooms.length < 2
    }
    return branchAncestry.split(':')
        .map((PermanentId) => (permanentHeaders[PermanentId]))
        .filter(({ Type = '' }) => (Type === 'NEIGHBORHOOD'))
        .filter(({ PermanentId }) => (!neighborhoodConsistency(PermanentId)))        
}

export const getNeighborhoodUpdateValidator = (state) => ({ PermanentId, ParentId, Visibility, Topology }) => {
    const character = getMyCurrentCharacter(state)
    const { Grants } = character

    const permanentHeaders = getPermanentHeaders(state)
    const previousNeighborhood = permanentHeaders[PermanentId]

    const parentLookup = ParentId || previousNeighborhood.ParentId || 'ROOT'

    if (PermanentId &&
        (
            (Topology && Topology !== previousNeighborhood.Topology) ||
            (Visibility && Visibility !== previousNeighborhood.Visibility)
        ) &&
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
                error: `You do not have permission to make a connected neighborhood within ${permanentHeaders[parentLookup].Name || 'root'}`
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
                error: `You do not have permission to make a public neighborhood within ${permanentHeaders[parentLookup].Name || 'root'}`
            }
        }
        if (Visibility === 'Private' && !Grants[parentLookup].ExtendPrivate) {
            return {
                valid: false,
                error: `You do not have permission to make a private neighborhood within ${permanentHeaders[parentLookup].Name || 'root'}`
            }
        }
    }
    //
    // Check for ParentId update
    //
    if (PermanentId && ParentId !== undefined && ((ParentId || '') !== previousNeighborhood.ParentId)) {
        if (!Grants[PermanentId].Moderate) {
            return {
                valid: false,
                error: `You do not have permission to reparent ${previousNeighborhood.Name}`
            }
        }
        const newAncestry = `${permanentHeaders[ParentId].Ancestry}:${PermanentId}`
        const predictedState = storeReducer(state, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Neighborhood: {
                    PermanentId,
                    ParentId,
                    Visibility,
                    Topology
                }
            }]
        })
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
            .reduce((previous, { RoomId }) => ({ ...previous, [RoomId]: true }), {}))
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

export const getRoomUpdateValidator = (state) => ({ PermanentId, ParentId, Exits, Entries }) => {
    const character = getMyCurrentCharacter(state)
    const { Grants } = character

    const permanentHeaders = getPermanentHeaders(state)
    const previousRoom = permanentHeaders[PermanentId]

    const { exits = [] } = state
    const finalExits = [
        ...((Exits || previousRoom.Exits || []).map(({ RoomId: ToRoomId, Name }) => ({ FromRoomId: PermanentId, ToRoomId, Name }))),
        ...((Entries || previousRoom.Entries || []).map(({ RoomId: FromRoomId, Name }) => ({ ToRoomId: PermanentId, FromRoomId, Name })))
    ]
    const existingExits = exits.filter(({ FromRoomId, ToRoomId }) => (FromRoomId === PermanentId || ToRoomId === PermanentId))
    const exitsToPut = finalExits.filter((exit) => (!existingExits.find((compare) => (compare.FromRoomId === exit.FromRoomId && compare.ToRoomId === exit.ToRoomId && compare.Name === exit.Name))))
    const exitsToDelete = existingExits.filter((exit) => (!finalExits.find((compare) => (compare.FromRoomId === exit.FromRoomId && compare.ToRoomId === exit.ToRoomId))))

    const predictedState = storeReducer(state, {
        type: NEIGHBORHOOD_UPDATE,
        data: [{
                Room: {
                    PermanentId,
                    ParentId

                    //
                    // **** TODO ****
                    //
                    // Revise update and validate procedures so that they operate on a whole updated state,
                    // rather than simply allowing a single change.  This will, in turn, assure that we
                    // don't need to repeat the code for breaking a form down into database updates in the
                    // validate section as well, in order to get live validation.
                    //
                    // Short-Term:  Repeat the new update code from the Room update form, in order to get
                    // live validation working in the current code regime.
                    //
                    // Exits: Exits || previousRoom.Exits,
                    // Entries: Entries || previousRoom.Entries
                }
            },
            ...(exitsToDelete.map((exit) => ({ Exit: { ...exit, Delete: true } }))),
            ...(exitsToPut.map((exit) => ({ Exit: exit })))
        ]
    })

    //
    // Check for ParentId update
    //
    if (previousRoom.PermanentId && (ParentId !== previousRoom.ParentId)) {
        if (!Grants[previousRoom.ParentId || 'ROOT'].Edit) {
            return {
                valid: false,
                error: `You do not have permission to reparent ${previousRoom.Name}`
            }
        }
        if (!Grants[ParentId || 'ROOT'].Edit) {
            return {
                valid: false,
                error: `You do not have permission to reparent rooms to ${permanentHeaders[ParentId].Name || 'root'}`
            }
        }
    }
    const newAncestry = permanentHeaders[ParentId || previousRoom.ParentId].Ancestry
    //
    // Check if the neighborhood the room is IN would be in violation
    //
    const directInconsistencies = branchInconsistencies(newAncestry)(predictedState)
    if (directInconsistencies.length) {
        return {
            valid: false,
            error: `Editing this way would make too many external paths on ${directInconsistencies[0].Name}`
        }
    }
    //
    // Check if neighborhoods connected to would be in violation
    //
    const uniquePathRooms = Object.keys([...(Exits || previousRoom.Exits || []), ...(Entries || previousRoom.Entries || [])]
        .reduce((previous, { RoomId }) => ({ ...previous, [RoomId]: true }), {}))
    const inconsistentOutgoingViolations = uniquePathRooms
        .map((RoomId) => (predictedState.permanentHeaders[RoomId] && predictedState.permanentHeaders[RoomId].Ancestry))
        .filter((Ancestry) => (Ancestry))
        .map((Ancestry) => (branchInconsistencies(Ancestry)(predictedState)))
        .find((inconsistencies) => (inconsistencies.length))
    if (inconsistentOutgoingViolations) {
        return {
            valid: false,
            error: `Editing this way would make too many external paths on ${inconsistentOutgoingViolations[0].Name}`
        }
    }

    return { valid: true }
}