import { ACTIVATE_WORLD_DIALOG, CLOSE_WORLD_DIALOG } from '../../actions/UI/worldDialog'

export const reducer = (state = { open: false }, action) => {
    const {
        type
    } = action

    switch (type) {

        case CLOSE_WORLD_DIALOG:
            return {
                open: false
            }
        case ACTIVATE_WORLD_DIALOG:
            return {
                open: true,
            }
        default:
            return state
    }
}

export default reducer