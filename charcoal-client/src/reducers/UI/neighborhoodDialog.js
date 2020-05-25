import { ACTIVATE_NEIGHBORHOOD_DIALOG, CLOSE_NEIGHBORHOOD_DIALOG } from '../../actions/UI/neighborhoodDialog'

export const reducer = (state = { open: false }, action) => {
    const {
        type,
        neighborhoodId = '',
        name = '',
        description = '',
        visibility = 'Private',
        topology = 'Dead-End',
        grants = [],
        parentId = '',
        mapId = '',
        parentName = '',
        parentAncestry = '',
        nested = false
    } = action

    switch (type) {

        case CLOSE_NEIGHBORHOOD_DIALOG:
            return {
                ...state,
                open: false,
                nestedOpen: false
            }
        case ACTIVATE_NEIGHBORHOOD_DIALOG:
            return {
                open: !nested,
                nestedOpen: nested,
                neighborhoodId,
                name,
                description,
                visibility,
                topology,
                grants,
                parentId,
                mapId,
                parentName,
                parentAncestry
            }
        default:
            return state
    }
}

export default reducer