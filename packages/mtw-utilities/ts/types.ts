export const splitType = (value: string) => {
    if (value) {
        const sections = value.split('#')
        if (sections.length) {
            return [sections[0], sections.slice(1).join('#')]
        }
    }
    return ['', '']
}

export const enforceTypedKey = <T extends 'ASSET' | 'CHARACTER' | 'ROOM'>(key: T) => (value: string): `${T}#${string}` => {
    const [checkType, checkForTwoSections] = splitType(value)
    if (checkForTwoSections) {
        if (checkType !== key) {
            throw new Error(`Invalid type (${checkType}) in typed string`)
        }
        return value as `${T}#${string}`
    }
    return `${key}#${value}`
}

export const AssetKey = enforceTypedKey('ASSET')
export const CharacterKey = enforceTypedKey('CHARACTER')
export const RoomKey = enforceTypedKey('ROOM')

export const extractConstrainedTag = <O extends string>(typeGuard: (value: string) => value is O) =>  (value: string): O => {
    const [upperTag] = splitType(value)
    if (!upperTag) {
        throw new Error(`No tag: '${value}'`)
    }
    const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`
    if (typeGuard(tag)) {
        return tag
    }
    else {
        throw new Error(`Invalid tag: ${tag}`)
    }
}
