import { getCharacters } from './characters'

export const getCharactersInPlay = (state) => {
    const characters = getCharacters(state)
    const { charactersInPlay } = state
    const { meta, ...chars } = charactersInPlay
    const defaultValues = {
        Name: '??????',
        color: { primary: 'grey' },
        Connected: false
    }
    return new Proxy({ characters, charactersInPlay: chars ?? {} }, {
        get: (obj, prop) => ({
            ...defaultValues,
            ...(obj.characters[prop] ?? {}),
            ...(obj.charactersInPlay[prop] ?? {})
        })
    })

}

export const getActiveCharacterList = (state) => {
    const charactersInPlay = getCharactersInPlay(state)
    return Object.values(charactersInPlay).filter(({ Connected }) => (Connected))
}

export const getActiveCharactersInRoom = ({ RoomId, myCharacterId }) => (state) => {
    const charactersInPlay = getCharactersInPlay(state)
    return Object.values(charactersInPlay)
        .filter(({ Connected, RoomId: CharacterRoomId }) => (Connected && (RoomId === CharacterRoomId) ))
        .map(({ color, CharacterId, ...rest }) => ({ CharacterId, color: (CharacterId === myCharacterId) ? { primary: 'blue', light: 'lightblue' } : color, ...rest }))
}

export const getCharactersInPlayFetchNeeded = ({ charactersInPlay }) => (!(charactersInPlay && charactersInPlay.meta && (charactersInPlay.meta.fetching || charactersInPlay.meta.fetched)))
