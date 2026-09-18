import {
    isEphemeraMetaCharacter,
    isEphemeraMetaObject,
    isEphemeraMetaRoom,
    isEphemeraMetaRoomObject,
    isEphemeraLudicGraphData,
    isEphemeraLudicGraphFieldPayload,
    isEphemeraLudicGraphNode,
    isEphemeraLudicGraphComponentNode,
    isEphemeraLudicGraphStructureNode,
    isEphemeraLudicGraphPort,
    isEphemeraLudicTerminalPrimitive,
    isEphemeraLudicPortAddress,
    isEphemeraLudicTerminalId,
    ephemeraLudicTerminalOwner,
    ephemeraLudicTerminalsEqual,
    ephemeraLudicTerminalRefersTo,
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

    it('accepts a hosted ludicGraph (MK2)', () => {
        expect(
            isEphemeraMetaObject({
                ...baseMeta,
                ludicGraph: {
                    rootId: 'OBJECT#helmet',
                    ports: [],
                    nodes: [
                        { tag: 'Object', universalKey: 'OBJECT#helmet' },
                        { tag: 'Character', universalKey: 'CHARACTER#Alpha' },
                    ],
                },
            })
        ).toBe(true)
    })

    it('rejects an invalid ludicGraph payload', () => {
        expect(
            isEphemeraMetaObject({
                ...baseMeta,
                ludicGraph: { nodes: [{ tag: 'Character', universalKey: 'ROOM#not-a-character' }] },
            })
        ).toBe(false)
    })
})

describe('isEphemeraLudicTerminalPrimitive', () => {
    it('accepts a room id', () => {
        expect(isEphemeraLudicTerminalPrimitive('ROOM#A')).toBe(true)
    })

    it('accepts a character id', () => {
        expect(isEphemeraLudicTerminalPrimitive('CHARACTER#Alpha')).toBe(true)
    })

    it('accepts an object id', () => {
        expect(isEphemeraLudicTerminalPrimitive('OBJECT#helmet')).toBe(true)
    })

    it('accepts a feature id', () => {
        expect(isEphemeraLudicTerminalPrimitive('FEATURE#Wall')).toBe(true)
    })

    it('accepts an area id', () => {
        expect(isEphemeraLudicTerminalPrimitive('AREA#Test')).toBe(true)
    })

    it('accepts a presence node id (PN-5)', () => {
        expect(isEphemeraLudicTerminalPrimitive('PRESENCE#abc123')).toBe(true)
    })

    it('rejects a non-tagged string', () => {
        expect(isEphemeraLudicTerminalPrimitive('BOGUS#X')).toBe(false)
    })

    it('rejects a port-address object', () => {
        expect(isEphemeraLudicTerminalPrimitive({ owner: 'OBJECT#BOX', port: 'ab6129d' })).toBe(false)
    })
})

describe('isEphemeraLudicPortAddress', () => {
    it('accepts a well-formed port address', () => {
        expect(isEphemeraLudicPortAddress({ owner: 'OBJECT#BOX', port: 'ab6129d' })).toBe(true)
    })

    it('rejects a bare unqualified id', () => {
        expect(isEphemeraLudicPortAddress('OBJECT#BOX')).toBe(false)
    })

    it('rejects a malformed owner', () => {
        expect(isEphemeraLudicPortAddress({ owner: 'BOGUS#X', port: 'ab6129d' })).toBe(false)
    })

    it('rejects an empty port segment', () => {
        expect(isEphemeraLudicPortAddress({ owner: 'OBJECT#BOX', port: '' })).toBe(false)
    })

    it('rejects a presence node as owner (PN-4: a presence node never allocates a port)', () => {
        expect(isEphemeraLudicPortAddress({ owner: 'PRESENCE#abc123', port: 'ab6129d' })).toBe(false)
    })
})

// The union guard: the type was declared well before any guard for it shipped.
describe('isEphemeraLudicTerminalId', () => {
    it('accepts a bare terminal primitive', () => {
        expect(isEphemeraLudicTerminalId('OBJECT#helmet')).toBe(true)
    })

    it('accepts a well-formed port address', () => {
        expect(isEphemeraLudicTerminalId({ owner: 'OBJECT#BOX', port: 'ab6129d' })).toBe(true)
    })

    it('rejects a malformed port address', () => {
        expect(isEphemeraLudicTerminalId({ owner: 'BOGUS#X', port: 'ab6129d' })).toBe(false)
    })

    it('rejects a bogus tagged id', () => {
        expect(isEphemeraLudicTerminalId('BOGUS#X')).toBe(false)
    })

    it('rejects null/undefined/non-string-non-object values', () => {
        expect(isEphemeraLudicTerminalId(null)).toBe(false)
        expect(isEphemeraLudicTerminalId(undefined)).toBe(false)
        expect(isEphemeraLudicTerminalId(42)).toBe(false)
    })
})

