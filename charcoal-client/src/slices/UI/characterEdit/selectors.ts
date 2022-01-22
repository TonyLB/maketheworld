import { CharacterEditPublic, CharacterEditKeys } from './baseClasses'

export type PublicSelectors = {
    getCharacterEditByKey: (state: CharacterEditPublic) => CharacterEditPublic;
    getCharacterEditValues: (state: CharacterEditPublic) => Record<CharacterEditKeys, string>;
    getCharacterEditDirty: (state: CharacterEditPublic) => boolean;
}

export const publicSelectors: PublicSelectors = {
    getCharacterEditByKey: (state) => state,
    getCharacterEditValues: ({ defaultValue, value }) => ({
        ...(['assetKey', 'Name', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit']
            .reduce((previous, label) => ({ ...previous, [label]: '' }), {})
        ) as Record<CharacterEditKeys, string>,
        ...defaultValue,
        ...value
    }),
    getCharacterEditDirty: ({ value }) => (Object.keys(value).length > 0)
}