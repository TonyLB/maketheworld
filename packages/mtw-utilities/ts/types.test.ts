import { PresenceKey } from './types'

describe('PresenceKey', () => {
    it('tags a bare binding uuid', () => {
        expect(PresenceKey('b1')).toBe('PRESENCE#b1')
    })

    // The guarantee presence actually relies on (presenceNodes PN-24). A bare binding uuid and the
    // tagged node id BOTH circulate --- a mint takes the uuid, an exterior address takes the tagged
    // form --- so double-prefixing is a live confusion here rather than a theoretical one.
    it('is idempotent on an already-tagged id, rather than double-prefixing', () => {
        expect(PresenceKey('PRESENCE#b1')).toBe('PRESENCE#b1')
        expect(PresenceKey(PresenceKey('b1'))).toBe('PRESENCE#b1')
    })

    it('throws on an id carrying a different tag, rather than nesting it', () => {
        expect(() => PresenceKey('ROOM#Kitchen')).toThrow()
    })
})