describe('ephemeraLudicTerminalOwner', () => {
    it('returns the primitive unchanged for a bare id', () => {
        expect(ephemeraLudicTerminalOwner('ROOM#A')).toBe('ROOM#A')
    })

    it('returns .owner for a port-qualified terminal', () => {
        expect(ephemeraLudicTerminalOwner({ owner: 'OBJECT#BOX', port: 'ab6129d' })).toBe('OBJECT#BOX')
    })
})

describe('ephemeraLudicTerminalsEqual / ephemeraLudicTerminalRefersTo', () => {
    it('treats identical primitives as equal', () => {
        expect(ephemeraLudicTerminalsEqual('OBJECT#BOX', 'OBJECT#BOX')).toBe(true)
    })

    it('treats different primitives as unequal', () => {
        expect(ephemeraLudicTerminalsEqual('OBJECT#BOX', 'OBJECT#ROPE')).toBe(false)
    })

    it('treats a primitive and a port address on the same owner as unequal terminals', () => {
        const address = { owner: 'OBJECT#BOX' as const, port: 'ab6129d' }
        expect(ephemeraLudicTerminalsEqual('OBJECT#BOX', address)).toBe(false)
    })

    it('but ephemeraLudicTerminalRefersTo matches a port address on its owner', () => {
        const address = { owner: 'OBJECT#BOX' as const, port: 'ab6129d' }
        expect(ephemeraLudicTerminalRefersTo(address, 'OBJECT#BOX')).toBe(true)
    })

    it('treats two port addresses with the same owner and port as equal', () => {
        const a = { owner: 'OBJECT#BOX' as const, port: 'ab6129d' }
        const b = { owner: 'OBJECT#BOX' as const, port: 'ab6129d' }
        expect(ephemeraLudicTerminalsEqual(a, b)).toBe(true)
    })

    it('treats two port addresses with the same owner and different port as unequal', () => {
        const a = { owner: 'OBJECT#BOX' as const, port: 'ab6129d' }
        const b = { owner: 'OBJECT#BOX' as const, port: 'k7m2q9' }
        expect(ephemeraLudicTerminalsEqual(a, b)).toBe(false)
    })

    it('treats a presence node id and a tagged port address naming that same binding as equal (presenceNodes Slice 5 item 3 / PN-24)', () => {
        const primitive = 'PRESENCE#presence-1' as const
        const address = { owner: 'ROOM#TABLE' as const, port: 'PRESENCE#presence-1' }
        expect(ephemeraLudicTerminalsEqual(primitive, address)).toBe(true)
        expect(ephemeraLudicTerminalsEqual(address, primitive)).toBe(true)
    })

    it('treats a presence node id and a tagged port address naming a different binding as unequal', () => {
        const primitive = 'PRESENCE#presence-1' as const
        const address = { owner: 'ROOM#TABLE' as const, port: 'PRESENCE#presence-2' }
        expect(ephemeraLudicTerminalsEqual(primitive, address)).toBe(false)
    })

    // The UNTAGGED form is no longer an address for the binding at all (PN-24) --- a bare uuid on
    // a port address names a crossing port, so it must NOT match the presence node that happens to
    // share its uuid. This is the case the pre-PN-24 encoding could not distinguish.
    it('does not match a presence node id against an UNTAGGED port address sharing its uuid', () => {
        const primitive = 'PRESENCE#presence-1' as const
        const address = { owner: 'ROOM#TABLE' as const, port: 'presence-1' }
        expect(ephemeraLudicTerminalsEqual(primitive, address)).toBe(false)
    })

    it('does not extend the presence exception to an ordinary (non-presence) primitive sharing its port value', () => {
        const primitive = 'OBJECT#BOX' as const
        const address = { owner: 'ROOM#TABLE' as const, port: 'OBJECT#BOX' }
        expect(ephemeraLudicTerminalsEqual(primitive, address)).toBe(false)
    })

    // Regression for the one break this encoding change could cause silently: a minted stub port id
    // embeds component ids, so it carries several '#'. `isEphemeraPresenceNodeId` THROWS on that
    // ("Illegal nested EphemeraId"); the port-id-domain predicate must simply return false.
    it('does not throw on a stub port id embedding component ids', () => {
        const primitive = 'PRESENCE#presence-1' as const
        const address = { owner: 'ROOM#A' as const, port: 'STUB-["OBJECT#C","OBJECT#D","Under",""]' }
        expect(() => ephemeraLudicTerminalsEqual(primitive, address)).not.toThrow()
        expect(ephemeraLudicTerminalsEqual(primitive, address)).toBe(false)
    })

    it('treats two crossing-port addresses with the same port but different owners as unequal (owner stays load-bearing for non-presence ports)', () => {
        const a = { owner: 'ROOM#A' as const, port: 'STUB-xyz' }
        const b = { owner: 'ROOM#B' as const, port: 'STUB-xyz' }
        expect(ephemeraLudicTerminalsEqual(a, b)).toBe(false)
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

    it('accepts room node with universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Room',
            universalKey: 'ROOM#Test',
        })).toBe(true)
    })

    it('accepts feature node with universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Feature',
            universalKey: 'FEATURE#Test',
        })).toBe(true)
    })

    it('rejects feature node with invalid universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Feature',
            universalKey: 'ROOM#Test',
        })).toBe(false)
    })

    it('accepts area node with universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Area',
            universalKey: 'AREA#Downtown',
        })).toBe(true)
    })

    it('rejects area node with invalid universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Area',
            universalKey: 'OBJECT#helmet',
        })).toBe(false)
    })

    it('rejects unrecognized tag', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Bogus',
            universalKey: 'FEATURE#Test',
        })).toBe(false)
    })

    it('node tags cover exactly the terminal-primitive kinds', () => {
        const cases: { tag: 'Character' | 'Object' | 'Room' | 'Feature' | 'Area'; universalKey: string }[] = [
            { tag: 'Character', universalKey: 'CHARACTER#Alpha' },
            { tag: 'Object', universalKey: 'OBJECT#helmet' },
            { tag: 'Room', universalKey: 'ROOM#Test' },
            { tag: 'Feature', universalKey: 'FEATURE#Wall' },
            { tag: 'Area', universalKey: 'AREA#Downtown' },
        ]
        cases.forEach(({ universalKey, ...node }) => {
            expect(isEphemeraLudicGraphNode({ ...node, universalKey })).toBe(true)
            expect(isEphemeraLudicTerminalPrimitive(universalKey)).toBe(true)
        })
    })

    it('rejects invalid universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Character',
            universalKey: 'ROOM#Test',
        })).toBe(false)
    })

    it('rejects room node with invalid universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Room',
            universalKey: 'CHARACTER#Alpha',
        })).toBe(false)
    })

    it('rejects asset-local key on play node', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Character',
            universalKey: 'CHARACTER#Alpha',
            key: 'hero',
        })).toBe(false)
    })

    // Structure arm (PN-5, presenceNodes Slice 2; `cover` added Slice 3, PN-19): a presence
    // node is a minted PRESENCE# key plus the host it is presence for and its cover, never a
    // real component id.
    it('accepts a well-formed presence node', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Full' },
        })).toBe(true)
    })

    it('rejects a Presence-tagged node with a component universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Presence',
            universalKey: 'OBJECT#helmet',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Full' },
        })).toBe(false)
    })

    it('rejects a component-tagged node with a presence universalKey', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Object',
            universalKey: 'PRESENCE#abc123',
        })).toBe(false)
    })

    it('rejects a presence node with a malformed fromHostId', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'PRESENCE#xyz789',
            cover: { tag: 'Full' },
        })).toBe(false)
    })

    it('rejects a presence node with a malformed cover', () => {
        expect(isEphemeraLudicGraphNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Bogus' },
        })).toBe(false)
    })
})

