export const getPermanentHeaders = ({ permanentHeaders }) => (permanentHeaders)

export const getRoomIdsInNeighborhood = (NeighborhoodId) => ({ permanentHeaders = {} }) => {
    const baseAncestry = (NeighborhoodId && permanentHeaders[NeighborhoodId] && permanentHeaders[NeighborhoodId].ancestry) || ''
    return Object.values(permanentHeaders)
        .filter(({ type }) => (type === 'ROOM'))
        .filter(({ ancestry }) => (ancestry.startsWith(baseAncestry)))
        .map(({ permanentId }) => permanentId)
}