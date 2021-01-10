export const ACTIVATE_CHARACTER = 'ACTIVATE_CHARACTER'
export const DEACTIVATE_CHARACTER = 'DEACTIVATE_CHARACTER'

export const activateCharacter = (CharacterId) => ({ type: ACTIVATE_CHARACTER, CharacterId })

export const deactivateCharacter = (CharacterId) => ({ type: DEACTIVATE_CHARACTER, CharacterId })
