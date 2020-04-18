import { getMyCharacterByName } from "../../selectors/myCharacters"

export const ACTIVATE_MY_CHARACTER_DIALOG = 'ACTIVATE_MY_CHARACTER_DIALOG'
export const CLOSE_MY_CHARACTER_DIALOG = 'CLOSE_MY_CHARACTER_DIALOG'

export const activateMyCharacterDialog = ({
    characterId = '',
    name = '',
    pronouns = '',
    firstImpression = '',
    outfit = '',
    oneCoolThing = '',
    homeId = '',
    nested = false
}) => ({
    type: ACTIVATE_MY_CHARACTER_DIALOG,
    characterId,
    name,
    pronouns,
    firstImpression,
    outfit,
    oneCoolThing,
    homeId,
    nested
})

export const populateAndActivateMyCharacterDialog = ({
    Name = '',
    nested = false
}) => (dispatch, getState) => {
    if (Name) {
        const state = getState()
        const characterData = getMyCharacterByName(Name)(state)
        dispatch(activateMyCharacterDialog({
            name: characterData.Name,
            characterId: characterData.CharacterId,
            pronouns: characterData.Pronouns,
            firstImpression: characterData.FirstImpression,
            outfit: characterData.Outfit,
            oneCoolThing: characterData.OneCoolThing,
            homeId: characterData.HomeId,
            nested
        }))
    }
    else {
        dispatch(activateMyCharacterDialog({ nested }))
    }
}

export const closeMyCharacterDialog = () => ({ type: CLOSE_MY_CHARACTER_DIALOG })
