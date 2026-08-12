import {
    isEphemeraMetaCharacter,
    isEphemeraMetaObject,
    isEphemeraMetaRoom,
    isEphemeraMetaRoomObject,
    isEphemeraLudicGraphData,
    isEphemeraLudicGraphFieldPayload,
    isEphemeraLudicGraphNode,
} from './ephemeraMeta'

const baseRow = {
    uuid: 'OBJECT#helmet' as const,
    shortName: 'helmet',
    stableKey: 'helmet',
}

describe('isEphemeraMetaRoomObject', () => {
    it('accepts minimal row without trope fields', () => {
        expect(isEphemeraMetaRoomObject(baseRow)).toBe(true)
    })

    it('accepts Scene Dressing tropeAffinities', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                tropeAffinities: [{
                    trope: 'Scene Dressing',
                    aptness: 'Good',
                    narrowing: 'protective equipment',
                }],
            })
        ).toBe(true)
    })

    it('accepts mixed Scene Dressing and causal tropes', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                uuid: 'OBJECT#skates' as const,
                shortName: 'rocket skates',
                stableKey: 'rocket-skates',
                tropeAffinities: [
                    { trope: 'Contraption', aptness: 'High', narrowing: 'coyote mobility rig' },
                    { trope: 'Scene Dressing', aptness: 'Good', narrowing: 'racing gear' },
                ],
            })
        ).toBe(true)
    })

    it('accepts tropeAffinitiesFailed with empty tropeAffinities', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
            })
        ).toBe(true)
    })

    it('rejects invalid trope string', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                tropeAffinities: [{ trope: 'wizard', aptness: 'High', narrowing: 'x' }],
            })
        ).toBe(false)
    })

    it('rejects tropeAffinitiesFailed true with non-empty tropeAffinities', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                tropeAffinities: [{ trope: 'Scene Dressing', aptness: 'Good', narrowing: 'gear' }],
                tropeAffinitiesFailed: true,
            })
        ).toBe(false)
    })

    it('rejects more than three tropeAffinities', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                tropeAffinities: [
                    { trope: 'Bait', aptness: 'High', narrowing: 'a' },
                    { trope: 'Bait', aptness: 'Good', narrowing: 'b' },
                    { trope: 'Bait', aptness: 'Poor', narrowing: 'c' },
                    { trope: 'Bait', aptness: 'High', narrowing: 'd' },
                ],
            })
        ).toBe(false)
    })

    it('rejects missing stableKey', () => {
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#a' as const,
                shortName: 'Anvil',
            })
        ).toBe(false)
    })
})

describe('isEphemeraMetaObject', () => {
    const baseMeta = {
        EphemeraId: 'OBJECT#helmet' as const,
        DataCategory: 'Meta::Object' as const,
        stableKey: 'helmet',
    }

    it('accepts minimal Meta::Object row', () => {
        expect(isEphemeraMetaObject(baseMeta)).toBe(true)
    })

    it('accepts trope fields on Meta::Object', () => {
        expect(
            isEphemeraMetaObject({
                ...baseMeta,
                tropeAffinities: [{
                    trope: 'Scene Dressing',
                    aptness: 'Good',
                    narrowing: 'protective equipment',
                }],
            })
        ).toBe(true)
    })

    it('rejects shortName-only shape (pair row fields)', () => {
        expect(
            isEphemeraMetaObject({
                EphemeraId: 'OBJECT#helmet',
                DataCategory: 'Meta::Object',
                stableKey: 'helmet',
                shortName: 'helmet',
            })
        ).toBe(false)
    })

    it('rejects missing stableKey', () => {
        expect(
            isEphemeraMetaObject({
                EphemeraId: 'OBJECT#helmet',
                DataCategory: 'Meta::Object',
            })
        ).toBe(false)
    })
})

describe('isEphemeraLudicGraphNode', () => {
    it('accepts character node with universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Character',
            universalKey: 'CHARACTER#Alpha',
        })).toBe(true)
    })

    it('accepts object node with universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
        })).toBe(true)
    })

    it('rejects non-character non-object tag', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Room',
            universalKey: 'ROOM#Test',
        })).toBe(false)
    })

    it('rejects invalid universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Character',
            universalKey: 'ROOM#Test',
        })).toBe(false)
    })

    it('rejects asset-local key on play node', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Character',
            universalKey: 'CHARACTER#Alpha',
            key: 'hero',
        })).toBe(false)
    })
})

