export const ACTIVATE_NEIGHBORHOOD_DIALOG = 'ACTIVATE_NEIGHBORHOOD_DIALOG'
export const CLOSE_NEIGHBORHOOD_DIALOG = 'CLOSE_NEIGHBORHOOD_DIALOG'

export const activateNeighborhoodDialog = ({
    neighborhoodId = '',
    name = '',
    description = '',
    parentId = '',
    parentName = '',
    nested = false
}) => ({
    type: ACTIVATE_NEIGHBORHOOD_DIALOG,
    neighborhoodId,
    name,
    description,
    parentId,
    parentName,
    nested
})

export const closeNeighborhoodDialog = () => ({ type: CLOSE_NEIGHBORHOOD_DIALOG })
