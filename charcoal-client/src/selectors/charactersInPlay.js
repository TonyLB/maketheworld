export const getCharactersInPlay = ({ charactersInPlay }) => {
    const { meta, ...rest } = charactersInPlay
    return rest
}

export const getActiveCharacterList = ({ charactersInPlay }) => {
    const { meta, ...rest } = charactersInPlay
    return Object.values(rest).filter(({ ConnectionId }) => (ConnectionId))
}

export const getActiveCharactersInRoom = ({ RoomId, myCharacterId }) => ({ charactersInPlay }) => (
    Object.values(charactersInPlay)
        .filter(({ ConnectionId, RoomId: CharacterRoomId }) => (ConnectionId && (RoomId === CharacterRoomId) ))
        .map(({ color, CharacterId, ...rest }) => ({ CharacterId, color: (CharacterId === myCharacterId) ? { primary: 'blue', light: 'lightblue' } : color, ...rest }))
)

export const getCharactersInPlayFetchNeeded = ({ charactersInPlay }) => (!(charactersInPlay && charactersInPlay.meta && (charactersInPlay.meta.fetching || charactersInPlay.meta.fetched)))