describe('isEphemeraLudicGraphFieldPayload', () => {
    it('accepts character nodes with empty edges', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
            edges: [],
        })).toBe(true)
    })

    it('accepts graph without edges field', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
        })).toBe(true)
    })

    it('accepts mixed character and object nodes', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            nodes: [
                { tag: 'Character', universalKey: 'CHARACTER#Alpha' },
                { tag: 'Object', universalKey: 'OBJECT#helmet' },
            ],
        })).toBe(true)
    })

    it('accepts relational edges on room host graph', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            nodes: [
                { tag: 'Object', universalKey: 'OBJECT#broom' },
                { tag: 'Object', universalKey: 'OBJECT#table' },
            ],
            edges: [{
                tag: 'Relational',
                from: 'OBJECT#broom',
                to: 'OBJECT#table',
                kind: 'On',
            }],
        })).toBe(true)
    })

    it('rejects Custom relational edge without relationLabel', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            nodes: [
                { tag: 'Object', universalKey: 'OBJECT#rope' },
                { tag: 'Object', universalKey: 'OBJECT#crate' },
            ],
            edges: [{
                tag: 'Relational',
                from: 'OBJECT#rope',
                to: 'OBJECT#crate',
                kind: 'Custom',
            }],
        })).toBe(false)
    })

    it('rejects invalid edge envelope', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
            edges: [{ tag: 'Exit', uuid: 'exit-1' }],
        })).toBe(false)
    })
})

describe('isEphemeraLudicGraphData', () => {
    it('accepts host-bound graph with room hostId', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'ROOM#Test',
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
        })).toBe(true)
    })

    it('accepts host-bound graph with character hostId', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'CHARACTER#Beta',
            nodes: [{ tag: 'Object', universalKey: 'OBJECT#helmet' }],
        })).toBe(true)
    })

    it('rejects missing hostId', () => {
        expect(isEphemeraLudicGraphData({
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
        })).toBe(false)
    })

    it('rejects invalid hostId', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'OBJECT#helmet',
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
        })).toBe(false)
    })
})

describe('isEphemeraMetaRoom ludicGraph', () => {
    it('accepts Meta::Room with ludicGraph', () => {
        expect(isEphemeraMetaRoom({
            EphemeraId: 'ROOM#Test',
            DataCategory: 'Meta::Room',
            ludicGraph: {
                nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
            },
        })).toBe(true)
    })

    it('rejects invalid ludicGraph on Meta::Room', () => {
        expect(isEphemeraMetaRoom({
            EphemeraId: 'ROOM#Test',
            DataCategory: 'Meta::Room',
            ludicGraph: {
                nodes: [{ tag: 'Room', universalKey: 'ROOM#Other' }],
            },
        })).toBe(false)
    })

    it('rejects Meta::Room with legacy objects field', () => {
        expect(isEphemeraMetaRoom({
            EphemeraId: 'ROOM#Test',
            DataCategory: 'Meta::Room',
            objects: [{
                uuid: 'OBJECT#helmet',
                shortName: 'helmet',
                stableKey: 'helmet',
            }],
        })).toBe(false)
    })
})

describe('isEphemeraMetaCharacter ludicGraph', () => {
    it('accepts Meta::Character with object-only ludicGraph', () => {
        expect(isEphemeraMetaCharacter({
            EphemeraId: 'CHARACTER#Alpha',
            DataCategory: 'Meta::Character',
            ludicGraph: {
                nodes: [{ tag: 'Object', universalKey: 'OBJECT#helmet' }],
            },
        })).toBe(true)
    })

    it('accepts Meta::Character without ludicGraph', () => {
        expect(isEphemeraMetaCharacter({
            EphemeraId: 'CHARACTER#Alpha',
            DataCategory: 'Meta::Character',
        })).toBe(true)
    })

    it('rejects character host graph with Character nodes', () => {
        expect(isEphemeraMetaCharacter({
            EphemeraId: 'CHARACTER#Alpha',
            DataCategory: 'Meta::Character',
            ludicGraph: {
                nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Beta' }],
            },
        })).toBe(false)
    })

    it('rejects invalid DataCategory', () => {
        expect(isEphemeraMetaCharacter({
            EphemeraId: 'CHARACTER#Alpha',
            DataCategory: 'Meta::Room',
        })).toBe(false)
    })
})
