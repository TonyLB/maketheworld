export const getPermanentHeaders = ({ permanentHeaders }) => (permanentHeaders)

export const getRoomIdsInNeighborhood = (NeighborhoodId) => ({ permanentHeaders = {} }) => {
    const baseAncestry = (NeighborhoodId && permanentHeaders[NeighborhoodId] && permanentHeaders[NeighborhoodId].ancestry) || ''
    return Object.values(permanentHeaders)
        .filter(({ type }) => (type === 'ROOM'))
        .filter(({ ancestry }) => (ancestry.startsWith(baseAncestry)))
        .map(({ permanentId }) => permanentId)
}

export const getNeighborhoodsByAncestry = (Ancestry) => ({ permanentHeaders = {}}) => {
    const ancestryList = Ancestry ? Ancestry.split(':').slice(0, -1) : []
    return ancestryList.map((neighborhoodId) => (permanentHeaders && permanentHeaders[neighborhoodId]))
        .filter((neighborhood) => (neighborhood))
}