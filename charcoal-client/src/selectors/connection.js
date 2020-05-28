import { getCharacters } from './characters'

export const getConnectionId = ({ connection }) => connection && connection.connectionId

export const getCurrentRoomId = ({ connection, charactersInPlay }) => connection && connection.characterId && charactersInPlay && charactersInPlay[connection.characterId] && charactersInPlay[connection.characterId].RoomId

export const getCurrentName = (state) => {
    const { connection } = state
    const characters = getCharacters(state)
    return connection && connection.characterId && characters[connection.characterId].Name
}

export const getCharacterId = ({ connection }) => connection && connection.characterId