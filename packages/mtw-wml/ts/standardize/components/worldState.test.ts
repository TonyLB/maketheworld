import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardMarkData } from "./dataTypes/mark"
import StandardMark from './worldState'
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
        expect(wml).toContain('<Mark key=(test)>')
        expect(wml).toContain('<ShortName>Test Mark</ShortName>')
        expect(wml).toContain('<Description>Test description.</Description>')
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
            description: [{
                data: { tag: 'Replace' },
                children: [
                    { data: { tag: 'ReplaceMatch' }, children: ['Original description.'] },
                    { data: { tag: 'ReplacePayload' }, children: ['Changed description.'] }
                ]
            }]
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
            description: [{ data: { tag: 'Remove' }, children: ['Test description.'] }]
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
            description: [{
                data: { tag: 'Replace' },
                children: [
                    { data: { tag: 'ReplaceMatch' }, children: ['Test'] },
                    { data: { tag: 'ReplacePayload' }, children: ['Changed'] }
                ]
            }]
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
        expect(inverted.description?.toJSON()).toEqual([{ data: { tag: 'Remove' }, children: ['Test description.'] }])
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

})
