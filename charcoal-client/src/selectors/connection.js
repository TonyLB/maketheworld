//
// MARKED FOR OBLIVION
//

import { getCharacters } from './characters'

export const getMyCharacterInPlay = ({ connection, charactersInPlay }) => (connection && connection.characterId && charactersInPlay && charactersInPlay[connection.characterId]) || {}

export const getCurrentRoomId = (state) => getMyCharacterInPlay(state).RoomId

export const getCurrentName = (state) => {
    const characters = getCharacters(state)
    const CharacterId = getMyCharacterInPlay(state).CharacterId
    return CharacterId && characters[CharacterId].Name
}

export const getCharacterId = ({ connection }) => connection && connection.characterId