import { ACTIVATE_HELP_DIALOG, CLOSE_HELP_DIALOG } from '../../actions/UI/helpDialog'

export const reducer = (state = false, action = {}) => {
    const { type } = action

    switch (type) {

        case CLOSE_HELP_DIALOG:
            return false
        case ACTIVATE_HELP_DIALOG:
            return true
        default:
            return state
    }
}

export default reducer