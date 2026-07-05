import {
    isEphemeraMetaCharacter,
    isEphemeraMetaObject,
    isEphemeraMetaRoom,
    isEphemeraMetaRoomObject,
    isEphemeraPlayPositionGraph,
    isEphemeraPlayPositionGraphNode,
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

describe('isEphemeraPlayPositionGraphNode', () => {
    it('accepts character node with universalKey', () => {
        expect(isEphemeraPlayPositionGraphNode({
            tag: 'Character',
            universalKey: 'CHARACTER#Alpha',
        })).toBe(true)
    })

    it('accepts object node with universalKey', () => {
        expect(isEphemeraPlayPositionGraphNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
        })).toBe(true)
    })

    it('rejects non-character non-object tag', () => {
        expect(isEphemeraPlayPositionGraphNode({
            tag: 'Room',
            universalKey: 'ROOM#Test',
        })).toBe(false)
    })

    it('rejects invalid universalKey', () => {
        expect(isEphemeraPlayPositionGraphNode({
            tag: 'Character',
            universalKey: 'ROOM#Test',
        })).toBe(false)
    })

    it('rejects asset-local key on play node', () => {
        expect(isEphemeraPlayPositionGraphNode({
            tag: 'Character',
            universalKey: 'CHARACTER#Alpha',
            key: 'hero',
        })).toBe(false)
    })
})

describe('isEphemeraPlayPositionGraph', () => {
    it('accepts character nodes with empty edges', () => {
        expect(isEphemeraPlayPositionGraph({
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
            edges: [],
        })).toBe(true)
    })

    it('accepts graph without edges field', () => {
        expect(isEphemeraPlayPositionGraph({
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
        })).toBe(true)
    })

    it('accepts mixed character and object nodes', () => {
        expect(isEphemeraPlayPositionGraph({
            nodes: [
                { tag: 'Character', universalKey: 'CHARACTER#Alpha' },
                { tag: 'Object', universalKey: 'OBJECT#helmet' },
            ],
        })).toBe(true)
    })

    it('accepts relational edges on room host graph', () => {
        expect(isEphemeraPlayPositionGraph({
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
        expect(isEphemeraPlayPositionGraph({
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
        expect(isEphemeraPlayPositionGraph({
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
            edges: [{ tag: 'Exit', uuid: 'exit-1' }],
        })).toBe(false)
    })
})

describe('isEphemeraMetaRoom positionGraph', () => {
    it('accepts Meta::Room with positionGraph', () => {
        expect(isEphemeraMetaRoom({
            EphemeraId: 'ROOM#Test',
            DataCategory: 'Meta::Room',
            positionGraph: {
                nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
            },
        })).toBe(true)
    })

    it('rejects invalid positionGraph on Meta::Room', () => {
        expect(isEphemeraMetaRoom({
            EphemeraId: 'ROOM#Test',
            DataCategory: 'Meta::Room',
            positionGraph: {
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

describe('isEphemeraMetaCharacter positionGraph', () => {
    it('accepts Meta::Character with object-only positionGraph', () => {
        expect(isEphemeraMetaCharacter({
            EphemeraId: 'CHARACTER#Alpha',
            DataCategory: 'Meta::Character',
            positionGraph: {
                nodes: [{ tag: 'Object', universalKey: 'OBJECT#helmet' }],
            },
        })).toBe(true)
    })

    it('accepts Meta::Character without positionGraph', () => {
        expect(isEphemeraMetaCharacter({
            EphemeraId: 'CHARACTER#Alpha',
            DataCategory: 'Meta::Character',
        })).toBe(true)
    })

    it('rejects character host graph with Character nodes', () => {
        expect(isEphemeraMetaCharacter({
            EphemeraId: 'CHARACTER#Alpha',
            DataCategory: 'Meta::Character',
            positionGraph: {
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
