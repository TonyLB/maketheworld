import { ACTIVATE_NEIGHBORHOOD_DIALOG, CLOSE_NEIGHBORHOOD_DIALOG } from '../../actions/UI/neighborhoodDialog'

export const reducer = (state = { open: false }, action) => {
    const {
        type
    } = action

    switch (type) {

        case CLOSE_NEIGHBORHOOD_DIALOG:
            return {
                open: false
            }
        case ACTIVATE_NEIGHBORHOOD_DIALOG:
            return {
                open: true,
            }
        default:
            return state
    }
}

export default reducer