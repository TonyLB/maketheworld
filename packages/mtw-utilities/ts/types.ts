export const splitType = (value: string) => {
    if (value) {
        const sections = value.split('#')
        if (sections.length) {
            return [sections[0], sections.slice(1).join('#')]
        }
    }
    return ['', '']
}

export const AssetKey = (assetId: string): `ASSET#${string}` => (`ASSET#${assetId}`)
export const CharacterKey = (characterId: string): `CHARACTER#${string}` => (`CHARACTER#${characterId}`)
export const RoomKey = (roomId: string): `ROOM#${string}` => (`ROOM#${roomId}`)

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
