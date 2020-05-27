import { ACTIVATE_CLIENT_SETTINGS_DIALOG, CLOSE_CLIENT_SETTINGS_DIALOG } from '../../actions/UI/clientSettingsDialog'

export const reducer = (state = { open: false }, action) => {
    const {
        type
    } = action

    switch (type) {

        case CLOSE_CLIENT_SETTINGS_DIALOG:
            return {
                open: false
            }
        case ACTIVATE_CLIENT_SETTINGS_DIALOG:
            return {
                open: true
            }
        default:
            return state
    }
}

export default reducer