describe('isEphemeraLudicGraphComponentNode / isEphemeraLudicGraphStructureNode', () => {
    it('the component guard accepts exactly the five component arms, never Presence', () => {
        expect(isEphemeraLudicGraphComponentNode({ tag: 'Object', universalKey: 'OBJECT#helmet' })).toBe(true)
        expect(isEphemeraLudicGraphComponentNode({ tag: 'Presence', universalKey: 'PRESENCE#abc123', fromHostId: 'ROOM#A', cover: { tag: 'Full' } })).toBe(false)
    })

    it('the structure guard accepts only a well-formed presence node', () => {
        expect(isEphemeraLudicGraphStructureNode({ tag: 'Presence', universalKey: 'PRESENCE#abc123', fromHostId: 'ROOM#A', cover: { tag: 'Full' } })).toBe(true)
        expect(isEphemeraLudicGraphStructureNode({ tag: 'Object', universalKey: 'OBJECT#helmet' })).toBe(false)
    })

    it('both guards reject non-object values without throwing', () => {
        expect(isEphemeraLudicGraphComponentNode(null)).toBe(false)
        expect(isEphemeraLudicGraphComponentNode(undefined)).toBe(false)
        expect(isEphemeraLudicGraphStructureNode(null)).toBe(false)
        expect(isEphemeraLudicGraphStructureNode(undefined)).toBe(false)
    })
})

