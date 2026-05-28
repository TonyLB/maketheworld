import { StandardPositionGraph } from "./positionGraph"
import StandardReference from "../keys/reference"
import { ReferenceList } from "./reference"

describe("StandardPositionGraph", () => {
    describe("empty omission", () => {
        it("omits nodes in toJSON for default graph", () => {
            const graph = new StandardPositionGraph()
            expect(graph.nodes.payload.length).toBe(0)
            expect(graph.toJSON()).toBeUndefined()
        })

        it("omits nodes in toJSON for fromJSON with empty object", () => {
            const graph = StandardPositionGraph.fromJSON({})
            expect(graph.nodes.payload.length).toBe(0)
            expect(graph.toJSON()).toBeUndefined()
        })
    })

    describe("round-trip", () => {
        it("serializes heterogeneous nodes", () => {
            const graph = StandardPositionGraph.fromJSON({
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
            const base = StandardPositionGraph.fromJSON({
                nodes: [
                    { tag: 'Area', key: 'downtown', ref: 1 },
                    { tag: 'Room', key: 'cafe', ref: 1 },
                ],
            })
            const incoming = StandardPositionGraph.fromJSON({
                nodes: [
                    { tag: 'Room', key: 'cafe', ref: 1 },
                    { tag: 'Feature', key: 'fountain', ref: 1 },
                ],
            })
            const merged = base.merge(incoming)
            expect(merged.nodes.payload).toHaveLength(3)
            expect(merged.nodes.payload.find((ref) => ref.tag === 'Area' && ref.key === 'downtown')?.ref).toBe(1)
            expect(merged.nodes.payload.find((ref) => ref.tag === 'Room' && ref.key === 'cafe')?.ref).toBe(2)
            expect(merged.nodes.payload.find((ref) => ref.tag === 'Feature' && ref.key === 'fountain')?.ref).toBe(1)
        })
    })

    describe("diff", () => {
        it("diffs heterogeneous nodes across tags", () => {
            const base = StandardPositionGraph.fromJSON({
                nodes: [
                    { tag: 'Area', key: 'downtown', ref: 1 },
                    { tag: 'Room', key: 'cafe', ref: 1 },
                ],
            })
            const incoming = StandardPositionGraph.fromJSON({
                nodes: [
                    { tag: 'Room', key: 'cafe', ref: 2 },
                    { tag: 'Feature', key: 'fountain', ref: 1 },
                ],
            })
            const diffed = base.diff(incoming)
            expect(diffed).toBeDefined()
            expect(diffed!.nodes.payload.find((ref) => ref.tag === 'Area' && ref.key === 'downtown')?.ref).toBe(-1)
            expect(diffed!.nodes.payload.find((ref) => ref.tag === 'Room' && ref.key === 'cafe')?.ref).toBe(1)
            expect(diffed!.nodes.payload.find((ref) => ref.tag === 'Feature' && ref.key === 'fountain')?.ref).toBe(1)
        })

        it("returns undefined when diff is empty", () => {
            const graph = StandardPositionGraph.fromJSON({
                nodes: [{ tag: 'Room', key: 'cafe', ref: 1 }],
            })
            const same = StandardPositionGraph.fromJSON({
                nodes: [{ tag: 'Room', key: 'cafe', ref: 1 }],
            })
            expect(graph.diff(same)).toBeUndefined()
        })
    })

    describe("equals", () => {
        it("is order-insensitive for equivalent heterogeneous lists", () => {
            const graphA = StandardPositionGraph.fromJSON({
                nodes: [
                    { tag: 'Area', key: 'downtown' },
                    { tag: 'Room', key: 'cafe', ref: 2 },
                ],
            })
            const graphB = StandardPositionGraph.fromJSON({
                nodes: [
                    { tag: 'Room', key: 'cafe', ref: 2 },
                    { tag: 'Area', key: 'downtown' },
                ],
            })
            expect(graphA.equals(graphB)).toBe(true)
        })

        it("returns false for non-StandardPositionGraph", () => {
            const graph = new StandardPositionGraph()
            expect(graph.equals({} as StandardPositionGraph)).toBe(false)
        })
    })

    describe("nodesByTag", () => {
        it("filters by tag without mutating source graph", () => {
            const graph = StandardPositionGraph.fromJSON({
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
            const graph = StandardPositionGraph.fromJSON({
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
            const graph = new StandardPositionGraph(list)
            expect(graph.toJSON()?.nodes).toHaveLength(1)
        })
    })
})
