import { ReferenceList } from "./referenceList"
import StandardReference from "./reference"

describe("ReferenceList isEmpty", () => {
    it("returns true for an empty list", () => {
        const list = new ReferenceList([])
        expect(list.isEmpty()).toBe(true)
    })

    it("returns true for a list containing only ref=0 entries", () => {
        const list = new ReferenceList([
            new StandardReference({ tag: "Room", key: "room1", ref: 0 }),
            new StandardReference({ tag: "Feature", key: "feature1", ref: 0 })
        ])
        expect(list.isEmpty()).toBe(true)
    })

    it("returns false when any entry has non-zero ref", () => {
        const list = new ReferenceList([
            new StandardReference({ tag: "Room", key: "room1", ref: 0 }),
            new StandardReference({ tag: "Feature", key: "feature1", ref: 1 })
        ])
        expect(list.isEmpty()).toBe(false)
    })
})

describe("ReferenceList equals", () => {
    it("is reflexive", () => {
        const list = new ReferenceList([
            new StandardReference({ tag: "Room", key: "room1" }),
            new StandardReference({ tag: "Feature", key: "feature1", ref: 2 })
        ])
        expect(list.equals(list)).toBe(true)
    })

    it("is symmetric for equivalent lists", () => {
        const listA = new ReferenceList([
            new StandardReference({ tag: "Room", key: "room1" }),
            new StandardReference({ tag: "Feature", key: "feature1", ref: 2 })
        ])
        const listB = new ReferenceList([
            new StandardReference({ tag: "Room", key: "room1" }),
            new StandardReference({ tag: "Feature", key: "feature1", ref: 2 })
        ])
        expect(listA.equals(listB)).toBe(true)
        expect(listB.equals(listA)).toBe(true)
    })

    it("treats order permutations as equal", () => {
        const listA = new ReferenceList([
            new StandardReference({ tag: "Room", key: "room1" }),
            new StandardReference({ tag: "Feature", key: "feature1", ref: 2 })
        ])
        const listB = new ReferenceList([
            new StandardReference({ tag: "Feature", key: "feature1", ref: 2 }),
            new StandardReference({ tag: "Room", key: "room1" })
        ])
        expect(listA.equals(listB)).toBe(true)
    })

    it("matches universal-only and universal+local references via sameKey", () => {
        const listA = new ReferenceList([
            new StandardReference("ROOM#room-123")
        ])
        const listB = new ReferenceList([
            new StandardReference({ tag: "Room", key: "room1", universalKey: "ROOM#room-123" })
        ])
        expect(listA.equals(listB)).toBe(true)
    })

    it("returns false when ref counts differ for same reference identity", () => {
        const listA = new ReferenceList([
            new StandardReference({ tag: "Room", key: "room1", universalKey: "ROOM#room-123", ref: 1 })
        ])
        const listB = new ReferenceList([
            new StandardReference({ tag: "Room", key: "room1", universalKey: "ROOM#room-123", ref: 2 })
        ])
        expect(listA.equals(listB)).toBe(false)
    })

    it("returns false when references point to different components", () => {
        const listA = new ReferenceList([
            new StandardReference({ tag: "Room", key: "room1" })
        ])
        const listB = new ReferenceList([
            new StandardReference({ tag: "Room", key: "room2" })
        ])
        expect(listA.equals(listB)).toBe(false)
    })
})
