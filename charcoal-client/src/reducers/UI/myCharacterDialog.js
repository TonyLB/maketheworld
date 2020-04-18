import { ACTIVATE_MY_CHARACTER_DIALOG, CLOSE_MY_CHARACTER_DIALOG } from '../../actions/UI/myCharacterDialog'

export const reducer = (state = { open: false }, action) => {
    const {
        type,
        characterId = '',
        name = '',
        pronouns = '',
        firstImpression = '',
        outfit = '',
        oneCoolThing = '',
        homeId = '',
        nested = false
    } = action

    switch (type) {

        case CLOSE_MY_CHARACTER_DIALOG:
            return {
                ...state,
                open: false,
                nestedOpen: false
            }
        case ACTIVATE_MY_CHARACTER_DIALOG:
            return {
                open: !nested,
                nestedOpen: nested,
                characterId,
                name,
                pronouns,
                firstImpression,
                outfit,
                oneCoolThing,
                homeId
            }
        default:
            return state
    }
}

export default reducer