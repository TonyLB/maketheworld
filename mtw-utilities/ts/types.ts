export const splitType = (value: string) => {
    if (value) {
        const sections = value.split('#')
        if (sections.length) {
            return [sections[0], sections.slice(1).join('#')]
        }
    }
    return ['', '']
}

export const AssetKey = (assetId: string) => (`ASSET#${assetId}`)
export const CharacterKey = (characterId: string) => (`CHARACTER#${characterId}`)
export const RoomKey = (roomId: string) => (`ROOM#${roomId}`)
