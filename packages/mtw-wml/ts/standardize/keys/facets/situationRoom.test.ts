import {
    SituationRoomFacetList,
    StandardSituationRoomFacet,
    SituationRoomFacetPayload,
    isSituationRoomFacetPayload,
    SituationRoomFacetPayloadType,
} from "./situationRoom"
import { StandardFacetData } from "./dataTypes/facet"
import StandardReference from "../reference"
import { StandardReferenceData } from "../dataTypes/reference"
import { treeFromWML } from "../../../schema"
import { StandardRender } from "../../render"

describe("SituationRoomFacet and SituationRoomFacetList", () => {
    const createSituationRef = (key: string, ref: number = 1): StandardReferenceData => ({
        key,
        tag: "Situation",
        universalKey: `SITUATION#${key}` as any,
        ref: ref === 1 ? undefined : ref,
    })

    const createFacetData = (
        key: string,
        payload: SituationRoomFacetPayloadType
    ): StandardFacetData<SituationRoomFacetPayloadType> => ({
        reference: createSituationRef(key),
        payload,
    })

    describe("SituationRoomFacetPayload", () => {
        it("should construct from plain object with displayName", () => {
            const payload = new SituationRoomFacetPayload({ displayName: ["Lobby"] })
            expect(payload.toJSON()).toMatchObject({ displayName: "Lobby" })
        })

        it("should construct from plain object with summary and description", () => {
            const payload = new SituationRoomFacetPayload({
                summary: ["A bright room"],
                description: ["The lobby is well lit."],
            })
            expect(payload.toJSON()).toMatchObject({
                summary: ["A bright room"],
                description: ["The lobby is well lit."],
            })
        })

        it("should clone", () => {
            const a = new SituationRoomFacetPayload({ displayName: ["Name"] })
            const b = a.clone()
            expect(b.toJSON()).toEqual(a.toJSON())
            expect(b).not.toBe(a)
        })

        it("should merge when both have content", () => {
            const a = new SituationRoomFacetPayload({ displayName: ["A"] })
            const b = new SituationRoomFacetPayload({ displayName: ["B"] })
            const merged = a.merge(b)
            expect(merged).toBeDefined()
            expect(merged!.toJSON().displayName).toBeDefined()
        })

        it("should invert", () => {
            const a = new SituationRoomFacetPayload({ displayName: ["A"] })
            const inv = a.invert()
            expect(inv.toJSON()).toBeDefined()
        })

        it("referencedLinkKeys should emit Link refs from summary and description render trees", () => {
            const mapping = [
                new StandardReference({ key: "featOne", tag: "Feature", universalKey: "FEATURE#featOne" }),
                new StandardReference({ key: "markTwo", tag: "Mark", universalKey: "MARK#markTwo" }),
            ]
            const summary = new StandardRender([
                "See ",
                { data: { tag: "Link", to: "featOne", text: "Feature" }, children: [] },
                ".",
            ])
            const description = new StandardRender([
                "Also ",
                { data: { tag: "Link", to: "markTwo", text: "Mark" }, children: [] },
                ".",
            ])
            const payload = new SituationRoomFacetPayload({ summary, description })
            const keys = payload.referencedLinkKeys(mapping)
            expect(keys.every((k) => k.referenceType === "Link")).toBe(true)
            expect(keys.map((k) => k.reference.standardKey.toJSON())).toEqual([
                { key: "featOne", universalKey: "FEATURE#featOne" },
                { key: "markTwo", universalKey: "MARK#markTwo" },
            ])
        })

        it("referencedLinkKeys should return empty when no summary or description", () => {
            const payload = new SituationRoomFacetPayload({ displayName: "Title only" })
            expect(payload.referencedLinkKeys([])).toEqual([])
        })

        it("linkReferenceKeysFromSummaryDescription static helper matches instance method", () => {
            const summary = new StandardRender([
                { data: { tag: "Link", to: "x", text: "room" }, children: [] },
            ])
            const mapping = [new StandardReference({ key: "x", tag: "Room", universalKey: "ROOM#x" })]
            const fromStatic = SituationRoomFacetPayload.linkReferenceKeysFromSummaryDescription(mapping, summary, undefined)
            const fromInstance = new SituationRoomFacetPayload({ summary }).referencedLinkKeys(mapping)
            expect(fromStatic).toEqual(fromInstance)
        })
    })

    describe("StandardSituationRoomFacet", () => {
        it("should construct from StandardFacetData (JSON)", () => {
            const data = createFacetData("bright", { displayName: "Bright Lobby" })
            const facet = new StandardSituationRoomFacet(data)
            expect(facet.reference.key).toBe("bright")
            expect(facet.payload.toJSON()).toMatchObject({ displayName: "Bright Lobby" })
        })

        it("should construct from schema node (Situation under Room)", () => {
            const wml = `<Room key=(r)><Situation key=(bright) ref={0}><DisplayName>Bright Lobby</DisplayName></Situation></Room>`
            const schema = treeFromWML(wml)
            const roomNode = schema.find((n) => n.data.tag === "Room")
            expect(roomNode).toBeDefined()
            const situationNode = roomNode!.children.find((c) => c.data.tag === "Situation")
            expect(situationNode).toBeDefined()
            const facet = new StandardSituationRoomFacet([situationNode!])
            expect(facet.reference.key).toBe("bright")
            expect(facet.reference.tag).toBe("Situation")
            expect(facet.payload).toBeDefined()
            const payloadJson = facet.payload.toJSON()
            if (payloadJson.displayName) {
                expect(payloadJson.displayName).toBeDefined()
            }
        })

        it("should round-trip toJSON", () => {
            const data = createFacetData("sit1", {
                displayName: "Name",
                summary: ["Sum"],
                description: ["Desc"],
            })
            const facet = new StandardSituationRoomFacet(data)
            const json = facet.toJSON() as StandardFacetData<SituationRoomFacetPayloadType>
            const facet2 = new StandardSituationRoomFacet(json)
            expect(facet2.reference.sameKey(facet.reference)).toBe(true)
            expect(facet2.payload.toJSON()).toEqual(facet.payload.toJSON())
        })

        it("should render facet with aggregatedNode (Situation tag and children)", () => {
            const data = createFacetData("bright", { displayName: "Lobby" })
            const facet = new StandardSituationRoomFacet(data)
            const result = facet.renderFacet()
            expect(result.aggregatedNode).toBeDefined()
            const node = result.aggregatedNode!
            expect(node.data).toMatchObject({ tag: "Situation" })
            expect(node.children.length).toBeGreaterThan(0)
            const displayNameChild = node.children.find((c) => c.data.tag === "DisplayName")
            expect(displayNameChild).toBeDefined()
        })

        it("should clone", () => {
            const facet = new StandardSituationRoomFacet(createFacetData("x", { displayName: "Y" }))
            const cloned = facet.clone()
            expect(cloned.sameKey(facet)).toBe(true)
            expect(cloned.payload.toJSON()).toEqual(facet.payload.toJSON())
        })
    })

    describe("SituationRoomFacetList", () => {
        it("should construct from empty array", () => {
            const list = new SituationRoomFacetList([])
            expect(list.length).toBe(0)
            expect(list.items).toEqual([])
        })

        it("should construct from array of facet data", () => {
            const list = new SituationRoomFacetList([
                createFacetData("bright", { displayName: "Bright" }),
                createFacetData("dark", { description: ["Dark room"] }),
            ])
            expect(list.length).toBe(2)
            expect((list.items[0] as StandardSituationRoomFacet).reference.key).toBe("bright")
            expect((list.items[1] as StandardSituationRoomFacet).reference.key).toBe("dark")
        })

        it("should merge two lists", () => {
            const list1 = new SituationRoomFacetList([createFacetData("a", { displayName: "A" })])
            const list2 = new SituationRoomFacetList([createFacetData("b", { displayName: "B" })])
            const merged = list1.merge(list2)
            expect(merged).toBeDefined()
            expect(merged!.length).toBe(2)
        })

        it("should invert", () => {
            const list = new SituationRoomFacetList([createFacetData("x", { displayName: "X" })])
            const inv = list.invert()
            expect(inv.length).toBe(1)
        })

        it("should clone", () => {
            const list = new SituationRoomFacetList([createFacetData("x", { displayName: "X" })])
            const cloned = list.clone()
            expect(cloned.length).toBe(list.length)
            expect(cloned).not.toBe(list)
        })
    })

    describe("isSituationRoomFacetPayload", () => {
        it("should accept valid payload shape", () => {
            expect(isSituationRoomFacetPayload({})).toBe(true)
            expect(isSituationRoomFacetPayload({ displayName: ["x"] })).toBe(true)
            expect(isSituationRoomFacetPayload({ summary: ["x"], description: ["y"] })).toBe(true)
        })
        it("should reject invalid shape", () => {
            expect(isSituationRoomFacetPayload(null)).toBe(false)
            expect(isSituationRoomFacetPayload({ other: 1 })).toBe(false)
        })
    })
})
