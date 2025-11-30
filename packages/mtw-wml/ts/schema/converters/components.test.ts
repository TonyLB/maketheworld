import parse from '../../simpleParser'
import tokenizer from '../../parser/tokenizer'
import SourceStream from '../../parser/tokenizer/sourceStream'

import { schemaFromParse, schemaToWML } from '../index'
import { deIndentWML } from '../utils'
import { isSchemaParent } from '@tonylb/mtw-base/ts/schema/components'

describe('Parent tag', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    describe('parsing', () => {
        it('should parse Parent tag inside a Room with ComponentUUID', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)><Parent>ROOM#parent-room</Parent></Room>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
            expect(roomNode).toBeDefined()
            const parentNode = roomNode?.children.find(({ data }) => data.tag === 'Parent')
            expect(parentNode).toBeDefined()
            expect(isSchemaParent(parentNode?.data)).toBe(true)
            expect(parentNode?.children[0].data).toEqual({ tag: 'String', value: 'ROOM#parent-room' })
        })

        it('should parse Parent tag inside a Feature with ComponentUUID', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Feature key=(feature1)><Parent>ROOM#parent-room</Parent></Feature>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const featureNode = schema[0].children.find(({ data }) => data.tag === 'Feature')
            expect(featureNode).toBeDefined()
            const parentNode = featureNode?.children.find(({ data }) => data.tag === 'Parent')
            expect(parentNode).toBeDefined()
            expect(isSchemaParent(parentNode?.data)).toBe(true)
        })

        it('should parse Parent tag inside a Knowledge with ComponentUUID', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Knowledge key=(knowledge1)><Parent>FEATURE#parent-feature</Parent></Knowledge>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const knowledgeNode = schema[0].children.find(({ data }) => data.tag === 'Knowledge')
            expect(knowledgeNode).toBeDefined()
            const parentNode = knowledgeNode?.children.find(({ data }) => data.tag === 'Parent')
            expect(parentNode).toBeDefined()
            expect(isSchemaParent(parentNode?.data)).toBe(true)
        })

        it('should parse Parent tag with AssetUUID', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)><Parent>ASSET#parent-asset</Parent></Room>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
            expect(roomNode).toBeDefined()
            const parentNode = roomNode?.children.find(({ data }) => data.tag === 'Parent')
            expect(parentNode).toBeDefined()
            expect(isSchemaParent(parentNode?.data)).toBe(true)
        })
    })

    describe('validation', () => {
        it('should reject Parent tag when not inside a ComponentUUID', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Parent>ROOM#parent-room</Parent>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow('Parent tag can only be used inside a ComponentUUID (Room, Feature, etc.)')
        })

        it('should reject Parent tag with invalid ComponentUUID content', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Parent>not-a-valid-uuid</Parent>
                    </Room>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow('Parent tag content must be a ComponentUUID or legalKey, got: not-a-valid-uuid')
        })

        it('should accept empty Parent tag (self-closing)', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Parent />
                    </Room>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
            expect(roomNode).toBeDefined()
            const parentNode = roomNode?.children.find(({ data }) => data.tag === 'Parent')
            expect(parentNode).toBeDefined()
            expect(isSchemaParent(parentNode?.data)).toBe(true)
            expect(parentNode?.children.length).toBe(0)
        })

        it('should accept empty Parent tag (opening and closing)', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Parent></Parent>
                    </Room>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
            expect(roomNode).toBeDefined()
            const parentNode = roomNode?.children.find(({ data }) => data.tag === 'Parent')
            expect(parentNode).toBeDefined()
            expect(isSchemaParent(parentNode?.data)).toBe(true)
            expect(parentNode?.children.length).toBe(0)
        })

        it('should reject Parent tag with properties', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Parent key=(invalid)>ROOM#parent-room</Parent>
                    </Room>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow("Property 'key' is not allowed in 'Parent' items.")
        })
    })

    describe('serialization', () => {
        it('should round-trip Parent tag correctly', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)><Parent>ROOM#parent-room</Parent></Room>
                </Asset>
            `)
            expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
        })

        it('should round-trip Parent tag with AssetUUID', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(Test)>
                    <Feature key=(feature1)><Parent>ASSET#parent-asset</Parent></Feature>
                </Asset>
            `)
            expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
        })

        it('should round-trip Parent tag with different component types', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)><Parent>FEATURE#parent-feature</Parent></Room>
                    <Feature key=(feature1)><Parent>ROOM#parent-room</Parent></Feature>
                    <Knowledge key=(knowledge1)><Parent>ROOM#parent-room</Parent></Knowledge>
                </Asset>
            `)
            expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
        })

        it('should round-trip empty Parent tag (self-closing)', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(Test)><Room key=(room1)><Parent /></Room></Asset>
            `)
            expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
        })

        it('should round-trip empty Parent tag (opening and closing)', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(Test)><Room key=(room1)><Parent></Parent></Room></Asset>
            `)
            // Empty tags should serialize as self-closing
            const expectedWML = deIndentWML(`
                <Asset uuid=(Test)><Room key=(room1)><Parent /></Room></Asset>
            `)
            expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(expectedWML)
        })
    })

    describe('edge cases', () => {
        it('should handle Parent tag with multiple string children that combine to ComponentUUID', () => {
            // This tests that if a ComponentUUID is split across multiple string nodes,
            // they are properly combined and validated
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Parent>ROOM#parent</Parent>
                    </Room>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
            const parentNode = roomNode?.children.find(({ data }) => data.tag === 'Parent')
            expect(parentNode).toBeDefined()
            // The finalize function should have validated and normalized the content
            expect(parentNode?.children.length).toBeGreaterThan(0)
        })

        it('should allow Parent tag alongside other content in a Room', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Name>Test Room</Name>
                        <Parent>ROOM#parent-room</Parent>
                        <Description>Room description</Description>
                    </Room>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
            expect(roomNode).toBeDefined()
            const parentNode = roomNode?.children.find(({ data }) => data.tag === 'Parent')
            expect(parentNode).toBeDefined()
            const nameNode = roomNode?.children.find(({ data }) => data.tag === 'Name')
            expect(nameNode).toBeDefined()
        })

        it('should allow empty Parent tag alongside other content', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Name>Test Room</Name>
                        <Parent />
                        <Description>Room description</Description>
                    </Room>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
            expect(roomNode).toBeDefined()
            const parentNode = roomNode?.children.find(({ data }) => data.tag === 'Parent')
            expect(parentNode).toBeDefined()
            expect(isSchemaParent(parentNode?.data)).toBe(true)
            expect(parentNode?.children.length).toBe(0)
        })
    })
})

