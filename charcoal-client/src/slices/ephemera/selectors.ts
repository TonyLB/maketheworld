import { EphemeraPublic, EphemeraCharacterInPlay } from './baseClasses'

export const getCharactersInPlay = (state: EphemeraPublic) => {
    const { charactersInPlay } = state
    const defaultValues = {
        Name: '??????',
        color: {
            primary: 'grey',
            light: 'grey',
            recap: 'grey',
            recapLight: 'grey',
            direct: 'grey'
        },
        Connected: false
    }
    const handlerLookup = (obj: Record<string | symbol, EphemeraCharacterInPlay>, prop: string | symbol): EphemeraCharacterInPlay => (obj[prop] || {
        CharacterId: prop as string,
        ...defaultValues,
    })
    return new Proxy(charactersInPlay, {
        get: handlerLookup,
        ownKeys: (charactersInPlay = {}) => {
            return Object.keys(charactersInPlay).sort()
        },
        getOwnPropertyDescriptor: (obj, prop) => {
            const value = handlerLookup(obj, prop)
            return {
                configurable: Object.getOwnPropertyDescriptor(obj, prop)?.configurable,
                enumerable: Boolean(obj[prop]),
                value
            }
        }
    })

}

export const getActiveCharacterList = (state: EphemeraPublic): EphemeraCharacterInPlay[] => {
    const charactersInPlay = getCharactersInPlay(state)
    return Object.values(charactersInPlay).filter(({ Connected }) => (Connected)) as EphemeraCharacterInPlay[]
}