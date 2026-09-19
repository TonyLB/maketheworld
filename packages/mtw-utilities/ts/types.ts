export const splitType = (value: string) => {
    if (value) {
        const sections = value.split('#')
        if (sections.length) {
            return [sections[0], sections.slice(1).join('#')]
        }
    }
    return ['', '']
}

// Not the component-addressable universe --- CONNECTION, SESSION and PRESENCE are typed string
// keys that name no component. In particular PRESENCE belongs here without contradicting
// `EphemeraPresenceNodeId`'s own rule (baseClasses.ts) that it stays OUT of the `EphemeraId`
// allowlist, which is the union that does mean component-addressable.
type PrefixKey = 'ASSET' | 'AREA' | 'CHARACTER' | 'ROOM' | 'EXAMPLE' | 'FEATURE' | 'KNOWLEDGE' | 'MAP' | 'MESSAGE' | 'MOMENT' | 'IMAGE' | 'CONNECTION' | 'SESSION' | 'MARK' | 'LENS' | 'GUIDANCE' | 'SITUATION' | 'OBJECT' | 'PRESENCE'

export const enforceTypedKey = <T extends PrefixKey>(key: T) => (value: string): `${T}#${string}` => {
    const [checkType, checkForTwoSections] = splitType(value)
    if (checkForTwoSections) {
        if (checkType !== key) {
            throw new Error(`Invalid type (${checkType}) in typed string`)
        }
        return value as `${T}#${string}`
    }
    return `${key}#${value}`
}

export const stripTypedKey = <T extends PrefixKey>(key: T) => (value: string): string => {
    if (value.startsWith(`${key}#`)) {
        return value.slice(key.length + 1)
    }
    return value
}

export const AssetKey = enforceTypedKey('ASSET')
export const CharacterKey = enforceTypedKey('CHARACTER')
export const RoomKey = enforceTypedKey('ROOM')
export const ObjectKey = enforceTypedKey('OBJECT')
export const ConnectionKey = enforceTypedKey('CONNECTION')
export const SessionKey = enforceTypedKey('SESSION')
/** Returns exactly `EphemeraPresenceNodeId` (`PRESENCE#${string}`), so call sites need no cast.
 * Idempotent on an already-tagged id, which is why presence uses it: a bare binding uuid and the
 * tagged node id both circulate here (a mint takes the uuid, an exterior address takes the tagged
 * form --- presenceNodes PN-24), so double-prefixing is a live confusion rather than a theoretical
 * one. */
export const PresenceKey = enforceTypedKey('PRESENCE')

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
