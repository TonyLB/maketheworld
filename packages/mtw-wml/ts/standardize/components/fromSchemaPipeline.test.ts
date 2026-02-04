import { treeFromWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardComponent } from "./baseClasses"
import { StandardizeConsumerSimple, processWithConsumers } from "./fromSchemaPipeline"

describe("fromSchemaPipeline", () => {
    describe("StandardizeConsumerSimple", () => {
        it("with empty children: update is not called, remainder equals children", () => {
            const roomTree = treeFromWML(deIndentWML(`<Room key=(test) />`))
            const children: GenericTree<SchemaTag> = roomTree[0].children
            const mockContext = { value: undefined as GenericTree<SchemaTag> | undefined }
            const update = jest.fn<void, [GenericTree<SchemaTag>]>()
            const consumer = new StandardizeConsumerSimple(
                mockContext as unknown as StandardComponent,
                { tag: "ShortName", update }
            )
            const remainder = consumer.process(children)
            expect(update).not.toHaveBeenCalled()
            expect(remainder).toEqual(children)
            expect(remainder).toHaveLength(0)
        })

        it("with one matching tag: update is called with matched nodes, remainder is the rest", () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Main Room</ShortName>
                    <Feature key=(f1) />
                </Room>
            `))
            const children = roomTree[0].children
            const mockContext = { value: undefined as GenericTree<SchemaTag> | undefined }
            const update = jest.fn<void, [GenericTree<SchemaTag>]>()
            const consumer = new StandardizeConsumerSimple(
                mockContext as unknown as StandardComponent,
                { tag: "ShortName", update }
            )
            const remainder = consumer.process(children)
            expect(update).toHaveBeenCalledTimes(1)
            const [matched] = update.mock.calls[0]
            expect(matched).toHaveLength(1)
            expect(matched[0].data.tag).toBe("ShortName")
            expect(remainder).toHaveLength(1)
            expect(remainder[0].data.tag).toBe("Feature")
        })

        it("with no matching tag: update is not called, remainder equals children", () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(f1) />
                    <Example key=(e1) />
                </Room>
            `))
            const children = roomTree[0].children
            const mockContext = { value: undefined as GenericTree<SchemaTag> | undefined }
            const update = jest.fn<void, [GenericTree<SchemaTag>]>()
            const consumer = new StandardizeConsumerSimple(
                mockContext as unknown as StandardComponent,
                { tag: "ShortName", update }
            )
            const remainder = consumer.process(children)
            expect(update).not.toHaveBeenCalled()
            expect(remainder).toHaveLength(2)
            expect(remainder.map((n) => n.data.tag)).toEqual(["Feature", "Example"])
        })
    })

    describe("processWithConsumers", () => {
        it("one consumer consumes all: final remainder empty, no throw", () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Only</ShortName>
                </Room>
            `))
            const children = roomTree[0].children
            const mockContext = { value: undefined as GenericTree<SchemaTag> | undefined }
            const consumer = new StandardizeConsumerSimple(mockContext as unknown as StandardComponent, {
                tag: "ShortName",
                update(nodes) {
                    mockContext.value = nodes
                },
            })
            expect(() => processWithConsumers(mockContext, [consumer], children)).not.toThrow()
            expect(mockContext.value).toHaveLength(1)
        })

        it("two consumers in sequence: remainder from first is input to second", () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Name</ShortName>
                    <Feature key=(f1) />
                </Room>
            `))
            const children = roomTree[0].children
            const shortNameReceived: GenericTree<SchemaTag>[] = []
            const featureReceived: GenericTree<SchemaTag>[] = []
            const mockContext = {}
            const c1 = new StandardizeConsumerSimple(mockContext as unknown as StandardComponent, {
                tag: "ShortName",
                update(nodes) {
                    shortNameReceived.push(nodes)
                },
            })
            const c2 = new StandardizeConsumerSimple(mockContext as unknown as StandardComponent, {
                tag: "Feature",
                update(nodes) {
                    featureReceived.push(nodes)
                },
            })
            expect(() => processWithConsumers(mockContext, [c1, c2], children)).not.toThrow()
            expect(shortNameReceived).toHaveLength(1)
            expect(shortNameReceived[0][0].data.tag).toBe("ShortName")
            expect(featureReceived).toHaveLength(1)
            expect(featureReceived[0][0].data.tag).toBe("Feature")
        })

        it("final remainder non-empty: throws with unconsumed tag names in message", () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Name</ShortName>
                    <Map />
                </Room>
            `))
            const children = roomTree[0].children
            const mockContext = {}
            const consumer = new StandardizeConsumerSimple(mockContext as unknown as StandardComponent, {
                tag: "ShortName",
                update() {},
            })
            expect(() => processWithConsumers(mockContext, [consumer], children)).toThrow(
                /Unconsumed child tags:/
            )
            expect(() => processWithConsumers(mockContext, [consumer], children)).toThrow(/Map/)
        })
    })
})
