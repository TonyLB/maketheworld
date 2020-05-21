import { ACTIVATE_EDIT_MAP_DIALOG, CLOSE_EDIT_MAP_DIALOG } from '../../actions/UI/mapDialog'

export const reducer = (state = { open: false, map: null }, action = {}) => {
    const { type } = action

    switch (type) {

        case CLOSE_EDIT_MAP_DIALOG:
            return {
                ...state,
                open: false
            }
        case ACTIVATE_EDIT_MAP_DIALOG:
            return {
                ...state,
                open: true,
                map: action.map
            }
        default:
            return state
    }
}

export default reducer