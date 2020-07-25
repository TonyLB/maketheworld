import { objectMap } from '../lib/objects'

export const rawAncestryCalculation = ({ permanentHeaders = {}}) => ({ ParentId, PermanentId, ...rest }) => {
    if (!(ParentId && permanentHeaders[ParentId])) {
        return {
            ParentId,
            PermanentId,
            ...rest,
            Ancestry: PermanentId
        }
    }
    else {
        const parent = rawAncestryCalculation({ permanentHeaders })(permanentHeaders[ParentId])
        return {
            ParentId,
            PermanentId,
            ...rest,
            Ancestry: `${parent.Ancestry}:${PermanentId}`
        }
    }
}

//
// TODO:  Figure out how to properly cache calculations so that getPermanentHeaders uses
// rawAncestryCalculation to generate the Ancestry from the tree dynamically.
//
export const getPermanentHeaders = ({ permanentHeaders = {}, exits = [] }) => {
    return new Proxy(
        permanentHeaders,
        {
            get: (obj, prop) => {
                const header = obj && obj[prop]
                if (!header) {
                    return {}
                }
                if (header.Type === 'ROOM') {
                    return new Proxy(
                        header,
                        {
                            get: (obj, prop) => {
                                if (prop === 'Exits') {
                                    return exits.filter(({ FromRoomId }) => (obj.PermanentId === FromRoomId)).map(({ ToRoomId, Name }) => ({ RoomId: ToRoomId, Name }))
                                }
                                if (prop === 'Entries') {
                                    return exits.filter(({ ToRoomId }) => (header.PermanentId === ToRoomId)).map(({ FromRoomId, Name }) => ({ RoomId: FromRoomId, Name }))
                                }
                                return obj[prop]
                            }
                        }
                    )
                }
                return header
            }
        }
    )
}

export const getRoomIdsInNeighborhood = (NeighborhoodId) => (state) => {
    const permanentHeaders = getPermanentHeaders(state)
    const baseAncestry = (NeighborhoodId && permanentHeaders[NeighborhoodId] && permanentHeaders[NeighborhoodId].Ancestry) || ''
    return Object.values(permanentHeaders)
        .filter(({ Type, Retired }) => (Type === 'ROOM' && !Retired))
        .filter(({ Ancestry }) => (Ancestry.startsWith(baseAncestry)))
        .filter(({ Ancestry }) => (!Ancestry.split(':').find((PermanentId) => (permanentHeaders[PermanentId].Retired))))
        .map(({ PermanentId }) => PermanentId)
}

export const getNeighborhoodsByAncestry = (Ancestry) => ({ permanentHeaders = {}}) => {
    const ancestryList = Ancestry ? Ancestry.split(':').slice(0, -1) : []
    return ancestryList.map((neighborhoodId) => (permanentHeaders && permanentHeaders[neighborhoodId]))
        .filter((neighborhood) => (neighborhood))
}

const mergeSubtree = (state, { ancestryList, node }) => {
    if (ancestryList.length) {
        const pullOut = (state && state[ancestryList[0]] && state[ancestryList[0]].children) || {}
        return {
            ...state,
            [ancestryList[0]]: {
                ...(state[ancestryList[0]] || {}),
                children: mergeSubtree(pullOut, {
                    ancestryList: ancestryList.slice(1),
                    node
                })
            }
        }
    }
    else {
        return {
            ...state,
            [node.PermanentId]: {
                ...(state[node.PermanentId] || {}),
                ...node
            }
        }
    }
}

//
// As items get reparented, room can be in an old locaton while its neighborhood has moved
// to a new location (or vice versa), in ways that leave a duplicate merged neighborhood that
// will get no data.  This function removes those branches from the tree, so that they don't
// cause a key collision at render time.
//
const elideInTransitBranches = (nodeTree) => {
    const retVal = {
        ...(Object.values(nodeTree)
            .filter((node) => (node.PermanentId))
            .map(({ children, ...rest }) => {
                const elidedChildren = (children && elideInTransitBranches(children)) || null
                return {
                    ...rest,
                    ...((elidedChildren && Object.values(elidedChildren).length) ? { children: elidedChildren } : {})
                }
            })
            .reduce((previous, node) => ({ ...previous, [node.PermanentId]: node }), {})
        )
    }
    return retVal
}

