import { ACTIVATE_ADMIN_DIALOG, CLOSE_ADMIN_DIALOG } from '../../actions/UI/adminDialog'

export const reducer = (state = { open: false }, action) => {
    const {
        type
    } = action

    switch (type) {

        case CLOSE_ADMIN_DIALOG:
            return {
                open: false
            }
        case ACTIVATE_ADMIN_DIALOG:
            return {
                open: true,
                ...(action.settings || {})
            }
        default:
            return state
    }
}

export default reducer