describe('isEphemeraLudicGraphFieldPayload', () => {
    it('accepts character nodes with empty edges', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'CHARACTER#Alpha',
            ports: [],
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
            edges: [],
        })).toBe(true)
    })

    it('accepts graph without edges field', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'CHARACTER#Alpha',
            ports: [],
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
        })).toBe(true)
    })

    it('accepts mixed character and object nodes', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'CHARACTER#Alpha',
            ports: [],
            nodes: [
                { tag: 'Character', universalKey: 'CHARACTER#Alpha' },
                { tag: 'Object', universalKey: 'OBJECT#helmet' },
            ],
        })).toBe(true)
    })

    it('accepts relational edges on room host graph', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'ROOM#Kitchen',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
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
            rootId: 'ROOM#Kitchen',
            ports: [],
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
            rootId: 'CHARACTER#Alpha',
            ports: [],
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
            edges: [{ tag: 'Exit', uuid: 'exit-1' }],
        })).toBe(false)
    })

    // Concepts clause 3 requires the designated root to be present in the graph's own
    // node list. This is the structural-staleness proving case --- every construction path
    // shipped before that clause was enforced produced a `rootId` with no backing node.
    describe('root-in-nodes (concepts clause 3)', () => {
        it('rejects a payload whose root has no backing node', () => {
            expect(isEphemeraLudicGraphFieldPayload({
                rootId: 'ROOM#Kitchen',
                ports: [],
                nodes: [{ tag: 'Object', universalKey: 'OBJECT#broom' }],
            })).toBe(false)
        })

        it('accepts a payload whose root node is present alongside other members', () => {
            expect(isEphemeraLudicGraphFieldPayload({
                rootId: 'ROOM#Kitchen',
                ports: [],
                nodes: [
                    { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                    { tag: 'Object', universalKey: 'OBJECT#broom' },
                ],
            })).toBe(true)
        })

        it('accepts an empty host-bound graph whose only node is its own root', () => {
            expect(isEphemeraLudicGraphFieldPayload({
                rootId: 'CHARACTER#Alpha',
                ports: [],
                nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
            })).toBe(true)
        })

        it('rejects an empty nodes list even though rootId is well-formed', () => {
            expect(isEphemeraLudicGraphFieldPayload({
                rootId: 'ROOM#Kitchen',
                ports: [],
                nodes: [],
            })).toBe(false)
        })

        it('checks root-in-nodes by owner, not full terminal equality, for a port-qualified root', () => {
            expect(isEphemeraLudicGraphFieldPayload({
                rootId: { owner: 'OBJECT#Box', port: 'ab6129d' },
                ports: [],
                nodes: [{ tag: 'Object', universalKey: 'OBJECT#Box' }],
            })).toBe(true)
        })
    })

    // from/to admit any legal host-kind component now, not only Objects --- matching
    // the host kinds EphemeraMembershipHostId already admits.
    it('accepts a relational edge with Room and Character terminals', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'ROOM#Kitchen',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                { tag: 'Character', universalKey: 'CHARACTER#Alpha' },
            ],
            edges: [{
                tag: 'Relational',
                from: 'ROOM#Kitchen',
                to: 'CHARACTER#Alpha',
                kind: 'On',
            }],
        })).toBe(true)
    })

    it('rejects a relational edge terminal with an illegal tag', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'OBJECT#table',
            ports: [],
            nodes: [{ tag: 'Object', universalKey: 'OBJECT#table' }],
            edges: [{
                tag: 'Relational',
                from: 'ASSET#bogus',
                to: 'OBJECT#table',
                kind: 'On',
            }],
        })).toBe(false)
    })

    // HostRelationalEdgeKind was widened to admit containment ('In'/'PartOf'), and the
    // guard's runtime Set (HOST_RELATIONAL_EDGE_KINDS) had to be widened by hand in lockstep,
    // since a Set literal has no exhaustiveness requirement against the type union -- a stale
    // Set would silently drop every containment edge from the stored payload rather than fail
    // to compile. Accepting each kind here is the agreement check for that Set.
    // Direction corrected 2026-08-20: relation kinds are predicates on the SUBJECT --
    // 'glass -On-> tray' reads "glass is on tray" -- so a containment edge runs member -> root:
    // 'crystalBall -In-> kitchen'. AB-4's "root to part" was a claim about INCIDENCE (every
    // containment edge touches the root, hence the star topology) written down as direction.
    it.each(['In', 'PartOf'] as const)('accepts a %s containment edge, member to root', (kind) => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'ROOM#Kitchen',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                { tag: 'Object', universalKey: 'OBJECT#crystalBall' },
            ],
            edges: [{
                tag: 'Relational',
                from: 'OBJECT#crystalBall',
                to: 'ROOM#Kitchen',
                kind,
            }],
        })).toBe(true)
    })

    // Both kinds are non-exclusive -- a member can be simultaneously In and PartOf
    // the same host, so this must not be modeled as a mutually-exclusive switch anywhere.
    it('accepts both In and PartOf edges between the same pair, coexisting', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'ROOM#Kitchen',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                { tag: 'Object', universalKey: 'OBJECT#crystalBall' },
            ],
            edges: [
                { tag: 'Relational', from: 'OBJECT#crystalBall', to: 'ROOM#Kitchen', kind: 'In' },
                { tag: 'Relational', from: 'OBJECT#crystalBall', to: 'ROOM#Kitchen', kind: 'PartOf' },
            ],
        })).toBe(true)
    })

    // `'Present'` retired from `HostRelationalEdgeKind` entirely at presenceNodes Slice 3
    // (PN-14): its runtime Set (HOST_RELATIONAL_EDGE_KINDS) dropped it in the same change, and
    // no writer ever constructed a `Present`-kind edge (bucket membership moved to `cover`).
    it('rejects a Present relational edge', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'ROOM#Kitchen',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                { tag: 'Object', universalKey: 'OBJECT#crystalBall' },
            ],
            edges: [{
                tag: 'Relational',
                from: { owner: 'ROOM#Kitchen', port: 'ab6129d' },
                to: 'OBJECT#crystalBall',
                kind: 'Present',
            }],
        })).toBe(false)
    })

    // `relationLabel` belongs structurally to `Custom`: it is the free-text name that kind
    // exists to make a place for, and the other six carry none. The rule used to run one way
    // only -- `Custom` required a label, but nothing rejected a label on any other kind -- so
    // `{ kind: 'On', relationLabel: 'balanced across' }` was a legal stored edge. It is now
    // unrepresentable in `EphemeraLudicRelationalEdgeData`, and a guard that accepted it would
    // be lying about the value it narrows. These four cases pin both directions of the rule.
    it.each(['On', 'In', 'PartOf', 'Under', 'Against', 'Present'] as const)(
        'rejects a %s relational edge carrying a relationLabel',
        (kind) => {
            expect(isEphemeraLudicGraphFieldPayload({
                rootId: 'ROOM#Kitchen',
                ports: [],
                nodes: [
                    { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                    { tag: 'Object', universalKey: 'OBJECT#crystalBall' },
                ],
                edges: [{
                    tag: 'Relational',
                    from: 'OBJECT#crystalBall',
                    to: 'ROOM#Kitchen',
                    kind,
                    relationLabel: 'balanced across',
                }],
            })).toBe(false)
        }
    )

    it('accepts a Custom relational edge carrying a non-empty relationLabel', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'ROOM#Kitchen',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                { tag: 'Object', universalKey: 'OBJECT#crystalBall' },
            ],
            edges: [{
                tag: 'Relational',
                from: 'OBJECT#crystalBall',
                to: 'ROOM#Kitchen',
                kind: 'Custom',
                relationLabel: 'balanced across',
            }],
        })).toBe(true)
    })

    it.each([undefined, ''])('rejects a Custom relational edge whose label is %p', (relationLabel) => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'ROOM#Kitchen',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                { tag: 'Object', universalKey: 'OBJECT#crystalBall' },
            ],
            edges: [{
                tag: 'Relational',
                from: 'OBJECT#crystalBall',
                to: 'ROOM#Kitchen',
                kind: 'Custom',
                ...(relationLabel === undefined ? {} : { relationLabel }),
            }],
        })).toBe(false)
    })

    // EA-8: `edgeId` is optional per edge, so *absent* is the common case and stays legal. What
    // the guard adds is that a **present** id must be a usable one --- an empty string or a
    // non-string is rejected on the same reasoning as an empty `relationLabel` above, since a
    // predicate that admitted it would narrow to a type whose field cannot be read. A stored row
    // in that shape is not lost: `extractRelationalEdgesFromStored`'s recovery branch keeps the
    // relation and drops the id, exactly as it strips a stray label.
    it('accepts a relational edge carrying a non-empty edgeId, and one carrying none', () => {
        const payload = (edge: Record<string, unknown>) => ({
            rootId: 'ROOM#Kitchen',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                { tag: 'Object', universalKey: 'OBJECT#crystalBall' },
            ],
            edges: [edge],
        })
        expect(isEphemeraLudicGraphFieldPayload(payload({
            tag: 'Relational', edgeId: 'edge-1', from: 'OBJECT#crystalBall', to: 'ROOM#Kitchen', kind: 'On',
        }))).toBe(true)
        expect(isEphemeraLudicGraphFieldPayload(payload({
            tag: 'Relational', from: 'OBJECT#crystalBall', to: 'ROOM#Kitchen', kind: 'On',
        }))).toBe(true)
    })

    it.each(['', 7, null, {}])('rejects a relational edge whose edgeId is %p', (edgeId) => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'ROOM#Kitchen',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                { tag: 'Object', universalKey: 'OBJECT#crystalBall' },
            ],
            edges: [{
                tag: 'Relational',
                edgeId,
                from: 'OBJECT#crystalBall',
                to: 'ROOM#Kitchen',
                kind: 'On',
            }],
        })).toBe(false)
    })

    // P8 iteration 1: `chainId` takes the same shape of check, and it matters more --- this field
    // *is* consulted by comparison, so an unusable value admitted here would go on to decide leg
    // sameness rather than sit inert the way a bad `edgeId` would.
    it('accepts a relational edge carrying a non-empty chainId, and one carrying none', () => {
        const payload = (edge: Record<string, unknown>) => ({
            rootId: 'ROOM#Kitchen',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                { tag: 'Object', universalKey: 'OBJECT#crystalBall' },
            ],
            edges: [edge],
        })
        expect(isEphemeraLudicGraphFieldPayload(payload({
            tag: 'Relational', chainId: 'chain-1', from: 'OBJECT#crystalBall', to: 'ROOM#Kitchen', kind: 'On',
        }))).toBe(true)
        // Both identity fields at once, since they are independent facts about a leg.
        expect(isEphemeraLudicGraphFieldPayload(payload({
            tag: 'Relational', edgeId: 'edge-1', chainId: 'chain-1', from: 'OBJECT#crystalBall', to: 'ROOM#Kitchen', kind: 'On',
        }))).toBe(true)
        expect(isEphemeraLudicGraphFieldPayload(payload({
            tag: 'Relational', from: 'OBJECT#crystalBall', to: 'ROOM#Kitchen', kind: 'On',
        }))).toBe(true)
    })

    it.each(['', 7, null, {}])('rejects a relational edge whose chainId is %p', (chainId) => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'ROOM#Kitchen',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Kitchen' },
                { tag: 'Object', universalKey: 'OBJECT#crystalBall' },
            ],
            edges: [{
                tag: 'Relational',
                chainId,
                from: 'OBJECT#crystalBall',
                to: 'ROOM#Kitchen',
                kind: 'On',
            }],
        })).toBe(false)
    })

    // PQ-10: a port address (`{ owner, port }`) is not a string, so the guard as it stood
    // before port terminals were legal called isEphemeraObjectId(edge.from) unconditionally and
    // crashed with "value.split is not a function" instead of returning false -- hardened at the
    // time to a typeof pre-check that rejected the (then-illegal) port terminal cleanly instead.
    // The 2026-08-22 widening admits a port-qualified terminal in the field itself, so the correct
    // behavior flips from reject-cleanly to accept -- this is the regression these guards exist to
    // prove (a valid edge must not silently vanish from the stored payload).
    it('accepts a port-qualified relational edge terminal', () => {
        const edges = [{
            tag: 'Relational',
            from: { owner: 'OBJECT#broom', port: 'ab6129d' },
            to: 'OBJECT#table',
            kind: 'On',
        }]
        expect(() => isEphemeraLudicGraphFieldPayload({
            rootId: 'OBJECT#broom',
            ports: [],
            nodes: [
                { tag: 'Object', universalKey: 'OBJECT#broom' },
                { tag: 'Object', universalKey: 'OBJECT#table' },
            ],
            edges,
        })).not.toThrow()
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'OBJECT#broom',
            ports: [],
            nodes: [
                { tag: 'Object', universalKey: 'OBJECT#broom' },
                { tag: 'Object', universalKey: 'OBJECT#table' },
            ],
            edges,
        })).toBe(true)
    })

    it('accepts a relational edge with a port-qualified terminal on both ends', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'OBJECT#broom',
            ports: [],
            nodes: [
                { tag: 'Object', universalKey: 'OBJECT#broom' },
                { tag: 'Object', universalKey: 'OBJECT#table' },
            ],
            edges: [{
                tag: 'Relational',
                from: { owner: 'OBJECT#broom', port: 'ab6129d' },
                to: { owner: 'OBJECT#table', port: 'cf0192a' },
                kind: 'On',
            }],
        })).toBe(true)
    })

    it('still rejects an edge terminal that is neither a valid primitive nor a valid port address', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'OBJECT#broom',
            ports: [],
            nodes: [{ tag: 'Object', universalKey: 'OBJECT#broom' }],
            edges: [{
                tag: 'Relational',
                from: { owner: 'BOGUS#X', port: 'ab6129d' },
                to: 'OBJECT#broom',
                kind: 'On',
            }],
        })).toBe(false)
    })

    // rootId is required, with no default --- gated on the stored-graph reset that cleared
    // every legacy payload, so no row predates the requirement.
    it('rejects a payload missing rootId', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
        })).toBe(false)
    })

    it('rejects a malformed rootId (neither a terminal primitive nor a port address)', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: 'ASSET#bogus',
            ports: [],
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
        })).toBe(false)
    })

    // rootId's declared type is the full EphemeraLudicTerminalId union, so the guard must accept
    // a well-formed port address. Written while edge terminals were still node-only and kept
    // after they widened: the assertion is about the union, not about what currently produces one.
    it('accepts a port-address rootId', () => {
        expect(isEphemeraLudicGraphFieldPayload({
            rootId: { owner: 'OBJECT#box', port: 'ab6129d' },
            ports: [],
            nodes: [{ tag: 'Object', universalKey: 'OBJECT#box' }],
        })).toBe(true)
    })

    // ports is required and possibly empty, not optional like edges --- see `rootId`'s
    // precedent above for why no `??= []` belongs at this boundary.
    describe('ports (the egress list)', () => {
        it('rejects a payload missing ports entirely', () => {
            expect(isEphemeraLudicGraphFieldPayload({
                rootId: 'ROOM#Kitchen',
                nodes: [{ tag: 'Room', universalKey: 'ROOM#Kitchen' }],
            })).toBe(false)
        })

        it('rejects a non-array ports value', () => {
            expect(isEphemeraLudicGraphFieldPayload({
                rootId: 'ROOM#Kitchen',
                nodes: [{ tag: 'Room', universalKey: 'ROOM#Kitchen' }],
                ports: 'not-an-array',
            })).toBe(false)
        })

        it('rejects a malformed port entry (bad fromHostId)', () => {
            expect(isEphemeraLudicGraphFieldPayload({
                rootId: 'ROOM#Kitchen',
                nodes: [{ tag: 'Room', universalKey: 'ROOM#Kitchen' }],
                ports: [{ portId: 'ab6129d', fromHostId: 'ASSET#bogus', kind: 'On' }],
            })).toBe(false)
        })

        it('rejects a malformed port entry (non-string portId)', () => {
            expect(isEphemeraLudicGraphFieldPayload({
                rootId: 'ROOM#Kitchen',
                nodes: [{ tag: 'Room', universalKey: 'ROOM#Kitchen' }],
                ports: [{ portId: 123, fromHostId: 'OBJECT#box', kind: 'On' }],
            })).toBe(false)
        })

        it('accepts a well-formed non-empty ports array', () => {
            expect(isEphemeraLudicGraphFieldPayload({
                rootId: 'OBJECT#box',
                nodes: [{ tag: 'Object', universalKey: 'OBJECT#box' }],
                ports: [{ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen', kind: 'On' }],
            })).toBe(true)
        })
    })
})

