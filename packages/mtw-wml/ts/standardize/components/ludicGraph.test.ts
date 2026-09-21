import { StandardLudicGraph } from "./ludicGraph"
import StandardReference from "../keys/reference"
import { ReferenceList } from "./reference"

describe("StandardLudicGraph", () => {
    describe("empty omission", () => {
        it("omits nodes in toJSON for default graph", () => {
            const graph = new StandardLudicGraph()
            expect(graph.nodes.payload.length).toBe(0)
            expect(graph.toJSON()).toBeUndefined()
        })

        it("omits nodes in toJSON for fromJSON with empty object", () => {
            const graph = StandardLudicGraph.fromJSON({})
            expect(graph.nodes.payload.length).toBe(0)
            expect(graph.toJSON()).toBeUndefined()
        })
    })

    describe("round-trip", () => {
        it("serializes heterogeneous nodes", () => {
            const graph = StandardLudicGraph.fromJSON({
                nodes: [
                    { tag: 'Area', key: 'downtown' },
                    { tag: 'Room', key: 'cafe' },
                    { tag: 'Feature', key: 'fountain' },
                    { tag: 'Character', key: 'guard' },
                ],
            })
            expect(graph.toJSON()).toEqual({
                nodes: [
                    { tag: 'Area', key: 'downtown' },
                    { tag: 'Room', key: 'cafe' },
                    { tag: 'Feature', key: 'fountain' },
                    { tag: 'Character', key: 'guard' },
                ],
            })
        })
    })

    describe("merge", () => {
        it("merges heterogeneous nodes and combines ref counts for matching keys", () => {
            const base = StandardLudicGraph.fromJSON({
                nodes: [
                    { tag: 'Area', key: 'downtown', ref: 1 },
                    { tag: 'Room', key: 'cafe', ref: 1 },
                ],
            })
            const incoming = StandardLudicGraph.fromJSON({
                nodes: [
                    { tag: 'Room', key: 'cafe', ref: 1 },
                    { tag: 'Feature', key: 'fountain', ref: 1 },
                ],
            })
            const merged = base.merge(incoming)
            expect(merged.nodes.payload).toHaveLength(3)
            const mergedRefs = merged.nodes.componentRefs.payload
            expect(mergedRefs.find((ref) => ref.tag === 'Area' && ref.key === 'downtown')?.ref).toBe(1)
            expect(mergedRefs.find((ref) => ref.tag === 'Room' && ref.key === 'cafe')?.ref).toBe(2)
            expect(mergedRefs.find((ref) => ref.tag === 'Feature' && ref.key === 'fountain')?.ref).toBe(1)
        })
    })

    describe("diff", () => {
        it("diffs heterogeneous nodes across tags", () => {
            const base = StandardLudicGraph.fromJSON({
                nodes: [
                    { tag: 'Area', key: 'downtown', ref: 1 },
                    { tag: 'Room', key: 'cafe', ref: 1 },
                ],
            })
            const incoming = StandardLudicGraph.fromJSON({
                nodes: [
                    { tag: 'Room', key: 'cafe', ref: 2 },
                    { tag: 'Feature', key: 'fountain', ref: 1 },
                ],
            })
            const diffed = base.diff(incoming)
            expect(diffed).toBeDefined()
            const diffedRefs = diffed!.nodes.componentRefs.payload
            expect(diffedRefs.find((ref) => ref.tag === 'Area' && ref.key === 'downtown')?.ref).toBe(-1)
            expect(diffedRefs.find((ref) => ref.tag === 'Room' && ref.key === 'cafe')?.ref).toBe(1)
            expect(diffedRefs.find((ref) => ref.tag === 'Feature' && ref.key === 'fountain')?.ref).toBe(1)
        })

        it("returns undefined when diff is empty", () => {
            const graph = StandardLudicGraph.fromJSON({
                nodes: [{ tag: 'Room', key: 'cafe', ref: 1 }],
            })
            const same = StandardLudicGraph.fromJSON({
                nodes: [{ tag: 'Room', key: 'cafe', ref: 1 }],
            })
            expect(graph.diff(same)).toBeUndefined()
        })
    })

    describe("equals", () => {
        it("is order-insensitive for equivalent heterogeneous lists", () => {
            const graphA = StandardLudicGraph.fromJSON({
                nodes: [
                    { tag: 'Area', key: 'downtown' },
                    { tag: 'Room', key: 'cafe', ref: 2 },
                ],
            })
            const graphB = StandardLudicGraph.fromJSON({
                nodes: [
                    { tag: 'Room', key: 'cafe', ref: 2 },
                    { tag: 'Area', key: 'downtown' },
                ],
            })
            expect(graphA.equals(graphB)).toBe(true)
        })

        it("returns false for non-StandardLudicGraph", () => {
            const graph = new StandardLudicGraph()
            expect(graph.equals({} as StandardLudicGraph)).toBe(false)
        })
    })

    describe("nodesByTag", () => {
        it("filters by tag without mutating source graph", () => {
            const graph = StandardLudicGraph.fromJSON({
                nodes: [
                    { tag: 'Area', key: 'downtown' },
                    { tag: 'Room', key: 'cafe' },
                    { tag: 'Feature', key: 'fountain' },
                ],
            })
            const rooms = graph.nodesByTag('Room')
            expect(rooms.payload).toHaveLength(1)
            expect(rooms.payload[0].tag).toBe('Room')
            expect(graph.nodes.payload).toHaveLength(3)
        })
    })

    describe("clone", () => {
        it("clones nodes independently", () => {
            const graph = StandardLudicGraph.fromJSON({
                nodes: [{ tag: 'Room', key: 'cafe', ref: 1 }],
            })
            const cloned = graph.clone()
            expect(cloned.equals(graph)).toBe(true)
            expect(cloned).not.toBe(graph)
            expect(cloned.nodes).not.toBe(graph.nodes)
        })
    })

    describe("ReferenceList constructor", () => {
        it("accepts a ReferenceList directly", () => {
            const list = new ReferenceList([
                new StandardReference({ tag: 'Room', key: 'cafe' }),
            ])
            const graph = new StandardLudicGraph(list)
            expect(graph.toJSON()?.nodes).toHaveLength(1)
        })
    })

    describe("alignment round-trip (LG-1/LG-8/LG-9/LG-10)", () => {
        it("round-trips every node union member and both absent-field cases without loss", () => {
            const data = {
                rootId: { tag: 'Room' as const, key: 'lab', universalKey: 'ROOM#lab' as const },
                nodes: [
                    { tag: 'Room' as const, key: 'lab', universalKey: 'ROOM#lab' as const },
                    { tag: 'Area' as const, key: 'downtown' },
                    { tag: 'Feature' as const, key: 'fountain' },
                    { tag: 'Character' as const, key: 'guard' },
                    { tag: 'Object' as const, key: 'box' },
                    {
                        tag: 'Presence' as const,
                        universalKey: 'PRESENCE#p1',
                        fromHostId: 'ROOM#lab' as const,
                        cover: { tag: 'Full' as const },
                    },
                ],
            }
            const graph = StandardLudicGraph.fromJSON(data)
            expect(graph.rootId?.universalKey).toBe('ROOM#lab')
            expect(graph.presenceNodes).toHaveLength(1)
            expect(graph.presenceNodes[0].universalKey).toBe('PRESENCE#p1')
            expect(graph.toJSON()).toEqual(data)
        })

        it("round-trips a presence node with an Enumerated cover", () => {
            const data = {
                nodes: [
                    {
                        tag: 'Presence' as const,
                        universalKey: 'PRESENCE#p2',
                        fromHostId: 'ROOM#hall' as const,
                        cover: {
                            tag: 'Enumerated' as const,
                            members: [{ host: 'OBJECT#rope' as const, presence: 'PRESENCE#p2' }],
                        },
                    },
                ],
            }
            const graph = StandardLudicGraph.fromJSON(data)
            expect(graph.toJSON()).toEqual(data)
        })

        it("round-trips one edge of every kind (Topology/Membership/Peer)", () => {
            const data = {
                edges: [
                    { kind: 'Navigation' as const, uuid: 'e1', payload: {} },
                    { kind: 'Bearing' as const, from: 'ROOM#a' as const, to: 'ROOM#b' as const },
                    { kind: 'In' as const, from: 'OBJECT#cup' as const, to: 'OBJECT#box' as const },
                    { kind: 'On' as const, from: 'OBJECT#cup' as const, to: 'OBJECT#tray' as const },
                    { kind: 'PartOf' as const, from: 'OBJECT#spring' as const, to: 'OBJECT#contraption' as const },
                    { kind: 'Under' as const, from: 'OBJECT#a' as const, to: 'OBJECT#b' as const },
                    { kind: 'Against' as const, from: 'OBJECT#a' as const, to: 'OBJECT#b' as const },
                    { kind: 'Custom' as const, from: 'OBJECT#a' as const, to: 'OBJECT#b' as const, relationLabel: 'spliced to' },
                ],
            }
            const graph = StandardLudicGraph.fromJSON(data)
            expect(graph.edges.length).toBe(8)
            expect(graph.toJSON()).toEqual(data)
        })

        it("round-trips ports (contract parity only -- no WML writer populates them)", () => {
            const data = {
                ports: [
                    { portId: '8f3a', fromHostId: 'ROOM#lab' as const, kind: 'Custom', exteriorRelationLabel: 'TiedTo' },
                ],
            }
            const graph = StandardLudicGraph.fromJSON(data)
            expect(graph.toJSON()).toEqual(data)
        })

        it("carries edgeId/chainId on a relational edge base field", () => {
            const data = {
                edges: [
                    { kind: 'PartOf' as const, from: 'OBJECT#ropeEndA' as const, to: 'OBJECT#rope' as const, edgeId: 'route1', chainId: 'chain1' },
                ],
            }
            const graph = StandardLudicGraph.fromJSON(data)
            expect(graph.toJSON()).toEqual(data)
        })

        it("round-trips a relational edge with a port-qualified terminal (LG-11)", () => {
            const data = {
                edges: [
                    {
                        kind: 'Custom' as const,
                        from: 'OBJECT#rope' as const,
                        to: { owner: { tag: 'Object' as const, key: 'box' }, port: '8f3a' },
                        relationLabel: 'TiedTo',
                    },
                ],
            }
            const graph = StandardLudicGraph.fromJSON(data)
            expect(graph.toJSON()).toEqual(data)
        })

        it("round-trips a relational edge landing directly on a bare presence-node terminal (LG-11, PR-15)", () => {
            const data = {
                edges: [
                    { kind: 'In' as const, from: 'OBJECT#ropeEndA' as const, to: { presence: 'PRESENCE#p1' } },
                ],
            }
            const graph = StandardLudicGraph.fromJSON(data)
            expect(graph.toJSON()).toEqual(data)
        })

        it("remaps the owner half of a port-qualified terminal on toFormat, leaving the port opaque", () => {
            const graph = StandardLudicGraph.fromJSON({
                edges: [
                    {
                        kind: 'Under' as const,
                        from: { owner: { tag: 'Room' as const, key: 'lab', universalKey: 'ROOM#lab' as const }, port: '8f3a' },
                        to: 'OBJECT#cup',
                    },
                ],
            })
            const formatted = graph.edges.toFormat('universal')
            const edge = formatted.payload[0].toJSON() as any
            expect(edge.from).toEqual({ owner: 'ROOM#lab', port: '8f3a' })
        })
    })
})
