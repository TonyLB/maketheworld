import { getCharacters } from './characters'

export const getCharactersInPlay = (state: any) => {
    const characters: Record<string, any> = getCharacters(state)
    const { charactersInPlay }: { charactersInPlay: Record<string, any> } = state
    const { meta, ...chars } = charactersInPlay
    const defaultValues = {
        Name: '??????',
        color: { primary: 'grey' },
        Connected: false
    }
    const handlerLookup = (obj: any, prop: any) => ({
        CharacterId: prop,
        ...defaultValues,
        ...(obj.characters[prop] ?? {}),
        ...(obj.charactersInPlay[prop] ?? {})
    })
    return new Proxy({ characters, charactersInPlay: chars ?? {} }, {
        get: handlerLookup,
        ownKeys: ({ characters = {}, charactersInPlay = {} }) => {
            return [...(new Set([ ...Object.keys(charactersInPlay), ...Object.keys(characters)]) as any)].sort()
        },
        getOwnPropertyDescriptor: (obj, prop) => ({
            configurable: true,
            enumerable: Boolean(obj.charactersInPlay[prop]) || Boolean(obj.characters[prop]),
            value: handlerLookup(obj, prop)
        })
    })

}

export const getActiveCharacterList = (state: any) => {
    const charactersInPlay: Record<string, { Connected: boolean }> = getCharactersInPlay(state)
    return Object.values(charactersInPlay).filter(({ Connected }) => (Connected))
}

export const getActiveCharactersInRoom = ({ RoomId, myCharacterId }: { RoomId: string, myCharacterId?: string }) => (state: any) => {
    const charactersInPlay: Record<string, { color: any, CharacterId: string, Connected: boolean, RoomId: string, Name: string }> = getCharactersInPlay(state)
    return Object.values(charactersInPlay)
        .filter(({ Connected, RoomId: CharacterRoomId }) => (Connected && (RoomId === CharacterRoomId) ))
        .map(({ color, CharacterId, ...rest }) => ({ CharacterId, color: (CharacterId === myCharacterId) ? { primary: 'blue', light: 'lightblue' } : color, ...rest }))
}

export const getCharactersInPlayFetchNeeded = ({ charactersInPlay }: { charactersInPlay: Record<string, any> }) => (!(charactersInPlay && charactersInPlay.meta && (charactersInPlay.meta.fetching || charactersInPlay.meta.fetched)))
