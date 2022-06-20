export const splitType = (value) => {
    if (value) {
        const sections = value.split('#')
        if (sections.length) {
            return [sections[0], sections.slice(1).join('#')]
        }
    }
    return ['', '']
}

export const AssetKey = (assetId) => (`ASSET#${assetId}`)
export const CharacterKey = (characterId) => (`CHARACTER#${characterId}`)
export const RoomKey = (roomId) => (`ROOM#${roomId}`)
