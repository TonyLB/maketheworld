export const ACTIVATE_NEIGHBORHOOD_DIALOG = 'ACTIVATE_NEIGHBORHOOD_DIALOG'
export const CLOSE_NEIGHBORHOOD_DIALOG = 'CLOSE_NEIGHBORHOOD_DIALOG'

export const activateNeighborhoodDialog = ({
    neighborhoodId = '',
    name = '',
    description = '',
    ancestry = '',
    parentId = '',
    parentName = '',
    parentAncestry = '',
    nested = false
}) => ({
    type: ACTIVATE_NEIGHBORHOOD_DIALOG,
    neighborhoodId,
    name,
    description,
    ancestry,
    parentId,
    parentName,
    parentAncestry,
    nested
})

export const closeNeighborhoodDialog = () => ({ type: CLOSE_NEIGHBORHOOD_DIALOG })