describe('isEphemeraLudicGraphPort', () => {
    it('accepts a well-formed port entry', () => {
        expect(isEphemeraLudicGraphPort({ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen', kind: 'On' })).toBe(true)
    })

    it('rejects a malformed fromHostId', () => {
        expect(isEphemeraLudicGraphPort({ portId: 'ab6129d', fromHostId: 'ASSET#bogus', kind: 'On' })).toBe(false)
    })

    it('rejects a non-string portId', () => {
        expect(isEphemeraLudicGraphPort({ portId: 123, fromHostId: 'ROOM#Kitchen', kind: 'On' })).toBe(false)
    })

    it('rejects a non-object value', () => {
        expect(isEphemeraLudicGraphPort('OBJECT#box#ab6129d')).toBe(false)
    })

    // The discriminator (PR-11). Required --- a port without it leaves `ports.length`
    // ambiguous between presence bindings and relational pass-throughs, which is the exact
    // defect the field exists to remove.
    it('rejects a port with no kind', () => {
        expect(isEphemeraLudicGraphPort({ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen' })).toBe(false)
    })

    it('rejects a kind outside HostRelationalEdgeKind', () => {
        expect(isEphemeraLudicGraphPort({ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen', kind: 'Beside' })).toBe(false)
    })

    // The union is taken unrestricted (PR-11) --- including the three values no corpus case can
    // yet construct. Narrowing it would mint the second partition the reuse exists to avoid.
    // `'Present'` dropped from this list at presenceNodes Slice 7a: it is no longer in the domain
    // this guard accepts at all, see the rejection test below.
    it.each(['On', 'Under', 'Against', 'In', 'PartOf'])('accepts a %s port with no label', (kind) => {
        expect(isEphemeraLudicGraphPort({ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen', kind })).toBe(true)
    })

    // presenceNodes Slice 7a (PN-14/PN-23): a presence binding is a node now, never a port, so
    // `'Present'` retired from this guard's accepted domain outright --- `isEphemeraLudicGraphPort`
    // used to accept it (as `EphemeraPresencePort`), and now rejects it the same way any other
    // kind outside `HostRelationalEdgeKind` is rejected.
    it("rejects a 'Present' kind port outright", () => {
        expect(isEphemeraLudicGraphPort({ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen', kind: 'Present' })).toBe(false)
    })

    it('accepts a Custom port carrying a non-empty exterior label', () => {
        expect(isEphemeraLudicGraphPort({ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen', kind: 'Custom', exteriorRelationLabel: 'threads into' })).toBe(true)
    })

    it('rejects a Custom port with no exterior label', () => {
        expect(isEphemeraLudicGraphPort({ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen', kind: 'Custom' })).toBe(false)
    })

    it('rejects a Custom port with an empty exterior label', () => {
        expect(isEphemeraLudicGraphPort({ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen', kind: 'Custom', exteriorRelationLabel: '' })).toBe(false)
    })

    it('rejects a non-string exterior label on a non-Custom port', () => {
        expect(isEphemeraLudicGraphPort({ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen', kind: 'On', exteriorRelationLabel: 12 })).toBe(false)
    })

    // `'rejects a Present port carrying any exterior label ... (PR-15: presence ports have no such
    // field)'` deleted at presenceNodes Slice 7a: `'Present'` is rejected outright now on `kind`
    // alone (see above), so there is no longer a distinct "wrong field" case to pin for it.
})

describe('isEphemeraLudicGraphData', () => {
    it('accepts host-bound graph with room hostId', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'ROOM#Test',
            rootId: 'ROOM#Test',
            ports: [],
            nodes: [
                { tag: 'Room', universalKey: 'ROOM#Test' },
                { tag: 'Character', universalKey: 'CHARACTER#Alpha' },
            ],
        })).toBe(true)
    })

    it('accepts host-bound graph with character hostId', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'CHARACTER#Beta',
            rootId: 'CHARACTER#Beta',
            ports: [],
            nodes: [
                { tag: 'Character', universalKey: 'CHARACTER#Beta' },
                { tag: 'Object', universalKey: 'OBJECT#helmet' },
            ],
        })).toBe(true)
    })

    it('accepts host-bound graph with object hostId (recursive hosting)', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'OBJECT#Box',
            rootId: 'OBJECT#Box',
            ports: [],
            nodes: [
                { tag: 'Object', universalKey: 'OBJECT#Box' },
                { tag: 'Object', universalKey: 'OBJECT#Spring' },
            ],
        })).toBe(true)
    })

    it('accepts host-bound graph with feature hostId (FEATURE#Wall hosts FEATURE#Niche)', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'FEATURE#Wall',
            rootId: 'FEATURE#Wall',
            ports: [],
            nodes: [
                { tag: 'Feature', universalKey: 'FEATURE#Wall' },
                { tag: 'Object', universalKey: 'OBJECT#helmet' },
            ],
        })).toBe(true)
    })

    it('accepts feature host with its own root node in the node list (root present per concepts clause 3)', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'FEATURE#Wall',
            rootId: 'FEATURE#Wall',
            ports: [],
            nodes: [
                { tag: 'Feature', universalKey: 'FEATURE#Wall' },
                { tag: 'Feature', universalKey: 'FEATURE#Niche' },
            ],
        })).toBe(true)
    })

    it('accepts host-bound graph with area hostId', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'AREA#Downtown',
            rootId: 'AREA#Downtown',
            ports: [],
            nodes: [
                { tag: 'Area', universalKey: 'AREA#Downtown' },
                { tag: 'Object', universalKey: 'OBJECT#helmet' },
            ],
        })).toBe(true)
    })

    it('accepts area host with its own root node in the node list (root present per concepts clause 3)', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'AREA#Downtown',
            rootId: 'AREA#Downtown',
            ports: [],
            nodes: [{ tag: 'Area', universalKey: 'AREA#Downtown' }],
        })).toBe(true)
    })

    it('rejects missing hostId', () => {
        expect(isEphemeraLudicGraphData({
            rootId: 'CHARACTER#Alpha',
            ports: [],
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
        })).toBe(false)
    })

    it('rejects invalid hostId', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'KNOWLEDGE#helmet',
            rootId: 'CHARACTER#Alpha',
            ports: [],
            nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
        })).toBe(false)
    })

    it('rejects missing rootId', () => {
        expect(isEphemeraLudicGraphData({
            hostId: 'ROOM#Test',
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
                rootId: 'ROOM#Test',
                ports: [],
                nodes: [
                    { tag: 'Room', universalKey: 'ROOM#Test' },
                    { tag: 'Character', universalKey: 'CHARACTER#Alpha' },
                ],
            },
        })).toBe(true)
    })

    it('rejects invalid ludicGraph on Meta::Room', () => {
        expect(isEphemeraMetaRoom({
            EphemeraId: 'ROOM#Test',
            DataCategory: 'Meta::Room',
            ludicGraph: {
                rootId: 'ROOM#Test',
                ports: [],
                nodes: [{ tag: 'Feature', universalKey: 'OBJECT#Other' }],
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
                rootId: 'CHARACTER#Alpha',
                ports: [],
                nodes: [
                    { tag: 'Character', universalKey: 'CHARACTER#Alpha' },
                    { tag: 'Object', universalKey: 'OBJECT#helmet' },
                ],
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
                rootId: 'CHARACTER#Alpha',
                ports: [],
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
