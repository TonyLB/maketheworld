import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { EphemeraPublic, EphemeraCharacterInPlay } from './baseClasses'

export type PublicSelectorType = {
    getCharactersInPlay: (state: EphemeraPublic) => Record<EphemeraCharacterId, EphemeraCharacterInPlay>;
    getActiveCharacterList: (state: EphemeraPublic) => EphemeraCharacterInPlay[];
}

export const getCharactersInPlay = (state: EphemeraPublic) => {
    const { charactersInPlay } = state
    const defaultValues = {
        Name: '??????',
        RoomId: 'ROOM#VORTEX' as const,
        color: {
            name: 'grey' as const,
            primary: 'grey',
            light: 'grey',
            recap: 'grey',
            recapLight: 'grey',
            direct: 'grey'
        }
    }
    const handlerLookup = (obj: Record<string | symbol, EphemeraCharacterInPlay>, prop: string | symbol): EphemeraCharacterInPlay => {
        const key = typeof prop === 'string' ? prop : String(prop)
        return obj[key] || {
            CharacterId: prop as EphemeraCharacterId,
            ...defaultValues,
        }
    }
    return new Proxy(charactersInPlay, {
        get: (obj, prop) => handlerLookup(obj, prop),
        ownKeys: (charactersInPlay = {}) => {
            return Object.keys(charactersInPlay).sort()
        },
        getOwnPropertyDescriptor: (obj, prop) => {
            const key = typeof prop === 'string' ? prop : String(prop)
            const value = handlerLookup(obj, prop)
            const typedObj = obj as Record<string, EphemeraCharacterInPlay>
            return {
                configurable: Object.getOwnPropertyDescriptor(typedObj, key)?.configurable,
                enumerable: Boolean(typedObj[key]),
                value
            }
        }
    })

}

export const publicSelectors: PublicSelectorType = {
    getCharactersInPlay,
    getActiveCharacterList: (state: EphemeraPublic): EphemeraCharacterInPlay[] => {
        const charactersInPlay = getCharactersInPlay(state)
        return Object.values(charactersInPlay) as EphemeraCharacterInPlay[]
    }
}

export const {
    getActiveCharacterList
} = publicSelectors
