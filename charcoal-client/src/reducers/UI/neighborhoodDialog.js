import { ACTIVATE_NEIGHBORHOOD_DIALOG, CLOSE_NEIGHBORHOOD_DIALOG } from '../../actions/UI/neighborhoodDialog'

export const reducer = (state = { open: false }, action) => {
    const {
        type,
        neighborhoodId = '',
        name = '',
        description = '',
        visibility = 'Visible',
        parentId = '',
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
                parentId,
                parentName,
                parentAncestry
            }
        default:
            return state
    }
}

export default reducer