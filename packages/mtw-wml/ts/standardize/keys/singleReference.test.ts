import { SingleReference } from "./singleReference"
import { ReferenceList } from "./referenceList"
import StandardReference from "./reference"

describe("SingleReference construction and invariants", () => {
    it("constructs empty state from empty array", () => {
        const single = new SingleReference([])
        expect(single.value).toBeUndefined()
        expect(single.payload.length).toBe(0)
    })

    it("constructs state from single positive reference", () => {
        const ref = new StandardReference({ tag: "Room", key: "room1" })
        const single = new SingleReference([ref])
        expect(single.value?.sameKey(ref)).toBe(true)
        expect(single.toJSON()).toEqual([{ tag: "Room", key: "room1" }])
    })

    it("throws when constructed list has more than one positive ref", () => {
        const refA = new StandardReference({ tag: "Room", key: "roomA" })
        const refB = new StandardReference({ tag: "Room", key: "roomB" })
        expect(() => new SingleReference([refA, refB])).toThrow("SingleReference must not contain more than one positive ref")
    })

    it("value setter sets and clears correctly", () => {
        const single = new SingleReference([])
        const ref = new StandardReference({ tag: "Room", key: "room1" })
        single.value = ref
        expect(single.value?.sameKey(ref)).toBe(true)
        single.value = undefined
        expect(single.value).toBeUndefined()
        expect(single.payload.length).toBe(0)
    })
})

describe("SingleReference helpers", () => {
    it("fromReferenceList constructs state when list has zero items", () => {
        const list = new ReferenceList([])
        const single = SingleReference.fromReferenceList(list)
        expect(single.value).toBeUndefined()
        expect(single.payload.length).toBe(0)
    })

    it("fromReferenceList constructs state when list has one positive item", () => {
        const ref = new StandardReference({ tag: "Room", key: "room1" })
        const list = new ReferenceList([ref])
        const single = SingleReference.fromReferenceList(list)
        expect(single.value?.sameKey(ref)).toBe(true)
    })

    it("fromData constructs state from ReferenceListData", () => {
        const data = [{ tag: "Room" as const, key: "room1" as const }]
        const single = SingleReference.fromData(data)
        expect(single.value?.tag).toBe("Room")
        expect(single.value?.key).toBe("room1")
    })
})

describe("SingleReference diff behavior", () => {
    const roomA = new StandardReference({ tag: "Room", key: "roomA" })
    const roomB = new StandardReference({ tag: "Room", key: "roomB" })

    it("produces empty diff when both undefined", () => {
        const base = SingleReference.fromValue(undefined)
        const incoming = SingleReference.fromValue(undefined)
        const diff = base.diff(incoming)
        expect(diff.payload.length).toBe(0)
    })

    it("produces positive diff when base undefined and incoming set", () => {
        const base = SingleReference.fromValue(undefined)
        const incoming = SingleReference.fromValue(roomB)
        const diff = base.diff(incoming)
        expect(diff.payload.length).toBe(1)
        const item = diff.payload[0]
        expect(item.sameKey(roomB)).toBe(true)
        expect(item.ref).toBeGreaterThan(0)
    })

    it("produces negative diff when base set and incoming undefined", () => {
        const base = SingleReference.fromValue(roomA)
        const incoming = SingleReference.fromValue(undefined)
        const diff = base.diff(incoming)
        expect(diff.payload.length).toBe(1)
        const item = diff.payload[0]
        expect(item.sameKey(roomA)).toBe(true)
        expect(item.ref).toBeLessThan(0)
    })

    it("produces swap diff when base and incoming differ", () => {
        const base = SingleReference.fromValue(roomA)
        const incoming = SingleReference.fromValue(roomB)
        const diff = base.diff(incoming)
        expect(diff.payload.length).toBe(2)
        const negatives = diff.payload.filter((item) => item.ref < 0)
        const positives = diff.payload.filter((item) => item.ref > 0)
        expect(negatives.length).toBe(1)
        expect(positives.length).toBe(1)
        expect(negatives[0].sameKey(roomA)).toBe(true)
        expect(positives[0].sameKey(roomB)).toBe(true)
    })
})

describe("SingleReference merge behavior", () => {
    const roomA = new StandardReference({ tag: "Room", key: "roomA" })
    const roomB = new StandardReference({ tag: "Room", key: "roomB" })

    it("merge no-op (empty) diff leaves value unchanged", () => {
        const base = SingleReference.fromValue(roomA)
        const diff = new SingleReference([])
        const merged = base.merge(diff)
        expect(merged.value?.sameKey(roomA)).toBe(true)
    })

    it("merge positive-only diff sets value", () => {
        const base = SingleReference.fromValue(undefined)
        const diff = new SingleReference([roomB.withRef(1)])
        const merged = base.merge(diff)
        expect(merged.value?.sameKey(roomB)).toBe(true)
    })

    it("merge negative-only diff clears matching base value", () => {
        const base = SingleReference.fromValue(roomA)
        const diff = new SingleReference([roomA.withRef(-1)])
        const merged = base.merge(diff)
        expect(merged.value).toBeUndefined()
    })

    it("merge negative-only diff that does not match base is a no-op", () => {
        const base = SingleReference.fromValue(roomA)
        const diff = new SingleReference([roomB.withRef(-1)])
        const merged = base.merge(diff)
        expect(merged.value?.sameKey(roomA)).toBe(true)
    })

    it("merge swap diff replaces base with incoming", () => {
        const base = SingleReference.fromValue(roomA)
        const diffItems = [roomA.withRef(-1), roomB.withRef(1)]
        const diff = new SingleReference(diffItems)
        const merged = base.merge(diff)
        expect(merged.value?.sameKey(roomB)).toBe(true)
    })
})

