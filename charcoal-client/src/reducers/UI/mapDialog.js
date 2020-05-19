import { ACTIVATE_MAP_DIALOG, CLOSE_MAP_DIALOG } from '../../actions/UI/mapDialog'

export const reducer = (state = false, action = {}) => {
    const { type } = action

    switch (type) {

        case CLOSE_MAP_DIALOG:
            return false
        case ACTIVATE_MAP_DIALOG:
            return true
        default:
            return state
    }
}

export default reducer