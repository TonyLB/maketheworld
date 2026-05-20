import {
    SituationProseFacetList,
    StandardSituationProseFacet,
    SituationProseFacetPayload,
    isSituationProseFacetPayload,
    SituationProseFacetPayloadType,
    renderPayloadToSchemaNode,
} from "./situationRoom"
import { StandardFacetData } from "./dataTypes/facet"
import StandardReference from "../reference"
import { StandardReferenceData } from "../dataTypes/reference"
import { treeFromWML } from "../../../schema"
import { schemaToWML } from "../../../schema"
import { StandardRender } from "../../render"

describe("SituationProseFacet and SituationProseFacetList", () => {
    const createSituationRef = (key: string, ref: number = 1): StandardReferenceData => ({
        key,
        tag: "Situation",
        universalKey: `SITUATION#${key}` as any,
        ref: ref === 1 ? undefined : ref,
    })

    const createFacetData = (
        key: string,
        payload: SituationProseFacetPayloadType
    ): StandardFacetData<SituationProseFacetPayloadType> => ({
        reference: createSituationRef(key),
        payload,
    })

    describe("SituationProseFacetPayload", () => {
        it("should construct from plain object with displayName", () => {
            const payload = new SituationProseFacetPayload({ displayName: ["Lobby"] })
            expect(payload.toJSON()).toMatchObject({ displayName: "Lobby" })
        })

        it("should construct from plain object with summary and description", () => {
            const payload = new SituationProseFacetPayload({
                summary: ["A bright room"],
                description: ["The lobby is well lit."],
            })
            expect(payload.toJSON()).toMatchObject({
                summary: ["A bright room"],
                description: ["The lobby is well lit."],
            })
        })

        it("should clone", () => {
            const a = new SituationProseFacetPayload({ displayName: ["Name"] })
            const b = a.clone()
            expect(b.toJSON()).toEqual(a.toJSON())
            expect(b).not.toBe(a)
        })

        it("should merge when both have content", () => {
            const a = new SituationProseFacetPayload({ displayName: ["A"] })
            const b = new SituationProseFacetPayload({ displayName: ["B"] })
            const merged = a.merge(b)
            expect(merged).toBeDefined()
            expect(merged!.toJSON().displayName).toBeDefined()
        })

        it("should invert", () => {
            const a = new SituationProseFacetPayload({ displayName: ["A"] })
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
            const payload = new SituationProseFacetPayload({ summary, description })
            const keys = payload.referencedLinkKeys(mapping)
            expect(keys.every((k) => k.referenceType === "Link")).toBe(true)
            expect(keys.map((k) => k.reference.standardKey.toJSON())).toEqual([
                { key: "featOne", universalKey: "FEATURE#featOne" },
                { key: "markTwo", universalKey: "MARK#markTwo" },
            ])
        })

        it("referencedLinkKeys should return empty when no summary or description", () => {
            const payload = new SituationProseFacetPayload({ displayName: "Title only" })
            expect(payload.referencedLinkKeys([])).toEqual([])
        })

        it("linkReferenceKeysFromSummaryDescription static helper matches instance method", () => {
            const summary = new StandardRender([
                { data: { tag: "Link", to: "x", text: "room" }, children: [] },
            ])
            const mapping = [new StandardReference({ key: "x", tag: "Room", universalKey: "ROOM#x" })]
            const fromStatic = SituationProseFacetPayload.linkReferenceKeysFromSummaryDescription(mapping, summary, undefined)
            const fromInstance = new SituationProseFacetPayload({ summary }).referencedLinkKeys(mapping)
            expect(fromStatic).toEqual(fromInstance)
        })

        describe("remapReferences", () => {
            const featureMapping = [
                new StandardReference({ key: "featOne", tag: "Feature", universalKey: "FEATURE#featOne" }),
            ]

            it("should remap description link to universal format", () => {
                const payload = new SituationProseFacetPayload({
                    description: [
                        { data: { tag: "Link", to: "featOne", text: "Feature" }, children: [] },
                    ],
                })
                const remapped = payload.remapReferences({ mappings: featureMapping, mapTo: "universal" })
                expect(schemaToWML(remapped._description!.schema)).toEqual(
                    '<Link to=(FEATURE#featOne)>Feature</Link>'
                )
            })

            it("should remap summary link to key format from universal", () => {
                const payload = new SituationProseFacetPayload({
                    summary: [
                        { data: { tag: "Link", to: "FEATURE#featOne", text: "Feature" }, children: [] },
                    ],
                })
                const remapped = payload.remapReferences({ mappings: featureMapping, mapTo: "key" })
                expect(schemaToWML(remapped._summary!.schema)).toEqual(
                    '<Link to=(featOne)>Feature</Link>'
                )
            })

            it("should remap both summary and description links to both format", () => {
                const payload = new SituationProseFacetPayload({
                    summary: [
                        { data: { tag: "Link", to: "featOne", text: "A" }, children: [] },
                    ],
                    description: [
                        { data: { tag: "Link", to: "featOne", text: "B" }, children: [] },
                    ],
                })
                const remapped = payload.remapReferences({ mappings: featureMapping, mapTo: "both" })
                expect(schemaToWML(remapped._summary!.schema)).toContain("featOne")
                expect(schemaToWML(remapped._description!.schema)).toContain("featOne")
            })

            it("should leave displayName unchanged", () => {
                const payload = new SituationProseFacetPayload({ displayName: ["Title"] })
                const remapped = payload.remapReferences({ mappings: featureMapping, mapTo: "universal" })
                expect(remapped.toJSON()).toMatchObject({ displayName: "Title" })
            })
        })

        describe("toProseTripletChildren with mappings (display-time)", () => {
            const featureMapping = [
                new StandardReference({ key: "featOne", tag: "Feature", universalKey: "FEATURE#featOne" }),
                new StandardReference({ key: "featTwo", tag: "Feature", universalKey: "FEATURE#featTwo" }),
            ]

            it("should emit local link keys when stored targets are universal", () => {
                const payload = new SituationProseFacetPayload({
                    description: [
                        { data: { tag: "Link", to: "featOne", text: "One" }, children: [] },
                    ],
                })
                const stored = payload.remapReferences({ mappings: featureMapping, mapTo: "universal" })
                const children = stored.toProseTripletChildren({ mappings: featureMapping })
                const descriptionNode = children.find((c) => c.data.tag === "Description")
                expect(descriptionNode).toBeDefined()
                expect(schemaToWML(descriptionNode!.children)).toEqual(
                    '<Link to=(featOne)>One</Link>'
                )
            })

            it("renderPayloadToSchemaNode should pass mappings to prose triplet", () => {
                const payload = new SituationProseFacetPayload({
                    summary: [
                        { data: { tag: "Link", to: "FEATURE#featTwo", text: "Two" }, children: [] },
                    ],
                })
                const renderNode = renderPayloadToSchemaNode(payload, featureMapping)
                expect(renderNode.data.tag).toBe("Render")
                const summaryChild = renderNode.children.find((c) => c.data.tag === "Summary")
                expect(schemaToWML(summaryChild!.children)).toEqual(
                    '<Link to=(featTwo)>Two</Link>'
                )
            })
        })
    })

    describe("StandardSituationProseFacet", () => {
        it("should construct from StandardFacetData (JSON)", () => {
            const data = createFacetData("bright", { displayName: "Bright Lobby" })
            const facet = new StandardSituationProseFacet(data)
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
            const facet = new StandardSituationProseFacet([situationNode!])
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
            const facet = new StandardSituationProseFacet(data)
            const json = facet.toJSON() as StandardFacetData<SituationProseFacetPayloadType>
            const facet2 = new StandardSituationProseFacet(json)
            expect(facet2.reference.sameKey(facet.reference)).toBe(true)
            expect(facet2.payload.toJSON()).toEqual(facet.payload.toJSON())
        })

        it("should render facet with aggregatedNode (Situation tag and children)", () => {
            const data = createFacetData("bright", { displayName: "Lobby" })
            const facet = new StandardSituationProseFacet(data)
            const result = facet.renderFacet()
            expect(result.aggregatedNode).toBeDefined()
            const node = result.aggregatedNode!
            expect(node.data).toMatchObject({ tag: "Situation" })
            expect(node.children.length).toBeGreaterThan(0)
            const displayNameChild = node.children.find((c) => c.data.tag === "DisplayName")
            expect(displayNameChild).toBeDefined()
        })

        it("should clone", () => {
            const facet = new StandardSituationProseFacet(createFacetData("x", { displayName: "Y" }))
            const cloned = facet.clone()
            expect(cloned.sameKey(facet)).toBe(true)
            expect(cloned.payload.toJSON()).toEqual(facet.payload.toJSON())
        })

        it("should remapReferences on reference and payload prose", () => {
            const mapping = [
                new StandardReference({ key: "bright", tag: "Situation", universalKey: "SITUATION#bright" as any }),
                new StandardReference({ key: "featOne", tag: "Feature", universalKey: "FEATURE#featOne" }),
            ]
            const facet = new StandardSituationProseFacet(
                createFacetData("bright", {
                    description: [
                        { data: { tag: "Link", to: "featOne", text: "F" }, children: [] },
                    ],
                })
            )
            const remapped = facet.remapReferences({ mappings: mapping, mapTo: "universal" })
            expect(remapped.reference.universalKey).toBe("SITUATION#bright")
            expect(schemaToWML(remapped.payload._description!.schema)).toEqual(
                '<Link to=(FEATURE#featOne)>F</Link>'
            )
        })

        it("renderFacet with mappings should emit local link keys from universal storage", () => {
            const mapping = [
                new StandardReference({ key: "bright", tag: "Situation", universalKey: "SITUATION#bright" as any }),
                new StandardReference({ key: "featOne", tag: "Feature", universalKey: "FEATURE#featOne" }),
            ]
            const facet = new StandardSituationProseFacet(
                createFacetData("bright", {
                    description: [
                        { data: { tag: "Link", to: "featOne", text: "F" }, children: [] },
                    ],
                })
            )
            const stored = facet.remapReferences({ mappings: mapping, mapTo: "universal" })
            const result = stored.renderFacet(undefined, undefined, mapping)
            const descriptionChild = result.aggregatedNode!.children.find((c) => c.data.tag === "Description")
            expect(schemaToWML(descriptionChild!.children)).toEqual(
                '<Link to=(featOne)>F</Link>'
            )
        })
    })

    describe("SituationProseFacetList", () => {
        it("should construct from empty array", () => {
            const list = new SituationProseFacetList([])
            expect(list.length).toBe(0)
            expect(list.items).toEqual([])
        })

        it("should construct from array of facet data", () => {
            const list = new SituationProseFacetList([
                createFacetData("bright", { displayName: "Bright" }),
                createFacetData("dark", { description: ["Dark room"] }),
            ])
            expect(list.length).toBe(2)
            expect((list.items[0] as StandardSituationProseFacet).reference.key).toBe("bright")
            expect((list.items[1] as StandardSituationProseFacet).reference.key).toBe("dark")
        })

        it("should merge two lists", () => {
            const list1 = new SituationProseFacetList([createFacetData("a", { displayName: "A" })])
            const list2 = new SituationProseFacetList([createFacetData("b", { displayName: "B" })])
            const merged = list1.merge(list2)
            expect(merged).toBeDefined()
            expect(merged!.length).toBe(2)
        })

        it("should invert", () => {
            const list = new SituationProseFacetList([createFacetData("x", { displayName: "X" })])
            const inv = list.invert()
            expect(inv.length).toBe(1)
        })

        it("should clone", () => {
            const list = new SituationProseFacetList([createFacetData("x", { displayName: "X" })])
            const cloned = list.clone()
            expect(cloned.length).toBe(list.length)
            expect(cloned).not.toBe(list)
        })

        it("should remapReferences on each facet", () => {
            const mapping = [
                new StandardReference({ key: "a", tag: "Feature", universalKey: "FEATURE#a" }),
            ]
            const list = new SituationProseFacetList([
                createFacetData("sit1", {
                    description: [{ data: { tag: "Link", to: "a", text: "A" }, children: [] }],
                }),
            ])
            const remapped = list.remapReferences({ mappings: mapping, mapTo: "universal" })
            const facet = remapped.items[0] as StandardSituationProseFacet
            expect(schemaToWML(facet.payload._description!.schema)).toEqual(
                '<Link to=(FEATURE#a)>A</Link>'
            )
        })
    })

    describe("isSituationProseFacetPayload", () => {
        it("should accept valid payload shape", () => {
            expect(isSituationProseFacetPayload({})).toBe(true)
            expect(isSituationProseFacetPayload({ displayName: ["x"] })).toBe(true)
            expect(isSituationProseFacetPayload({ summary: ["x"], description: ["y"] })).toBe(true)
        })
        it("should reject invalid shape", () => {
            expect(isSituationProseFacetPayload(null)).toBe(false)
            expect(isSituationProseFacetPayload({ other: 1 })).toBe(false)
        })
    })
})
