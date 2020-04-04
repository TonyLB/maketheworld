import { getCharacterByName } from "../../selectors/characters"

export const ACTIVATE_CHARACTER_DIALOG = 'ACTIVATE_CHARACTER_DIALOG'
export const CLOSE_CHARACTER_DIALOG = 'CLOSE_CHARACTER_DIALOG'

export const activateCharacterDialog = ({
    characterId = '',
    name = '',
    pronouns = '',
    firstImpression = '',
    outfit = '',
    oneCoolThing = '',
    nested = false
}) => ({
    type: ACTIVATE_CHARACTER_DIALOG,
    characterId,
    name,
    pronouns,
    firstImpression,
    outfit,
    oneCoolThing,
    nested
})

export const populateAndActivateCharacterDialog = ({
    Name = '',
    nested = false
}) => (dispatch, getState) => {
    if (Name) {
        const state = getState()
        const characterData = getCharacterByName(Name)(state)
        dispatch(activateCharacterDialog({
            name: characterData.Name,
            characterId: characterData.CharacterId,
            pronouns: characterData.Pronouns,
            firstImpression: characterData.FirstImpression,
            outfit: characterData.Outfit,
            oneCoolThing: characterData.OneCoolThing,
            nested
        }))
    }
    else {
        dispatch(activateCharacterDialog({ nested }))
    }
}

export const closeCharacterDialog = () => ({ type: CLOSE_CHARACTER_DIALOG })