export const treeify = (nodeList) => (
    elideInTransitBranches(nodeList.reduce((previous, node) => {
        const ancestryList = (node.Ancestry && node.Ancestry.split(':').slice(0, -1)) || []
        return mergeSubtree(previous, { ancestryList, node })
    }, {}))
)

export const tagRetiredBranches = (nodeTree, AncestorRetired = false) => (
    objectMap(nodeTree, ({ Retired = false, children, ...rest }) => ({
        Retired,
        AncestorRetired,
        children: children && tagRetiredBranches(children, AncestorRetired || Retired),
        ...rest
    }))
)

export const getNeighborhoodOnlyTree = ({ permanentHeaders }) => (
    tagRetiredBranches(treeify(Object.values(permanentHeaders).filter(({ Type }) => (Type === 'NEIGHBORHOOD'))))
)

export const getNeighborhoodOnlyTreeExcludingSubTree = (ancestryToExclude) => ({ permanentHeaders }) => (
    tagRetiredBranches(treeify(Object.values(permanentHeaders)
            .filter(({ Type }) => (Type === 'NEIGHBORHOOD'))
            .filter(({ Ancestry }) => (!Ancestry.startsWith(ancestryToExclude)))
        ))
)

export const getNeighborhoodTree = ({ permanentHeaders }) => (tagRetiredBranches(treeify(Object.values(permanentHeaders))))

const subTreeify = (nodeList, ancestry) => (
    elideInTransitBranches((ancestry.split(':') || [])
        .filter((permanentId) => (permanentId))
        .reduce((previous, permanentId) => ( (previous[permanentId] && previous[permanentId].children) || {} ),
            nodeList
                .reduce((previous, node) => {
                    const ancestryList = (node.Ancestry && node.Ancestry.split(':').slice(0, -1)) || []
                    return mergeSubtree(previous, { ancestryList, node })
                }, {})
            )
    )
)

export const getNeighborhoodSubtree = ({ roomId, ancestry }) => (state) => {
    const permanentHeaders = getPermanentHeaders(state)
    const neighborhoodSubTree = Object.values(permanentHeaders)
        .filter(({ Ancestry }) => ((!ancestry) || (Ancestry || '').startsWith(ancestry)))
        .filter(({ PermanentId }) => (PermanentId !== roomId))
    return tagRetiredBranches(subTreeify(neighborhoodSubTree, ancestry))
}

export const getExternalTree = ({ ancestry }) => (state) => {
    const permanentHeaders = getPermanentHeaders(state)
    return tagRetiredBranches(treeify(Object.values(permanentHeaders)
        .filter(({ Ancestry }) => (ancestry && !((Ancestry || '').startsWith(ancestry))))))
}

//
// For a given Neighborhood, find all the paths to and from descendants that
// pass out of the neighborhood.
//
export const getNeighborhoodPaths = (PermanentId) => (state) => {
    if (!PermanentId) {
        return {
            Exits: [],
            Entries: []
        }
    }
    const permanentHeaders = getPermanentHeaders(state)
    const { Ancestry: rootAncestry = '' } = permanentHeaders[PermanentId]
    const descendants = Object.values(permanentHeaders).filter(({ Ancestry = '' }) => (Ancestry.startsWith(rootAncestry)))
    const descendantExits = descendants
        .filter((descendant) => (descendant.Exits))
        .map((descendant) => (descendant.Exits.map((exit) => ({ ...exit, OriginId: descendant.PermanentId }))))
        .reduce((previous, itemList) => ([...previous, ...itemList]), [])
        .filter(({ RoomId }) => (!(permanentHeaders[RoomId] && (permanentHeaders[RoomId].Ancestry || '').startsWith(rootAncestry) )))
    const descendantEntries = descendants
        .filter((descendant) => (descendant.Entries))
        .map((descendant) => (descendant.Entries.map((entry) => ({ ...entry, OriginId: descendant.PermanentId }))))
        .reduce((previous, itemList) => ([...previous, ...itemList]), [])
        .filter(({ RoomId }) => (!(permanentHeaders[RoomId] && (permanentHeaders[RoomId].Ancestry || '').startsWith(rootAncestry) )))
    return {
        Exits: descendantExits,
        Entries: descendantEntries
    }
}
