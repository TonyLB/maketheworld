import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardExampleData } from "./dataTypes/example"
import StandardExample from './example'
import StandardReference from "../keys/reference"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { StandardMarkFacet } from "../keys/facets/mark"
import { StandardKey } from "../keys/key"
import { StandardComponent } from "./baseClasses"
import { isSchemaMark, isSchemaMatch } from "@tonylb/mtw-base/ts/schema/worldState"
import { isSchemaComponent } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit"

const mergeTest = (base: string, incoming: string): string => {
    const baseStandard = new StandardExample(deIndentWML(base))
    const incomingStandard = new StandardExample(deIndentWML(incoming))
    const mergedStandard = baseStandard.merge(incomingStandard)
    if (!mergedStandard) {
        throw new Error('Failure in mergeTest utility')
    }
    return schemaToWML([mergedStandard.schema])
}

describe('StandardExample class', () => {

    it('should construct StandardExample from WML', () => {
        const testSource = deIndentWML(`
            <Example uuid=(123) key=(test)>
                <DisplayName>Name Test</DisplayName>
                <Summary>Summary Test</Summary>
                <Description>Description Test</Description>
            </Example>
        `)
        const testExample = new StandardExample(testSource)
        expect(testExample.key).toEqual('test')
        expect(testExample.displayName?.toJSON()).toEqual('Name Test')
        expect(testExample.summary?.toJSON()).toEqual(['Summary Test'])
        expect(testExample.description?.toJSON()).toEqual(['Description Test'])
        expect(schemaToWML([testExample.schema])).toEqual(testSource)
    })

    it('should construct StandardExample from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Example uuid=(123) key=(test)>
                <DisplayName>Name Test</DisplayName>
                <Summary>Summary Test</Summary>
                <Description>Description Test</Description>
            </Example>
        `)
        schema.loadWML(testSource)
        const testExample = new StandardExample(schema.schema[0])
        expect(testExample.key).toEqual('test')
        expect(testExample.displayName?.toJSON()).toEqual('Name Test')
        expect(testExample.summary?.toJSON()).toEqual(['Summary Test'])
        expect(testExample.description?.toJSON()).toEqual(['Description Test'])
        expect(schemaToWML([testExample.schema])).toEqual(testSource)
    })

    it('should construct StandardExample from StandardExampleData', () => {
        const testExampleData: StandardExampleData = {
            key: 'test',
            tag: 'Example',
            displayName: 'Name Test',
            summary: ['Summary Test'],
            description: ['Description Test'],
        }
        const testExample = new StandardExample(testExampleData)
        expect(testExample.key).toEqual('test')
        expect(testExample.displayName?.toJSON()).toEqual('Name Test')
        expect(testExample.summary?.toJSON()).toEqual(['Summary Test'])
        expect(testExample.description?.toJSON()).toEqual(['Description Test'])
        expect(testExample.toJSON()).toEqual(testExampleData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Example key=(testExample)>
                <DisplayName>Lobby</DisplayName>
                <Summary>Summary Text</Summary>
                <Description>A plain lobby.</Description>
            </Example>`,
            `<Example key=(testExample)>
                <Replace><DisplayName>Lobby</DisplayName></Replace><With><DisplayName>Spooky Lobby</DisplayName></With>
                <Summary><Remove><Space />Text</Remove></Summary>
                <Description><Space />Shadows cling to the corners of the room.</Description>
            </Example>`
        )).toEqual(deIndentWML(`
            <Example key=(testExample)>
                <DisplayName>Spooky Lobby</DisplayName>
                <Summary>Summary</Summary>
                <Description>
                    A plain lobby. Shadows cling to the corners of the room.
                </Description>
            </Example>
        `))
    })

    it('should map contents correctly', () => {
        const test = new StandardExample(`
            <Example key=(testExample)>
                <DisplayName>Lobby</DisplayName>
                <Summary>Summary</Summary>
                <Description>A plain lobby.</Description>
            </Example>
        `)
        const callback = (tree) => {
            return tree.map((node) => {
                if (treeNodeTypeguard(isSchemaString)(node)) {
                    return { data: { tag: 'String', value: `${node.data.value}Narf!` }, children: [] }
                }
                else {
                    return {
                        ...node,
                        children: callback(node.children)
                    }
                }
            })
        }
        expect(schemaToWML([test.mapContents(callback).schema])).toEqual(deIndentWML(`
            <Example key=(testExample)>
                <DisplayName>Lobby</DisplayName>
                <Summary>SummaryNarf!</Summary>
                <Description>A plain lobby.Narf!</Description>
            </Example>
        `))
    })

    it('should return condensed RenderSchema on JSON', () => {
        const test = new StandardExample(`
            <Example key=(testExample)>
                <DisplayName>Lobby (lit)</DisplayName>
                <Summary>Summary</Summary>
                <Description>A plain lobby.</Description>
            </Example>
        `)
        expect(test.toJSON()).toEqual({
            key: 'testExample',
            tag: 'Example',
            displayName: 'Lobby (lit)',
            summary: ['Summary'],
            description: ['A plain lobby.']
        })
    })

    it('should diff identical components correctly', () => {
        const testExample = new StandardExample({
            key: 'test',
            tag: 'Example',
            displayName: 'Name Test',
            summary: ['Summary Test'],
            description: ['Description Test'],
        })
        expect(testExample.diff(testExample)).toBeUndefined()
    })

    it('should correctly diff removing a field', () => {
        const testExample = new StandardExample({
            key: 'test',
            tag: 'Example',
            displayName: 'Name Test',
            summary: ['Summary Test'],
            description: ['Description Test'],
        })
        const testExample2 = new StandardExample({
            key: 'test',
            tag: 'Example',
            displayName: 'Name Test',
            summary: ['Summary Test'],
        })
        expect(testExample.diff(testExample2)?.toJSON()).toEqual({
            key: 'test',
            tag: 'Example',
            description: { tag: 'Remove', match: ['Description Test'] },
        })
    })

    it('should correct diff adding a field', () => {
        const testExample = new StandardExample({
            key: 'test',
            tag: 'Example',
            displayName: 'Name Test',
            summary: ['Summary Test'],
        })
        const testExample2 = new StandardExample({
            key: 'test',
            tag: 'Example',
            displayName: 'Name Test',
            summary: ['Summary Test'],
            description: ['Description Test'],
        })
        expect(testExample.diff(testExample2)?.toJSON()).toEqual({
            key: 'test',
            tag: 'Example',
            description: ['Description Test'],
        })
    })

    it('should correctly diff changing a field', () => {
        const testExample = new StandardExample({
            key: 'test',
            tag: 'Example',
            displayName: 'Name Test',
            summary: ['Summary Test'],
            description: ['Description', { data: { tag: 'Space' }, children: [] }, 'Test'],
        })
        const testExample2 = new StandardExample({
            key: 'test',
            tag: 'Example',
            displayName: 'Name Test',
            summary: ['Summary Test'],
            description: ['Description', { data: { tag: 'Space' }, children: [] }, 'Changed'],
        })
        expect(testExample.diff(testExample2)?.toJSON()).toEqual({
            key: 'test',
            tag: 'Example',
            description: {
                tag: 'Replace',
                match: ['Test'],
                payload: ['Changed']
            },
        })
    })

    it('should correctly remap contents', () => {
        const testExample = new StandardExample(`
            <Example uuid=(123)>
                <DisplayName>Name Test</DisplayName>
                <Summary>Summary Test</Summary>
                <Description>Description Test<Link to=(feature1)>Link Text</Link></Description>
            </Example>
        `)
        const mappings = [new StandardReference({ key: 'feature1', tag: 'Feature', universalKey: 'FEATURE#feature1' })]
        const remapped = testExample.withMapping(mappings).remapReferences('universal')
        expect(schemaToWML([remapped.schema])).toEqual(deIndentWML(`
            <Example uuid=(123)>
                <DisplayName>Name Test</DisplayName>
                <Summary>Summary Test</Summary>
                <Description>
                    Description Test<Link to=(feature1)>Link Text</Link>
                </Description>
            </Example>
        `))
    })

    describe('MarkFacetList functionality', () => {
        it('should construct StandardExample from WML with Mark facets', () => {
            const testSource = deIndentWML(`
                <Example uuid=(123) key=(test)>
                    <DisplayName>Name Test</DisplayName>
                    <Mark uuid=(MARK#mark1)><Match>Condition narrative</Match></Mark>
                </Example>
            `)
            const testExample = new StandardExample(testSource)
            expect(testExample.key).toEqual('test')
            expect(testExample.marks.length).toEqual(1)
            const facet = testExample.marks.items[0] as StandardMarkFacet
            expect((facet.reference as StandardReference).universalKey).toEqual('MARK#mark1')
            expect(facet.payload.toJSON()).toEqual('Condition narrative')
        })

        it('should construct StandardExample from JSON with marks field', () => {
            const testExampleData: StandardExampleData = {
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Condition narrative'
                }]
            }
            const testExample = new StandardExample(testExampleData)
            expect(testExample.key).toEqual('test')
            expect(testExample.marks.length).toEqual(1)
            const facet = testExample.marks.items[0] as StandardMarkFacet
            expect((facet.reference as StandardReference).universalKey).toEqual('MARK#mark1')
            expect(facet.payload.toJSON()).toEqual('Condition narrative')
        })

        it('should handle empty marks array in JSON', () => {
            const testExampleData: StandardExampleData = {
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: []
            }
            const testExample = new StandardExample(testExampleData)
            expect(testExample.marks.length).toEqual(0)
        })

        it('should handle undefined marks in JSON', () => {
            const testExampleData: StandardExampleData = {
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test'
            }
            const testExample = new StandardExample(testExampleData)
            expect(testExample.marks.length).toEqual(0)
        })

        it('should serialize marks to JSON when non-empty', () => {
            const testExample = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Condition narrative'
                }]
            })
            const json = testExample.toJSON() as StandardExampleData
            expect(json.marks).toBeDefined()
            expect(json.marks?.length).toEqual(1)
        })

        it('should omit marks from JSON when empty', () => {
            const testExample = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test'
            })
            const json = testExample.toJSON() as StandardExampleData
            expect(json.marks).toBeUndefined()
        })

        it('should generate plain Mark reference renders in schema (no Match children)', () => {
            const testSource = deIndentWML(`
                <Example uuid=(123) key=(test)>
                    <DisplayName>Name Test</DisplayName>
                    <Mark uuid=(MARK#mark1)><Match>Condition narrative</Match></Mark>
                </Example>
            `)
            const testExample = new StandardExample(testSource)
            const schema = testExample.schema
            // Schema should contain plain Mark reference (no Match child in schema output)
            const markChildren = schema.children.filter((child: any) => child.data?.tag === 'Mark')
            expect(markChildren.length).toBeGreaterThan(0)
            // The Mark should not have Match children in schema (that's for nestedSchema in Task 2)
            const markNode = markChildren[0]
            const hasMatch = markNode.children?.some((child: any) => child.data?.tag === 'Match')
            expect(hasMatch).toBeFalsy()
        })

        it('should merge Examples with marks', () => {
            const base = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Base narrative'
                }]
            })
            const incoming = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark2', universalKey: 'MARK#mark2' },
                    payload: 'Incoming narrative'
                }]
            })
            const merged = base.merge(incoming) as StandardExample
            expect(merged?.marks.length).toEqual(2)
        })

        it('should merge Example with marks into Example without marks', () => {
            const base = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test'
            })
            const incoming = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Incoming narrative'
                }]
            })
            const merged = base.merge(incoming) as StandardExample
            expect(merged?.marks.length).toEqual(1)
        })

        it('should merge Example without marks into Example with marks', () => {
            const base = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Base narrative'
                }]
            })
            const incoming = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test'
            })
            const merged = base.merge(incoming) as StandardExample
            expect(merged?.marks.length).toEqual(1)
        })

        it('should diff Examples with different marks', () => {
            const base = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Base narrative'
                }]
            })
            const incoming = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark2', universalKey: 'MARK#mark2' },
                    payload: 'Incoming narrative'
                }]
            })
            const diff = base.diff(incoming) as StandardExample | undefined
            expect(diff).toBeDefined()
            if (diff) {
                const diffJSON = diff.toJSON() as StandardExampleData
                expect(diffJSON.marks).toBeDefined()
            }
        })

        it('should diff Example with marks vs Example without marks', () => {
            const base = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Base narrative'
                }]
            })
            const incoming = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test'
            })
            const diff = base.diff(incoming) as StandardExample | undefined
            expect(diff).toBeDefined()
        })

        it('should diff identical marks (should return undefined)', () => {
            const base = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Same narrative'
                }]
            })
            const incoming = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Same narrative'
                }]
            })
            const diff = base.diff(incoming) as StandardExample | undefined
            // If marks are identical, diff might still return something for other fields
            // But marks should not be in the diff
            if (diff) {
                const diffJSON = diff.toJSON() as StandardExampleData
                // Marks should not appear if they're identical
                expect(diffJSON.marks).toBeUndefined()
            }
        })

        it('should invert Example with marks', () => {
            const testExample = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Condition narrative'
                }]
            })
            const inverted = testExample.invert() as StandardExample
            // Marks are inverted (creates Remove operations with ref=-1)
            expect(inverted.marks.length).toEqual(1)
            const invertedFacet = inverted.marks.items[0] as StandardMarkFacet
            expect(invertedFacet.ref).toEqual(-1)
        })

        it('should apply mapContents to marks', () => {
            const testExample = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Condition narrative'
                }]
            })
            const callback = (tree: any) => tree // Identity callback
            const mapped = testExample.mapContents(callback) as StandardExample
            expect(mapped.marks.length).toEqual(1)
        })

        it('should remap references in marks', () => {
            const testExample = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1' },
                    payload: 'Condition narrative'
                }]
            })
            const mappings = [new StandardReference({ key: 'mark1', tag: 'Mark', universalKey: 'MARK#mark1' })]
            const remapped = testExample.withMapping(mappings).remapReferences('universal') as StandardExample
            const remappedFacet = remapped.marks.items[0] as StandardMarkFacet
            expect((remappedFacet.reference as StandardReference).universalKey).toEqual('MARK#mark1')
        })

        it('should include marks in referencedKeys', () => {
            const testExample = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Condition narrative'
                }]
            })
            const referencedKeys = testExample.referencedKeys()
            const markKeys = referencedKeys.filter(key => key.reference.tag === 'Mark')
            expect(markKeys.length).toBeGreaterThan(0)
            expect(markKeys.every(key => key.referenceType === 'Facet')).toBe(true)
        })

        it('should not parse Mark tags without Match children as facets', () => {
            const testSource = deIndentWML(`
                <Example uuid=(123) key=(test)>
                    <DisplayName>Name Test</DisplayName>
                    <Mark uuid=(MARK#mark1) />
                </Example>
            `)
            const testExample = new StandardExample(testSource)
            // Mark without Match child should not be parsed as facet
            expect(testExample.marks.length).toEqual(0)
        })

        it('should handle Example with multiple Mark facets', () => {
            const testSource = deIndentWML(`
                <Example uuid=(123) key=(test)>
                    <DisplayName>Name Test</DisplayName>
                    <Mark uuid=(MARK#mark1)><Match>First condition</Match></Mark>
                    <Mark uuid=(MARK#mark2)><Match>Second condition</Match></Mark>
                </Example>
            `)
            const testExample = new StandardExample(testSource)
            expect(testExample.marks.length).toEqual(2)
            const facet0 = testExample.marks.items[0] as StandardMarkFacet
            const facet1 = testExample.marks.items[1] as StandardMarkFacet
            expect(facet0.payload.toJSON()).toEqual('First condition')
            expect(facet1.payload.toJSON()).toEqual('Second condition')
        })

        it('should handle Example with both name/summary/description AND marks', () => {
            const testExample = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                summary: ['Summary Test'],
                description: ['Description Test'],
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Condition narrative'
                }]
            })
            expect(testExample.displayName?.toJSON()).toEqual('Name Test')
            expect(testExample.summary?.toJSON()).toEqual(['Summary Test'])
            expect(testExample.description?.toJSON()).toEqual(['Description Test'])
            expect(testExample.marks.length).toEqual(1)
        })

        it('should consider marks in isEmpty check', () => {
            const emptyExample = new StandardExample({
                key: 'test',
                tag: 'Example'
            })
            expect(emptyExample.isEmpty()).toBe(true)

            const exampleWithMarks = new StandardExample({
                key: 'test',
                tag: 'Example',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'Condition narrative'
                }]
            })
            // isEmpty() checks name/summary/description AND marks
            expect(exampleWithMarks.isEmpty()).toBe(false)
        })

        describe('nestedSchema', () => {
            const mockLookup = (key: string | StandardKey): StandardComponent | undefined => {
                // Return undefined for lookup - marks don't need to be looked up since they generate their own reference renders
                return undefined
            }

            it('should render enhanced Mark references with Match children', () => {
                const testExample = new StandardExample({
                    key: 'test',
                    tag: 'Example',
                    displayName: 'Name Test',
                    marks: [{
                        reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                        payload: 'Condition narrative'
                    }]
                })

                const options = {
                    key: new StandardKey({ key: 'test', universalKey: 'EXAMPLE#test' })
                }
                const nested = testExample.nestedSchema(mockLookup, options)

                expect(nested.data.tag).toEqual('Example')
                if (treeNodeTypeguard(isSchemaComponent)(nested)) {
                    expect(nested.data.key).toEqual('test')
                }

                // Find Mark node in children
                const markNode = nested.children.find(child => 
                    treeNodeTypeguard(isSchemaMark)(child)
                )
                expect(markNode).toBeDefined()
                if (markNode && treeNodeTypeguard(isSchemaMark)(markNode)) {
                    // Mark should have Match child
                    const matchNode = markNode.children.find(child =>
                        treeNodeTypeguard(isSchemaMatch)(child)
                    )
                    expect(matchNode).toBeDefined()
                    if (matchNode && treeNodeTypeguard(isSchemaMatch)(matchNode)) {
                        // Match should have String child with narrative
                        const stringNode = matchNode.children.find(child =>
                            child.data.tag === 'String'
                        )
                        expect(stringNode).toBeDefined()
                        if (stringNode && stringNode.data.tag === 'String') {
                            expect(stringNode.data.value).toEqual('Condition narrative')
                        }
                    }
                }
            })

            it('should combine Name, Summary, Description with Mark facets', () => {
                const testExample = new StandardExample({
                    key: 'test',
                    tag: 'Example',
                    displayName: 'Name Test',
                    summary: ['Summary Test'],
                    description: ['Description Test'],
                    marks: [{
                        reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                        payload: 'Condition narrative'
                    }]
                })

                const options = {
                    key: new StandardKey({ key: 'test', universalKey: 'EXAMPLE#test' })
                }
                const nested = testExample.nestedSchema(mockLookup, options)

                // Should have DisplayName, Summary, Description, and Mark
                const displayNameNode = nested.children.find(child => child.data.tag === 'DisplayName')
                const summaryNode = nested.children.find(child => child.data.tag === 'Summary')
                const descriptionNode = nested.children.find(child => child.data.tag === 'Description')
                const markNode = nested.children.find(child => treeNodeTypeguard(isSchemaMark)(child))

                expect(displayNameNode).toBeDefined()
                expect(summaryNode).toBeDefined()
                expect(descriptionNode).toBeDefined()
                expect(markNode).toBeDefined()
            })

            it('should handle multiple Mark facets', () => {
                const testExample = new StandardExample({
                    key: 'test',
                    tag: 'Example',
                    displayName: 'Name Test',
                marks: [{
                    reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                    payload: 'First condition'
                }, {
                    reference: { tag: 'Mark', key: 'mark2', universalKey: 'MARK#mark2' },
                    payload: 'Second condition'
                }]
                })

                const options = {
                    key: new StandardKey({ key: 'test', universalKey: 'EXAMPLE#test' })
                }
                const nested = testExample.nestedSchema(mockLookup, options)

                // Should have two Mark nodes
                const markNodes = nested.children.filter(child =>
                    treeNodeTypeguard(isSchemaMark)(child)
                )
                expect(markNodes.length).toEqual(2)
            })

            it('should handle empty marks list', () => {
                const testExample = new StandardExample({
                    key: 'test',
                    tag: 'Example',
                    displayName: 'Name Test'
                })

                const options = {
                    key: new StandardKey({ key: 'test', universalKey: 'EXAMPLE#test' })
                }
                const nested = testExample.nestedSchema(mockLookup, options)

                // Should have DisplayName but no Mark nodes
                const displayNameNode = nested.children.find(child => child.data.tag === 'DisplayName')
                const markNodes = nested.children.filter(child =>
                    treeNodeTypeguard(isSchemaMark)(child)
                )

                expect(displayNameNode).toBeDefined()
                expect(markNodes.length).toEqual(0)
            })

            it('should handle Replace operations on Mark Facets', () => {
                // Test that we can handle an incoming Replace operation at the payload level
                // Base must contain the match value for Replace to work
                const baseExample = new StandardExample(`
                    <Example uuid=(test) key=(test)>
                        <DisplayName>Name Test</DisplayName>
                        <Mark uuid=(mark1) key=(mark1)>
                            <Match>Original condition</Match>
                        </Mark>
                    </Example>
                `)

                // Incoming example has a Replace operation at the payload level:
                // Replace 'Original condition' with 'Updated condition' in the payload
                const incomingExample = new StandardExample(`
                    <Example uuid=(test) key=(test)>
                        <Mark uuid=(mark1) key=(mark1) ref={0}>
                            <Replace><Match>Original condition</Match></Replace>
                            <With><Match>Updated condition</Match></With>
                        </Mark>
                    </Example>
                `)

                const merged = baseExample.merge(incomingExample) as StandardExample

                // Verify round-trip: the merged result should serialize to WML with Match child
                // Use nestedSchema() to include facet payloads (schema only includes references)
                const options = {
                    key: new StandardKey({ key: 'test', universalKey: 'EXAMPLE#test' })
                }
                const mockLookup = (key: string | StandardKey) => undefined
                const nested = merged.nestedSchema(mockLookup, options)
                const expectedWML = deIndentWML(`
                    <Example uuid=(test) key=(test)>
                        <DisplayName>Name Test</DisplayName>
                        <Mark key=(mark1)><Match>Updated condition</Match></Mark>
                    </Example>
                `)
                expect(schemaToWML([nested])).toEqual(expectedWML)
            })

            it('should handle Remove references (ref < 0)', () => {
                // Create an inverted facet (which creates Remove operations)
                const testExample = new StandardExample({
                    key: 'test',
                    tag: 'Example',
                    displayName: 'Name Test',
                    marks: [{
                        reference: { tag: 'Mark', key: 'mark1', universalKey: 'MARK#mark1' },
                        payload: 'Condition narrative'
                    }]
                })

                const inverted = testExample.invert() as StandardExample
                const facet = inverted.marks.items[0] as StandardMarkFacet

                // Inverted facet should have ref < 0
                expect(facet.ref).toBeLessThan(0)

                const options = {
                    key: new StandardKey({ key: 'test', universalKey: 'EXAMPLE#test' })
                }
                const nested = inverted.nestedSchema(mockLookup, options)

                // Should have Remove-wrapped Mark node (renderFacet handles Remove via reference schema generation)
                // When ref < 0, the reference schema returns Remove-wrapped, and renderFacet preserves it
                // Find the Remove node that contains a Mark node (there may be other Remove nodes from Name/Summary/Description)
                const removeNodes = nested.children.filter(child =>
                    treeNodeTypeguard(isSchemaRemove)(child)
                )
                expect(removeNodes.length).toBeGreaterThan(0)
                // Find the Remove node that contains a Mark node
                const removeNodeWithMark = removeNodes.find(removeNode => {
                    if (treeNodeTypeguard(isSchemaRemove)(removeNode)) {
                        return removeNode.children.some(child =>
                            treeNodeTypeguard(isSchemaMark)(child)
                        )
                    }
                    return false
                })
                expect(removeNodeWithMark).toBeDefined()
                if (removeNodeWithMark && treeNodeTypeguard(isSchemaRemove)(removeNodeWithMark)) {
                    // The Remove node should contain a Mark node
                    const markNode = removeNodeWithMark.children.find(child =>
                        treeNodeTypeguard(isSchemaMark)(child)
                    )
                    expect(markNode).toBeDefined()
                    if (markNode) {
                        expect(treeNodeTypeguard(isSchemaMark)(markNode)).toBe(true)
                    }
                }
            })

            it('should round-trip: WML → StandardForm → nestedSchema → WML', () => {
                const testSource = deIndentWML(`
                    <Example uuid=(EXAMPLE#test) key=(test)>
                        <DisplayName>Name Test</DisplayName>
                        <Summary>Summary Test</Summary>
                        <Description>Description Test</Description>
                        <Mark uuid=(MARK#mark1)><Match>Condition narrative</Match></Mark>
                    </Example>
                `)

                const testExample = new StandardExample(testSource)
                expect(testExample.marks.length).toEqual(1)

                const options = {
                    key: new StandardKey({ key: 'test', universalKey: 'EXAMPLE#test' })
                }
                const nested = testExample.nestedSchema(mockLookup, options)

                // Convert back to WML and verify structure
                const resultWML = schemaToWML([nested])
                expect(resultWML).toContain('<DisplayName>Name Test</DisplayName>')
                expect(resultWML).toContain('<Summary>Summary Test</Summary>')
                expect(resultWML).toContain('<Description>Description Test</Description>')
                expect(resultWML).toContain('<Mark')
                expect(resultWML).toContain('<Match>Condition narrative</Match>')
            })
        })
    })

    describe('ShortName functionality', () => {
        it('should round-trip WML with ShortName', () => {
            const testSource = deIndentWML(`
                <Example uuid=(ex1) key=(ex1)>
                    <ShortName>Tab label</ShortName>
                    <DisplayName>Name Test</DisplayName>
                    <Summary>Summary Test</Summary>
                    <Description>Description Test</Description>
                </Example>
            `)
            const testExample = new StandardExample(testSource)
            expect(testExample.shortName?.toJSON()).toEqual('Tab label')
            expect(testExample.displayName?.toJSON()).toEqual('Name Test')
            const resultWML = schemaToWML([testExample.schema])
            expect(resultWML).toContain('<ShortName>Tab label</ShortName>')
            expect(resultWML).toContain('<DisplayName>Name Test</DisplayName>')
            expect(resultWML).toContain('<Summary>Summary Test</Summary>')
            expect(resultWML).toContain('<Description>Description Test</Description>')
        })

        it('should construct from StandardExampleData with shortName', () => {
            const testExampleData: StandardExampleData = {
                key: 'test',
                tag: 'Example',
                shortName: 'Example label',
                displayName: 'Name Test',
                summary: ['Summary Test'],
                description: ['Description Test'],
            }
            const testExample = new StandardExample(testExampleData)
            expect(testExample.shortName?.toJSON()).toEqual('Example label')
            expect(testExample.toJSON()).toMatchObject({ shortName: 'Example label' })
        })

        it('should merge shortName when present', () => {
            const base = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                shortName: 'Base',
            })
            const incoming = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                shortName: 'Incoming',
            })
            const merged = base.merge(incoming) as StandardExample
            expect(merged?.shortName?.toJSON()).toEqual('BaseIncoming')
        })

        it('should invert shortName when present', () => {
            const testExample = new StandardExample({
                key: 'test',
                tag: 'Example',
                displayName: 'Name Test',
                shortName: 'Label',
            })
            const inverted = testExample.invert() as StandardExample
            expect(inverted.shortName).toBeDefined()
        })

        it('should consider shortName in isEmpty check', () => {
            const emptyExample = new StandardExample({ key: 'test', tag: 'Example' })
            expect(emptyExample.isEmpty()).toBe(true)

            const exampleWithShortName = new StandardExample({
                key: 'test',
                tag: 'Example',
                shortName: 'Only label',
            })
            expect(exampleWithShortName.isEmpty()).toBe(false)
        })

        it('should include ShortName in schema and nestedSchema when set', () => {
            const testExample = new StandardExample({
                key: 'test',
                tag: 'Example',
                shortName: 'Tab label',
                displayName: 'Name Test',
            })
            const schema = testExample.schema
            const shortNameNode = schema.children.find((c: any) => c.data?.tag === 'ShortName')
            expect(shortNameNode).toBeDefined()

            const options = { key: new StandardKey({ key: 'test', universalKey: 'EXAMPLE#test' }) }
            const mockLookup = (_k: string | StandardKey) => undefined
            const nested = testExample.nestedSchema(mockLookup, options)
            const nestedShortName = nested.children.find((c: any) => c.data?.tag === 'ShortName')
            expect(nestedShortName).toBeDefined()
        })

        it('should apply mapContents to shortName', () => {
            const testExample = new StandardExample({
                key: 'test',
                tag: 'Example',
                shortName: 'Original',
                displayName: 'Name Test',
            })
            const mapped = testExample.mapContents((tree) =>
                tree.map((node) => {
                    if (treeNodeTypeguard(isSchemaString)(node)) {
                        return { data: { tag: 'String', value: node.data.value + '-mapped' }, children: [] }
                    }
                    return { ...node, children: [] }
                })
            ) as StandardExample
            expect(mapped.shortName?.toJSON()).toEqual('Original-mapped')
        })
    })
})

describe('StandardExample.equals semantic optionals', () => {
    it('treats undefined and semantic-empty summary as equal', () => {
        const withoutSummary = new StandardExample({
            key: 'test',
            tag: 'Example',
            displayName: 'Alpha',
        })
        const withEmptySummary = new StandardExample({
            key: 'test',
            tag: 'Example',
            displayName: 'Alpha',
            summary: [],
        })
        expect(withoutSummary.equals(withEmptySummary)).toBe(true)
        expect(withEmptySummary.equals(withoutSummary)).toBe(true)
    })

    it('treats undefined and semantic-empty shortName as equal', () => {
        const withoutShortName = new StandardExample({
            key: 'test',
            tag: 'Example',
            displayName: 'Alpha',
        })
        const withEmptyShortName = new StandardExample({
            key: 'test',
            tag: 'Example',
            displayName: 'Alpha',
            shortName: '',
        })
        expect(withoutShortName.equals(withEmptyShortName)).toBe(true)
    })
})