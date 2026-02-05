import { treeFromWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardLiteral } from "../literal"
import { ReferenceList } from "./reference"
import { StandardRender } from "../render"
import { isSchemaDescription, SchemaDescriptionTag } from "@tonylb/mtw-base/ts/schema/example"
import { StandardizeConsumerReferenceList, StandardizeConsumerRender, StandardizeConsumerSimple, StandardizeConsumerStandardLiteral, processWithConsumers } from "./fromSchemaPipeline"

describe("fromSchemaPipeline", () => {
    describe("StandardizeConsumerSimple", () => {
        it("with empty children: update is not called, remainder equals children", () => {
            const roomTree = treeFromWML(deIndentWML(`<Room key=(test) />`))
            const children: GenericTree<SchemaTag> = roomTree[0].children
            const mockContext = { value: undefined as GenericTree<SchemaTag> | undefined }
            const update = jest.fn<void, [GenericTree<SchemaTag>]>()
            const consumer = new StandardizeConsumerSimple(
                mockContext,
                { tag: "ShortName", update }
            )
            const { parsingRemainder: remainder, returnRemainderAddition } = consumer.process(children)
            expect(update).not.toHaveBeenCalled()
            expect(remainder).toEqual(children)
            expect(remainder).toHaveLength(0)
            expect(returnRemainderAddition).toEqual([])
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
                mockContext,
                { tag: "ShortName", update }
            )
            const { parsingRemainder: remainder, returnRemainderAddition } = consumer.process(children)
            expect(update).toHaveBeenCalledTimes(1)
            const [matched] = update.mock.calls[0]
            expect(matched).toHaveLength(1)
            expect(matched[0].data.tag).toBe("ShortName")
            expect(remainder).toHaveLength(1)
            expect(remainder[0].data.tag).toBe("Feature")
            expect(returnRemainderAddition).toEqual([])
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
                mockContext,
                { tag: "ShortName", update }
            )
            const { parsingRemainder: remainder, returnRemainderAddition } = consumer.process(children)
            expect(update).not.toHaveBeenCalled()
            expect(remainder).toHaveLength(2)
            expect(remainder.map((n) => n.data.tag)).toEqual(["Feature", "Example"])
            expect(returnRemainderAddition).toEqual([])
        })
    })

    describe("StandardizeConsumerReferenceList", () => {
        it("with matching tag: update is called with ReferenceList, remainder is the rest", () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(f1) />
                    <ShortName>Name</ShortName>
                </Room>
            `))
            const children = roomTree[0].children
            const mockContext = { list: undefined as ReferenceList | undefined }
            const consumer = new StandardizeConsumerReferenceList(mockContext, {
                tag: "Feature",
                update(list) {
                    mockContext.list = list
                },
            })
            const { parsingRemainder: remainder, returnRemainderAddition } = consumer.process(children)
            expect(mockContext.list).toBeInstanceOf(ReferenceList)
            expect(mockContext.list!.payload).toHaveLength(1)
            expect(mockContext.list!.payload[0].key).toBe("f1")
            expect(remainder).toHaveLength(1)
            expect(remainder[0].data.tag).toBe("ShortName")
            expect(returnRemainderAddition).toEqual([])
        })
    })

    describe("StandardizeConsumerStandardLiteral", () => {
        it("with matching tag: update is called with StandardLiteral, remainder is the rest", () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Main Room</ShortName>
                    <Feature key=(f1) />
                </Room>
            `))
            const children = roomTree[0].children
            const mockContext = { literal: undefined as StandardLiteral | undefined }
            const consumer = new StandardizeConsumerStandardLiteral(mockContext, {
                tag: "ShortName",
                update(literal) {
                    mockContext.literal = literal
                },
            })
            const { parsingRemainder: remainder, returnRemainderAddition } = consumer.process(children)
            expect(mockContext.literal).toBeInstanceOf(StandardLiteral)
            expect(mockContext.literal!.toJSON()).toBe("Main Room")
            expect(remainder).toHaveLength(1)
            expect(remainder[0].data.tag).toBe("Feature")
            expect(returnRemainderAddition).toEqual([])
        })

        it("with no matching tag: update is called with undefined", () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(f1) />
                </Room>
            `))
            const children = roomTree[0].children
            const mockContext = { literal: undefined as StandardLiteral | undefined }
            const consumer = new StandardizeConsumerStandardLiteral(mockContext, {
                tag: "ShortName",
                update(literal) {
                    mockContext.literal = literal
                },
            })
            const { returnRemainderAddition } = consumer.process(children)
            expect(mockContext.literal).toBeUndefined()
            expect(returnRemainderAddition).toEqual([])
        })
    })

    describe("StandardizeConsumerRender", () => {
        it("with matching render tag: update is called with StandardRender, remainder is the rest", () => {
            const tree = treeFromWML(deIndentWML(`
                <Message key=(test)>
                    <Description>Message Test</Description>
                    <Room key=(testRoom) />
                </Message>
            `))
            const children = tree[0].children
            const mockContext = { render: undefined as StandardRender | undefined }
            const consumer = new StandardizeConsumerRender<typeof mockContext, SchemaDescriptionTag>(mockContext, {
                tag: "Description",
                nodeTypeGuard: isSchemaDescription,
                errorMessage: "Schema mismatch in test",
                update(render) {
                    mockContext.render = render
                },
            })
            const { parsingRemainder: remainder, returnRemainderAddition } = consumer.process(children)
            expect(mockContext.render).toBeInstanceOf(StandardRender)
            expect(mockContext.render!.toJSON()).toEqual(["Message Test"])
            expect(remainder).toHaveLength(1)
            expect(remainder[0].data.tag).toBe("Room")
            expect(returnRemainderAddition).toEqual([])
        })

        it("with no matching tag: update is called with undefined", () => {
            const tree = treeFromWML(deIndentWML(`
                <Message key=(test)>
                    <Room key=(testRoom) />
                </Message>
            `))
            const children = tree[0].children
            const mockContext = { render: undefined as StandardRender | undefined }
            const consumer = new StandardizeConsumerRender<typeof mockContext, SchemaDescriptionTag>(mockContext, {
                tag: "Description",
                nodeTypeGuard: isSchemaDescription,
                errorMessage: "Schema mismatch in test",
                update(render) {
                    mockContext.render = render
                },
            })
            const { returnRemainderAddition } = consumer.process(children)
            expect(mockContext.render).toBeUndefined()
            expect(returnRemainderAddition).toEqual([])
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
            const consumer = new StandardizeConsumerSimple(mockContext, {
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
            const c1 = new StandardizeConsumerSimple(mockContext, {
                tag: "ShortName",
                update(nodes) {
                    shortNameReceived.push(nodes)
                },
            })
            const c2 = new StandardizeConsumerSimple(mockContext, {
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
            const consumer = new StandardizeConsumerSimple(mockContext, {
                tag: "ShortName",
                update() {},
            })
            expect(() => processWithConsumers(mockContext, [consumer], children)).toThrow(
                /Unconsumed child tags:/
            )
            expect(() => processWithConsumers(mockContext, [consumer], children)).toThrow(/Map/)
        })

        it("aggregates returnRemainderAddition from consumers", () => {
            const roomTree = treeFromWML(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Name</ShortName>
                </Room>
            `))
            const children = roomTree[0].children
            const additions: GenericTree<SchemaTag>[] = []
            const mockConsumer: StandardizeConsumer = {
                process(current) {
                    additions.push(current)
                    return { parsingRemainder: [], returnRemainderAddition: current }
                }
            }
            const result = processWithConsumers({}, [mockConsumer], children)
            expect(result).toHaveLength(1)
            expect(result[0].data.tag).toBe("ShortName")
        })
    })
})
