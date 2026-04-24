import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardMarkData } from "./dataTypes/mark"
import { StandardLensData } from "./dataTypes/lens"
import StandardMark, { StandardLens } from './worldState'
import { mergeTest } from "./utils/testing"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"

describe('StandardMark class', () => {

    it('should construct StandardMark from WML', () => {
        const testSource = deIndentWML(`
            <Mark uuid=(001) key=(test) />
        `)
        const testMark = new StandardMark(testSource)
        expect(testMark.key).toEqual('test')
        expect(schemaToWML([testMark.schema])).toEqual(testSource)
    })

    it('should construct StandardMark from WML with ShortName', () => {
        const testSource = deIndentWML(`
            <Mark key=(test)><ShortName>Test Mark</ShortName></Mark>
        `)
        const testMark = new StandardMark(testSource)
        expect(testMark.key).toEqual('test')
        expect(testMark.shortName?.toJSON()).toEqual('Test Mark')
        expect(schemaToWML([testMark.schema])).toEqual(testSource)
    })

    it('should construct StandardMark from WML with Description', () => {
        const testSource = deIndentWML(`
            <Mark key=(test)><Description>Test description.</Description></Mark>
        `)
        const testMark = new StandardMark(testSource)
        expect(testMark.key).toEqual('test')
        expect(testMark.description?.toJSON()).toEqual(['Test description.'])
        expect(schemaToWML([testMark.schema])).toEqual(testSource)
    })

    it('should construct StandardMark from WML with ShortName and Description', () => {
        const testSource = deIndentWML(`
            <Mark key=(test)>
                <ShortName>Test Mark</ShortName>
                <Description>Test description.</Description>
            </Mark>
        `)
        const testMark = new StandardMark(testSource)
        expect(testMark.key).toEqual('test')
        expect(testMark.shortName?.toJSON()).toEqual('Test Mark')
        expect(testMark.description?.toJSON()).toEqual(['Test description.'])
        expect(schemaToWML([testMark.schema])).toEqual(testSource)
    })

    it('should construct StandardMark from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Mark key=(test)>
                <ShortName>Test Mark</ShortName>
                <Description>Test description.</Description>
            </Mark>
        `)
        schema.loadWML(testSource)
        const testMark = new StandardMark(schema.schema[0])
        expect(testMark.key).toEqual('test')
        expect(testMark.shortName?.toJSON()).toEqual('Test Mark')
        expect(testMark.description?.toJSON()).toEqual(['Test description.'])
        expect(schemaToWML([testMark.schema])).toEqual(testSource)
    })

    it('should construct StandardMark from StandardMarkData', () => {
        const testMarkData: StandardMarkData = {
            key: 'test',
            tag: 'Mark'
        }
        const testMark = new StandardMark(testMarkData)
        expect(testMark.key).toEqual('test')
        expect(testMark.toJSON()).toEqual(testMarkData)
    })

    it('should construct StandardMark from StandardMarkData with shortName', () => {
        const testMarkData: StandardMarkData = {
            key: 'test',
            tag: 'Mark',
            shortName: 'Test Mark'
        }
        const testMark = new StandardMark(testMarkData)
        expect(testMark.key).toEqual('test')
        expect(testMark.shortName?.toJSON()).toEqual('Test Mark')
        expect(testMark.toJSON()).toEqual(testMarkData)
    })

    it('should construct StandardMark from StandardMarkData with description', () => {
        const testMarkData: StandardMarkData = {
            key: 'test',
            tag: 'Mark',
            description: ['Test description.']
        }
        const testMark = new StandardMark(testMarkData)
        expect(testMark.key).toEqual('test')
        expect(testMark.description?.toJSON()).toEqual(['Test description.'])
        expect(testMark.toJSON()).toEqual(testMarkData)
    })

    it('should construct StandardMark from StandardMarkData with both fields', () => {
        const testMarkData: StandardMarkData = {
            key: 'test',
            tag: 'Mark',
            shortName: 'Test Mark',
            description: ['Test description.']
        }
        const testMark = new StandardMark(testMarkData)
        expect(testMark.key).toEqual('test')
        expect(testMark.shortName?.toJSON()).toEqual('Test Mark')
        expect(testMark.description?.toJSON()).toEqual(['Test description.'])
        expect(testMark.toJSON()).toEqual(testMarkData)
    })

    it('should serialize to WML correctly', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark',
            shortName: 'Test Mark',
            description: ['Test description.']
        })
        const wml = schemaToWML([testMark.schema])
        expect(wml).toEqual(deIndentWML(`
            <Mark key=(test)>
                <ShortName>Test Mark</ShortName>
                <Description>Test description.</Description>
            </Mark>
        `))
    })

    it('should serialize to JSON correctly', () => {
        const testMark = new StandardMark(`
            <Mark key=(testMark)>
                <ShortName>Test Mark</ShortName>
                <Description>Test description.</Description>
            </Mark>
        `)
        expect(testMark.toJSON()).toEqual({
            key: 'testMark',
            tag: 'Mark',
            shortName: 'Test Mark',
            description: ['Test description.']
        })
    })

    it('should handle round-trip WML -> StandardMark -> WML', () => {
        const testSource = deIndentWML(`
            <Mark key=(test)>
                <ShortName>Test Mark</ShortName>
                <Description>Test description.</Description>
            </Mark>
        `)
        const testMark = new StandardMark(testSource)
        expect(schemaToWML([testMark.schema])).toEqual(testSource)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Mark key=(testMark)>
                <ShortName>Original</ShortName>
            </Mark>`,
            StandardMark,
            `<Mark key=(testMark)>
                <Description>New description.</Description>
            </Mark>`
        )).toEqual(deIndentWML(`
            <Mark key=(testMark)>
                <ShortName>Original</ShortName>
                <Description>New description.</Description>
            </Mark>
        `))
    })

    it('should merge shortName correctly', () => {
        expect(mergeTest(
            `<Mark key=(testMark)>
                <ShortName>Original</ShortName>
            </Mark>`,
            StandardMark,
            `<Mark key=(testMark)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Mark>`
        )).toEqual(deIndentWML(`
            <Mark key=(testMark)><ShortName>Updated</ShortName></Mark>
        `))
    })

    it('should merge description correctly', () => {
        expect(mergeTest(
            `<Mark key=(testMark)>
                <Description>Original description.</Description>
            </Mark>`,
            StandardMark,
            `<Mark key=(testMark)>
                <Description><Space />Additional text.</Description>
            </Mark>`
        )).toEqual(deIndentWML(`
            <Mark key=(testMark)>
                <Description>Original description. Additional text.</Description>
            </Mark>
        `))
    })

    it('should merge both fields correctly', () => {
        expect(mergeTest(
            `<Mark key=(testMark)>
                <ShortName>Original</ShortName>
                <Description>Original description.</Description>
            </Mark>`,
            StandardMark,
            `<Mark key=(testMark)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
                <Description><Space />Additional text.</Description>
            </Mark>`
        )).toEqual(deIndentWML(`
            <Mark key=(testMark)>
                <ShortName>Updated</ShortName>
                <Description>Original description. Additional text.</Description>
            </Mark>
        `))
    })

    it('should diff identical components correctly', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark',
            shortName: 'Test Mark',
            description: ['Test description.']
        })
        expect(testMark.diff(testMark)).toBeUndefined()
    })

    it('should diff shortName correctly', () => {
        const testMark = new StandardMark(`
            <Mark key=(test)>
                <ShortName>Original</ShortName>
            </Mark>
        `)
        const testMark2 = new StandardMark(`
            <Mark key=(test)>
                <ShortName>Updated</ShortName>
            </Mark>
        `)
        const diff = testMark.diff(testMark2)
        expect(diff).toBeDefined()
        expect(schemaToWML([diff!.schema])).toEqual(deIndentWML(`
            <Mark key=(test)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Mark>
        `))
    })

    it('should diff description correctly', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark',
            description: ['Original description.']
        })
        const testMark2 = new StandardMark({
            key: 'test',
            tag: 'Mark',
            description: ['Changed description.']
        })
        const diff = testMark.diff(testMark2)
        expect(diff).toBeDefined()
        expect(diff?.toJSON()).toEqual({
            key: 'test',
            tag: 'Mark',
            description: {
                tag: 'Replace',
                match: ['Original description.'],
                payload: ['Changed description.']
            }
        })
    })

    it('should correctly diff removing a field', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark',
            shortName: 'Test Mark',
            description: ['Test description.']
        })
        const testMark2 = new StandardMark({
            key: 'test',
            tag: 'Mark',
            shortName: 'Test Mark'
        })
        expect(testMark.diff(testMark2)?.toJSON()).toEqual({
            key: 'test',
            tag: 'Mark',
            description: { tag: 'Remove', match: ['Test description.'] }
        })
    })

    it('should correctly diff adding a field', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark',
            shortName: 'Test Mark'
        })
        const testMark2 = new StandardMark({
            key: 'test',
            tag: 'Mark',
            shortName: 'Test Mark',
            description: ['Test description.']
        })
        expect(testMark.diff(testMark2)?.toJSON()).toEqual({
            key: 'test',
            tag: 'Mark',
            description: ['Test description.']
        })
    })

    it('should correctly diff changing a field', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark',
            description: ['Description', { data: { tag: 'Space' }, children: [] }, 'Test']
        })
        const testMark2 = new StandardMark({
            key: 'test',
            tag: 'Mark',
            description: ['Description', { data: { tag: 'Space' }, children: [] }, 'Changed']
        })
        expect(testMark.diff(testMark2)?.toJSON()).toEqual({
            key: 'test',
            tag: 'Mark',
            description: {
                tag: 'Replace',
                match: ['Test'],
                payload: ['Changed']
            }
        })
    })

    it('should return true for isEmpty when both fields are empty', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark'
        })
        expect(testMark._payload.isEmpty()).toBe(true)
    })

    it('should return false for isEmpty when shortName exists', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark',
            shortName: 'Test Mark'
        })
        expect(testMark._payload.isEmpty()).toBe(false)
    })

    it('should return false for isEmpty when description exists', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark',
            description: ['Test description.']
        })
        expect(testMark._payload.isEmpty()).toBe(false)
    })

    it('should invert correctly', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark',
            shortName: 'Test Mark',
            description: ['Test description.']
        })
        const inverted = testMark._payload.invert()
        expect(inverted.shortName?.toJSON()).toEqual({ tag: 'Remove', match: 'Test Mark' })
        expect(inverted.description?.toJSON()).toEqual({ tag: 'Remove', match: ['Test description.'] })
    })

    it('should map contents correctly', () => {
        const test = new StandardMark(`
            <Mark key=(testMark)>
                <ShortName>Test Mark</ShortName>
                <Description>Test description.</Description>
            </Mark>
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
        const mapped = test.mapContents(callback) as StandardMark
        expect(mapped.shortName?.toJSON()).toEqual('Test Mark') // ShortName doesn't get mapped
        expect(schemaToWML([mapped.schema])).toEqual(deIndentWML(`
            <Mark key=(testMark)>
                <ShortName>Test Mark</ShortName>
                <Description>Test description.Narf!</Description>
            </Mark>
        `))
    })

    it('should remap references correctly', () => {
        const testMark = new StandardMark(`
            <Mark uuid=(123)>
                <ShortName>Test Mark</ShortName>
                <Description>Test description<Link to=(feature1)>Link Text</Link></Description>
            </Mark>
        `)
        const mappings = [new StandardReference({ key: 'feature1', tag: 'Feature', universalKey: 'FEATURE#feature1' })]
        const remapped = testMark.withMapping(mappings).remapReferences('universal') as StandardMark
        expect(remapped.shortName?.toJSON()).toEqual('Test Mark') // ShortName doesn't contain references
        expect(schemaToWML([remapped.schema])).toEqual(deIndentWML(`
            <Mark uuid=(123)>
                <ShortName>Test Mark</ShortName>
                <Description>
                    Test description<Link to=(feature1)>Link Text</Link>
                </Description>
            </Mark>
        `))
    })

    it('should handle empty Mark component', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark'
        })
        expect(testMark.shortName).toBeUndefined()
        expect(testMark.description).toBeUndefined()
        expect(testMark._payload.isEmpty()).toBe(true)
    })

    it('should handle Mark with only ShortName', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark',
            shortName: 'Test Mark'
        })
        expect(testMark.shortName?.toJSON()).toEqual('Test Mark')
        expect(testMark.description).toBeUndefined()
        expect(testMark._payload.isEmpty()).toBe(false)
    })

    it('should handle Mark with only Description', () => {
        const testMark = new StandardMark({
            key: 'test',
            tag: 'Mark',
            description: ['Test description.']
        })
        expect(testMark.shortName).toBeUndefined()
        expect(testMark.description?.toJSON()).toEqual(['Test description.'])
        expect(testMark._payload.isEmpty()).toBe(false)
    })

    it('should throw when Mark contains unconsumed child tags', () => {
        const testSource = deIndentWML(`
            <Mark key=(test)>
                <ShortName>Test</ShortName>
                <Room key=(unexpectedRoom) />
            </Mark>
        `)
        expect(() => new StandardMark(testSource)).toThrow(/Unconsumed child tags/)
        expect(() => new StandardMark(testSource)).toThrow(/Room/)
    })

})

describe('StandardLens class', () => {

    it('should construct StandardLens from WML', () => {
        const testSource = deIndentWML(`
            <Lens uuid=(001) key=(test) />
        `)
        const testLens = new StandardLens(testSource)
        expect(testLens.key).toEqual('test')
        expect(schemaToWML([testLens.schema])).toEqual(testSource)
    })

    it('should construct StandardLens from WML with ShortName', () => {
        const testSource = deIndentWML(`
            <Lens key=(test)><ShortName>Test Lens</ShortName></Lens>
        `)
        const testLens = new StandardLens(testSource)
        expect(testLens.key).toEqual('test')
        expect(testLens.shortName?.toJSON()).toEqual('Test Lens')
        expect(schemaToWML([testLens.schema])).toEqual(testSource)
    })

    it('should construct StandardLens from WML with Description', () => {
        const testSource = deIndentWML(`
            <Lens key=(test)><Description>Test description.</Description></Lens>
        `)
        const testLens = new StandardLens(testSource)
        expect(testLens.key).toEqual('test')
        expect(testLens.description?.toJSON()).toEqual(['Test description.'])
        expect(schemaToWML([testLens.schema])).toEqual(testSource)
    })

    it('should construct StandardLens from WML with ShortName and Description', () => {
        const testSource = deIndentWML(`
            <Lens key=(test)>
                <ShortName>Test Lens</ShortName>
                <Description>Test description.</Description>
            </Lens>
        `)
        const testLens = new StandardLens(testSource)
        expect(testLens.key).toEqual('test')
        expect(testLens.shortName?.toJSON()).toEqual('Test Lens')
        expect(testLens.description?.toJSON()).toEqual(['Test description.'])
        expect(schemaToWML([testLens.schema])).toEqual(testSource)
    })

    it('should construct StandardLens from WML with Mark references', () => {
        const testSource = deIndentWML(`
            <Lens key=(test)>
                <ShortName>Test Lens</ShortName>
                <Mark key=(mark1) />
            </Lens>
        `)
        const testLens = new StandardLens(testSource)
        expect(testLens.key).toEqual('test')
        expect(testLens.marks.items.length).toEqual(1)
        expect(testLens.marks.items[0].reference.key).toEqual('mark1')
        expect(testLens.marks.items[0].reference.tag).toEqual('Mark')
        expect(schemaToWML([testLens.schema])).toEqual(testSource)
    })

    it('should construct StandardLens from WML with multiple Mark references', () => {
        const testSource = deIndentWML(`
            <Lens key=(test)>
                <ShortName>Test Lens</ShortName>
                <Mark key=(mark1) />
                <Mark key=(mark2) />
            </Lens>
        `)
        const testLens = new StandardLens(testSource)
        expect(testLens.key).toEqual('test')
        expect(testLens.marks.items.length).toEqual(2)
        expect(testLens.marks.items[0].reference.key).toEqual('mark1')
        expect(testLens.marks.items[1].reference.key).toEqual('mark2')
        expect(schemaToWML([testLens.schema])).toEqual(testSource)
    })

    it('should construct StandardLens from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Lens key=(test)>
                <ShortName>Test Lens</ShortName>
                <Description>Test description.</Description>
                <Mark key=(mark1) />
            </Lens>
        `)
        schema.loadWML(testSource)
        const testLens = new StandardLens(schema.schema[0])
        expect(testLens.key).toEqual('test')
        expect(testLens.shortName?.toJSON()).toEqual('Test Lens')
        expect(testLens.description?.toJSON()).toEqual(['Test description.'])
        expect(testLens.marks.items.length).toEqual(1)
        expect(schemaToWML([testLens.schema])).toEqual(testSource)
    })

    it('should construct StandardLens from StandardLensData', () => {
        const testLensData: StandardLensData = {
            key: 'test',
            tag: 'Lens'
        }
        const testLens = new StandardLens(testLensData)
        expect(testLens.key).toEqual('test')
        expect(testLens.toJSON()).toEqual(testLensData)
    })

    it('should construct StandardLens from StandardLensData with shortName', () => {
        const testLensData: StandardLensData = {
            key: 'test',
            tag: 'Lens',
            shortName: 'Test Lens'
        }
        const testLens = new StandardLens(testLensData)
        expect(testLens.key).toEqual('test')
        expect(testLens.shortName?.toJSON()).toEqual('Test Lens')
        expect(testLens.toJSON()).toEqual(testLensData)
    })

    it('should construct StandardLens from StandardLensData with description', () => {
        const testLensData: StandardLensData = {
            key: 'test',
            tag: 'Lens',
            description: ['Test description.']
        }
        const testLens = new StandardLens(testLensData)
        expect(testLens.key).toEqual('test')
        expect(testLens.description?.toJSON()).toEqual(['Test description.'])
        expect(testLens.toJSON()).toEqual(testLensData)
    })

    it('should construct StandardLens from StandardLensData with marks', () => {
        const testLensData: StandardLensData = {
            key: 'test',
            tag: 'Lens',
            marks: [{ reference: { key: 'mark1', tag: 'Mark' }, payload: {} }]
        }
        const testLens = new StandardLens(testLensData)
        expect(testLens.key).toEqual('test')
        expect(testLens.marks.items.length).toEqual(1)
        expect(testLens.marks.items[0].reference.key).toEqual('mark1')
        expect(testLens.marks.items[0].reference.tag).toEqual('Mark')
    })

    it('should construct StandardLens from StandardLensData with all fields', () => {
        const testLensData: StandardLensData = {
            key: 'test',
            tag: 'Lens',
            shortName: 'Test Lens',
            description: ['Test description.'],
            marks: [{ reference: { key: 'mark1', tag: 'Mark' }, payload: {} }]
        }
        const testLens = new StandardLens(testLensData)
        expect(testLens.key).toEqual('test')
        expect(testLens.shortName?.toJSON()).toEqual('Test Lens')
        expect(testLens.description?.toJSON()).toEqual(['Test description.'])
        expect(testLens.marks.items.length).toEqual(1)
        expect(testLens.marks.items[0].reference.key).toEqual('mark1')
    })

    it('should serialize to WML correctly', () => {
        const testLens = new StandardLens({
            key: 'test',
            tag: 'Lens',
            shortName: 'Test Lens',
            description: ['Test description.'],
            marks: [{ reference: { key: 'mark1', tag: 'Mark' }, payload: {} }]
        })
        const wml = schemaToWML([testLens.schema])
        expect(wml).toEqual(deIndentWML(`
            <Lens key=(test)>
                <ShortName>Test Lens</ShortName>
                <Description>Test description.</Description>
                <Mark key=(mark1) />
            </Lens>
        `))
    })

    it('should serialize to JSON correctly', () => {
        const testLens = new StandardLens(`
            <Lens key=(testLens)>
                <ShortName>Test Lens</ShortName>
                <Description>Test description.</Description>
                <Mark key=(mark1) />
            </Lens>
        `)
        const testLensJSON = testLens.toJSON() as StandardLensData
        expect(testLensJSON).toMatchObject({
            key: 'testLens',
            tag: 'Lens',
            shortName: 'Test Lens',
            description: ['Test description.'],
        })
        const testLensMarks = testLensJSON.marks ?? []
        expect(testLensMarks).toHaveLength(1)
        const [firstMark] = testLensMarks
        expect(firstMark).toBeDefined()
        if (!firstMark || 'tag' in firstMark) {
            throw new Error('Expected plain mark facet data in Lens JSON')
        }
        expect(firstMark.reference).toMatchObject({ key: 'mark1', tag: 'Mark' })
        expect(firstMark.payload).toEqual({})
    })

    it('should omit empty marks from JSON', () => {
        const testLens = new StandardLens({
            key: 'test',
            tag: 'Lens',
            shortName: 'Test Lens'
        })
        expect(testLens.toJSON()).toEqual({
            key: 'test',
            tag: 'Lens',
            shortName: 'Test Lens'
        })
    })

    it('should handle round-trip WML -> StandardLens -> WML', () => {
        const testSource = deIndentWML(`
            <Lens key=(test)>
                <ShortName>Test Lens</ShortName>
                <Description>Test description.</Description>
                <Mark key=(mark1) />
            </Lens>
        `)
        const testLens = new StandardLens(testSource)
        expect(schemaToWML([testLens.schema])).toEqual(testSource)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Lens key=(testLens)>
                <ShortName>Original</ShortName>
            </Lens>`,
            StandardLens,
            `<Lens key=(testLens)>
                <Description>New description.</Description>
            </Lens>`
        )).toEqual(deIndentWML(`
            <Lens key=(testLens)>
                <ShortName>Original</ShortName>
                <Description>New description.</Description>
            </Lens>
        `))
    })

    it('should merge marks correctly', () => {
        expect(mergeTest(
            `<Lens key=(testLens)>
                <Mark key=(mark1) />
            </Lens>`,
            StandardLens,
            `<Lens key=(testLens)>
                <Mark key=(mark2) />
            </Lens>`
        )).toEqual(deIndentWML(`
            <Lens key=(testLens)>
                <Mark key=(mark1) />
                <Mark key=(mark2) />
            </Lens>
        `))
    })

    it('should merge shortName correctly', () => {
        expect(mergeTest(
            `<Lens key=(testLens)>
                <ShortName>Original</ShortName>
            </Lens>`,
            StandardLens,
            `<Lens key=(testLens)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Lens>`
        )).toEqual(deIndentWML(`
            <Lens key=(testLens)><ShortName>Updated</ShortName></Lens>
        `))
    })

    it('should merge description correctly', () => {
        expect(mergeTest(
            `<Lens key=(testLens)>
                <Description>Original description.</Description>
            </Lens>`,
            StandardLens,
            `<Lens key=(testLens)>
                <Description><Space />Additional text.</Description>
            </Lens>`
        )).toEqual(deIndentWML(`
            <Lens key=(testLens)>
                <Description>Original description. Additional text.</Description>
            </Lens>
        `))
    })

    it('should return true for isEmpty when all fields are empty', () => {
        const testLens = new StandardLens({
            key: 'test',
            tag: 'Lens'
        })
        expect(testLens._payload.isEmpty()).toBe(true)
    })

    it('should return false for isEmpty when shortName exists', () => {
        const testLens = new StandardLens({
            key: 'test',
            tag: 'Lens',
            shortName: 'Test Lens'
        })
        expect(testLens._payload.isEmpty()).toBe(false)
    })

    it('should return false for isEmpty when description exists', () => {
        const testLens = new StandardLens({
            key: 'test',
            tag: 'Lens',
            description: ['Test description.']
        })
        expect(testLens._payload.isEmpty()).toBe(false)
    })

    it('should return false for isEmpty when marks exist', () => {
        const testLens = new StandardLens({
            key: 'test',
            tag: 'Lens',
            marks: [{ reference: { key: 'mark1', tag: 'Mark' }, payload: {} }]
        })
        expect(testLens._payload.isEmpty()).toBe(false)
    })

    it('should invert correctly', () => {
        const testLens = new StandardLens({
            key: 'test',
            tag: 'Lens',
            shortName: 'Test Lens',
            description: ['Test description.'],
            marks: [{ reference: { key: 'mark1', tag: 'Mark' }, payload: {} }]
        })
        const inverted = testLens._payload.invert()
        expect(inverted.shortName?.toJSON()).toEqual({ tag: 'Remove', match: 'Test Lens' })
        expect(inverted.description?.toJSON()).toEqual({ tag: 'Remove', match: ['Test description.'] })
        expect(inverted.marks.items.length).toEqual(1)
        expect(inverted.marks.items[0].ref).toEqual(-1)
    })

    it('should handle empty Lens component', () => {
        const testLens = new StandardLens({
            key: 'test',
            tag: 'Lens'
        })
        expect(testLens.shortName).toBeUndefined()
        expect(testLens.description).toBeUndefined()
        expect(testLens.marks.length).toEqual(0)
        expect(testLens._payload.isEmpty()).toBe(true)
    })

    it('should handle Lens with only ShortName', () => {
        const testLens = new StandardLens({
            key: 'test',
            tag: 'Lens',
            shortName: 'Test Lens'
        })
        expect(testLens.shortName?.toJSON()).toEqual('Test Lens')
        expect(testLens.description).toBeUndefined()
        expect(testLens.marks.length).toEqual(0)
        expect(testLens._payload.isEmpty()).toBe(false)
    })

    it('should handle Lens with only Description', () => {
        const testLens = new StandardLens({
            key: 'test',
            tag: 'Lens',
            description: ['Test description.']
        })
        expect(testLens.shortName).toBeUndefined()
        expect(testLens.description?.toJSON()).toEqual(['Test description.'])
        expect(testLens.marks.length).toEqual(0)
        expect(testLens._payload.isEmpty()).toBe(false)
    })

    it('should handle Lens with only marks', () => {
        const testLens = new StandardLens({
            key: 'test',
            tag: 'Lens',
            marks: [{ reference: { key: 'mark1', tag: 'Mark' }, payload: {} }]
        })
        expect(testLens.shortName).toBeUndefined()
        expect(testLens.description).toBeUndefined()
        expect(testLens.marks.items.length).toEqual(1)
        expect(testLens._payload.isEmpty()).toBe(false)
    })

    it('should throw when Lens contains unconsumed child tags', () => {
        const testSource = deIndentWML(`
            <Lens key=(test)>
                <ShortName>Test Lens</ShortName>
                <Room key=(unexpectedRoom) />
            </Lens>
        `)
        expect(() => new StandardLens(testSource)).toThrow(/Unconsumed child tags/)
        expect(() => new StandardLens(testSource)).toThrow(/Room/)
    })

    it('should round-trip Lens with Mark and Default', () => {
        const testSource = deIndentWML(`
            <Lens key=(illumination)>
                <ShortName>Illumination</ShortName>
                <Mark key=(illumination)><Default>light</Default></Mark>
            </Lens>
        `)
        const testLens = new StandardLens(testSource)
        expect(testLens.marks.items.length).toEqual(1)
        expect(testLens.marks.items[0].reference.key).toEqual('illumination')
        expect(testLens.marks.items[0].payload.default?.toJSON()).toEqual('light')
        expect(schemaToWML([testLens.schema])).toEqual(testSource)
    })

    it('should round-trip JSON for Lens with marks and default payload', () => {
        const data = {
            key: 'test',
            tag: 'Lens' as const,
            shortName: 'Test Lens',
            marks: [{ reference: { key: 'illumination', tag: 'Mark' as const }, payload: { default: 'light' } }],
        }
        const lens = new StandardLens(data)
        const lensJSON = lens.toJSON() as StandardLensData
        expect(lensJSON).toMatchObject({
            key: 'test',
            tag: 'Lens',
            shortName: 'Test Lens',
        })
        const lensMarks = lensJSON.marks ?? []
        expect(lensMarks).toHaveLength(1)
        const [firstLensMark] = lensMarks
        expect(firstLensMark).toBeDefined()
        if (!firstLensMark || 'tag' in firstLensMark) {
            throw new Error('Expected plain mark facet data in Lens JSON')
        }
        expect(firstLensMark.reference).toMatchObject({ key: 'illumination', tag: 'Mark' })
        expect(firstLensMark.payload).toEqual({ default: 'light' })
        const roundTripped = new StandardLens(lensJSON)
        expect(roundTripped.marks.items[0].payload.default?.toJSON()).toEqual('light')
    })

    it('should merge Lens Mark defaults correctly', () => {
        const merged = mergeTest(
            `<Lens key=(testLens)>
                <Mark key=(illumination)><Default>dark</Default></Mark>
            </Lens>`,
            StandardLens,
            `<Lens key=(testLens)>
                <Mark key=(illumination)><Default>light</Default></Mark>
            </Lens>`
        )
        expect(merged).toContain('<Default>light</Default>')
        expect(merged).toContain('<Mark key=(illumination)')
    })

    it('should diff Lens Mark defaults correctly', () => {
        const lens1 = new StandardLens(`
            <Lens key=(test)>
                <Mark key=(illumination)><Default>dark</Default></Mark>
            </Lens>
        `)
        const lens2 = new StandardLens(`
            <Lens key=(test)>
                <Mark key=(illumination)><Default>light</Default></Mark>
            </Lens>
        `)
        const diff = lens1.diff(lens2)
        expect(diff).toBeDefined()
        const diffJSON = diff?.toJSON() as StandardLensData | undefined
        const diffMarks = diffJSON?.marks ?? []
        expect(diffMarks).toHaveLength(1)
        const [firstDiffMark] = diffMarks
        expect(firstDiffMark).toBeDefined()
        if (!firstDiffMark || 'tag' in firstDiffMark) {
            throw new Error('Expected plain mark facet data in Lens diff JSON')
        }
        const payload = firstDiffMark.payload
        const defaultValue = 'tag' in payload
            ? payload.tag === 'Replace'
                ? payload.payload.default
                : payload.match.default
            : payload.default
        expect(defaultValue).toBeDefined()
        if (typeof defaultValue === 'object' && defaultValue !== null && 'tag' in defaultValue) {
            expect(defaultValue).toMatchObject({ tag: 'Replace', match: 'dark', payload: 'light' })
        } else {
            expect(defaultValue).toEqual('light')
        }
    })

    it('should invert Lens Mark default correctly', () => {
        const lens = new StandardLens({
            key: 'test',
            tag: 'Lens',
            marks: [{ reference: { key: 'illumination', tag: 'Mark' }, payload: { default: 'light' } }],
        })
        const inverted = lens._payload.invert()
        const defaultPayload = inverted.marks.items[0].payload.default
        expect(defaultPayload).toBeDefined()
        const json = defaultPayload?.toJSON()
        expect(json).toBeDefined()
        if (typeof json === 'object' && json !== null && 'tag' in json) {
            expect(json).toMatchObject({ tag: 'Remove', match: 'light' })
        }
    })

})

describe('worldState equals semantic optionals', () => {
    it('treats undefined and semantic-empty description as equal on StandardMark', () => {
        const withoutDescription = new StandardMark({
            key: 'test',
            tag: 'Mark',
            shortName: 'Alpha',
        })
        const withEmptyDescription = new StandardMark({
            key: 'test',
            tag: 'Mark',
            shortName: 'Alpha',
            description: [],
        })
        expect(withoutDescription.equals(withEmptyDescription)).toBe(true)
        expect(withEmptyDescription.equals(withoutDescription)).toBe(true)
    })

    it('treats undefined and semantic-empty shortName as equal on StandardLens', () => {
        const withoutShortName = new StandardLens({
            key: 'test',
            tag: 'Lens',
            marks: [],
        })
        const withEmptyShortName = new StandardLens({
            key: 'test',
            tag: 'Lens',
            shortName: '',
            marks: [],
        })
        expect(withoutShortName.equals(withEmptyShortName)).toBe(true)
        expect(withEmptyShortName.equals(withoutShortName)).toBe(true)
    })
})
