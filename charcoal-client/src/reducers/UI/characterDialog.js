import { ACTIVATE_CHARACTER_DIALOG, CLOSE_CHARACTER_DIALOG } from '../../actions/UI/characterDialog'

export const reducer = (state = { open: false }, action) => {
    const {
        type,
        characterId = '',
        name = '',
        pronouns = '',
        firstImpression = '',
        outfit = '',
        oneCoolThing = '',
        nested = false
    } = action

    switch (type) {

        case CLOSE_CHARACTER_DIALOG:
            return {
                ...state,
                open: false,
                nestedOpen: false
            }
        case ACTIVATE_CHARACTER_DIALOG:
            return {
                open: !nested,
                nestedOpen: nested,
                characterId,
                name,
                pronouns,
                firstImpression,
                outfit,
                oneCoolThing
            }
        default:
            return state
    }
}

export default reducer