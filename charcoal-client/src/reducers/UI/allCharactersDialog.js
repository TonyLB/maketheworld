import { ACTIVATE_ALL_CHARACTERS_DIALOG, CLOSE_ALL_CHARACTERS_DIALOG } from '../../actions/UI/allCharactersDialog'

export const reducer = (state = { open: false }, action) => {
    const {
        type
    } = action

    switch (type) {

        case CLOSE_ALL_CHARACTERS_DIALOG:
            return {
                open: false
            }
        case ACTIVATE_ALL_CHARACTERS_DIALOG:
            return {
                open: true,
            }
        default:
            return state
    }
}

export default reducer