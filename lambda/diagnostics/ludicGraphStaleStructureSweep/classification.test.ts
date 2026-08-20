import { describe, it, expect } from '@jest/globals'
import { isLudicGraphStructurallyStale } from './classification'

describe('isLudicGraphStructurallyStale', () => {
    it('returns false when ludicGraph is absent (not yet written, not stale)', () => {
        expect(isLudicGraphStructurallyStale(undefined)).toBe(false)
    })

    it('returns true for a payload whose root has no backing node (LP4i proving case)', () => {
        expect(isLudicGraphStructurallyStale({
            rootId: 'ROOM#Kitchen',
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#one' }],
        })).toBe(true)
    })

    it('returns false for a payload whose root node is present and ports is well-formed', () => {
        expect(isLudicGraphStructurallyStale({
            rootId: 'ROOM#Kitchen',
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                { tag: 'Character', universalKey: 'CHARACTER#one' },
            ],
            ports: [],
        })).toBe(false)
    })

    it('returns true for a payload that fails the guard for reasons other than root-in-nodes', () => {
        expect(isLudicGraphStructurallyStale({ nodes: 'bad' })).toBe(true)
        expect(isLudicGraphStructurallyStale(null)).toBe(true)
    })

    // LP4d proving case: the guard picks up a missing `ports` (premise 12, required and possibly
    // empty) as staleness with no change needed in this file --- it's a pure pass-through to
    // isEphemeraLudicGraphFieldPayload.
    it('returns true for an otherwise-current payload missing ports (LP4d proving case)', () => {
        expect(isLudicGraphStructurallyStale({
            rootId: 'ROOM#Kitchen',
            nodes: [{ tag: 'Room', universalKey: 'ROOM#Kitchen' }],
        })).toBe(true)
    })
})
