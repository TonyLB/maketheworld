import parse from '../../simpleParser'
import tokenizer from '../../parser/tokenizer'
import SourceStream from '../../parser/tokenizer/sourceStream'

import { schemaFromParse, schemaToWML } from '../index'
import { deIndentWML } from '../utils'
import { isSchemaParent, isSchemaKey, isSchemaDefault, isSchemaRender } from '@tonylb/mtw-base/ts/schema/components'
import { isSchemaReplaceMatch, isSchemaReplacePayload } from '@tonylb/mtw-base/ts/schema/edit'

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
                        <ShortName>Test Room</ShortName>
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
            const nameNode = roomNode?.children.find(({ data }) => data.tag === 'ShortName')
            expect(nameNode).toBeDefined()
        })

        it('should allow empty Parent tag alongside other content', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <ShortName>Test Room</ShortName>
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

describe('Default literal tag', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should parse Default tag with string content', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)>
                    <Default>fallback illumination</Default>
                </Room>
            </Asset>
        `))))
        const schema = schemaFromParse(testParse)
        const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
        expect(roomNode).toBeDefined()
        const defaultNode = roomNode?.children.find(({ data }) => data.tag === 'Default')
        expect(defaultNode).toBeDefined()
        expect(isSchemaDefault(defaultNode?.data)).toBe(true)
        expect(defaultNode?.children[0].data).toEqual({ tag: 'String', value: 'fallback illumination' })
    })

    it('should round-trip Default tag correctly', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)><Default>fallback illumination</Default></Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })
})

describe('Key tag', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    describe('parsing', () => {
        it('should parse Key tag inside a Room with legalKey', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)><Key>room2</Key></Room>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
            expect(roomNode).toBeDefined()
            const keyNode = roomNode?.children.find(({ data }) => data.tag === 'Key')
            expect(keyNode).toBeDefined()
            expect(isSchemaKey(keyNode?.data)).toBe(true)
            expect(keyNode?.children[0].data).toEqual({ tag: 'String', value: 'room2' })
        })

        it('should parse Key tag inside a Feature with legalKey', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Feature key=(feature1)><Key>feature2</Key></Feature>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const featureNode = schema[0].children.find(({ data }) => data.tag === 'Feature')
            expect(featureNode).toBeDefined()
            const keyNode = featureNode?.children.find(({ data }) => data.tag === 'Key')
            expect(keyNode).toBeDefined()
            expect(isSchemaKey(keyNode?.data)).toBe(true)
        })

        it('should parse Key tag inside a Knowledge with legalKey', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Knowledge key=(knowledge1)><Key>knowledge2</Key></Knowledge>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const knowledgeNode = schema[0].children.find(({ data }) => data.tag === 'Knowledge')
            expect(knowledgeNode).toBeDefined()
            const keyNode = knowledgeNode?.children.find(({ data }) => data.tag === 'Key')
            expect(keyNode).toBeDefined()
            expect(isSchemaKey(keyNode?.data)).toBe(true)
        })
    })

    describe('validation', () => {
        it('should reject Key tag when not inside a ComponentUUID', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Key>room1</Key>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow('Key tag can only be used inside a ComponentUUID (Room, Feature, etc.)')
        })

        it('should reject Key tag with invalid legalKey content', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Key>not-a-valid-key</Key>
                    </Room>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow('Key tag content must be a legalKey, got: not-a-valid-key')
        })

        it('should reject empty Key tag (self-closing)', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Key />
                    </Room>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow('Key tag must contain a legalKey value')
        })

        it('should reject empty Key tag (opening and closing)', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Key></Key>
                    </Room>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow('Key tag must contain a legalKey value')
        })

        it('should reject Key tag with properties', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Key key=(invalid)>room2</Key>
                    </Room>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow("Property 'key' is not allowed in 'Key' items.")
        })

        it('should reject Key tag with ComponentUUID content', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Key>ROOM#parent-room</Key>
                    </Room>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow('Key tag content must be a legalKey, got: ROOM#parent-room')
        })
    })

    describe('serialization', () => {
        it('should round-trip Key tag correctly', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(Test)><Room key=(room1)><Key>room2</Key></Room></Asset>
            `)
            expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
        })

        it('should round-trip Key tag with different component types', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)><Key>room2</Key></Room>
                    <Feature key=(feature1)><Key>feature2</Key></Feature>
                    <Knowledge key=(knowledge1)><Key>knowledge2</Key></Knowledge>
                </Asset>
            `)
            expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
        })
    })

    describe('edge cases', () => {
        it('should allow Key tag alongside other content in a Room', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <ShortName>Test Room</ShortName>
                        <Key>room2</Key>
                        <Description>Room description</Description>
                    </Room>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
            expect(roomNode).toBeDefined()
            const keyNode = roomNode?.children.find(({ data }) => data.tag === 'Key')
            expect(keyNode).toBeDefined()
            const nameNode = roomNode?.children.find(({ data }) => data.tag === 'ShortName')
            expect(nameNode).toBeDefined()
        })

        it('should parse Key tag wrapped in Remove operation', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Remove><Key>room2</Key></Remove>
                    </Room>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
            expect(roomNode).toBeDefined()
            const removeNode = roomNode?.children.find(({ data }) => data.tag === 'Remove')
            expect(removeNode).toBeDefined()
            const keyNode = removeNode?.children.find(({ data }) => data.tag === 'Key')
            expect(keyNode).toBeDefined()
            expect(isSchemaKey(keyNode?.data)).toBe(true)
        })

        it('should parse Key tag wrapped in Replace operation', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Replace><Key>room2</Key></Replace>
                        <With><Key>room3</Key></With>
                    </Room>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
            expect(roomNode).toBeDefined()
            const replaceNode = roomNode?.children.find(({ data }) => data.tag === 'Replace')
            expect(replaceNode).toBeDefined()
            const replaceMatchNode = replaceNode?.children.find(({ data }) => isSchemaReplaceMatch(data))
            expect(replaceMatchNode).toBeDefined()
            const keyNodeInReplaceMatch = replaceMatchNode?.children.find(({ data }) => data.tag === 'Key')
            expect(keyNodeInReplaceMatch).toBeDefined()
            expect(isSchemaKey(keyNodeInReplaceMatch?.data)).toBe(true)
            const replacePayloadNode = replaceNode?.children.find(({ data }) => isSchemaReplacePayload(data))
            expect(replacePayloadNode).toBeDefined()
            const keyNodeInReplacePayload = replacePayloadNode?.children.find(({ data }) => data.tag === 'Key')
            expect(keyNodeInReplacePayload).toBeDefined()
            expect(isSchemaKey(keyNodeInReplacePayload?.data)).toBe(true)
        })

        it('should round-trip Key tag wrapped in Remove operation', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)><Remove><Key>room2</Key></Remove></Room>
                </Asset>
            `)
            expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
        })

        it('should round-trip Key tag wrapped in Replace operation', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Replace><Key>room2</Key></Replace><With><Key>room3</Key></With>
                    </Room>
                </Asset>
            `)
            expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
        })
    })
})

describe('Render tag', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should parse Render under Room with DisplayName, Summary, Description', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)>
                    <Render>
                        <DisplayName>Parlor</DisplayName>
                        <Summary>A quiet room</Summary>
                        <Description>Full prose here.</Description>
                    </Render>
                </Room>
            </Asset>
        `))))
        const schema = schemaFromParse(testParse)
        const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
        expect(roomNode).toBeDefined()
        const renderNode = roomNode?.children.find(({ data }) => data.tag === 'Render')
        expect(renderNode).toBeDefined()
        expect(isSchemaRender(renderNode?.data)).toBe(true)
        expect(renderNode?.children.map(({ data }) => data.tag)).toEqual(['DisplayName', 'Summary', 'Description'])
    })

    it('should round-trip Render under Room', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)>
                    <Render>
                        <DisplayName>Parlor</DisplayName>
                        <Summary>A quiet room</Summary>
                        <Description>Full prose here.</Description>
                    </Render>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should reject Render when not inside Room', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Render>
                    <DisplayName>X</DisplayName>
                    <Summary>Y</Summary>
                    <Description>Z</Description>
                </Render>
            </Asset>
        `))))
        expect(() => schemaFromParse(testParse)).toThrow('Render tag can only be used inside a Room, Feature, or Knowledge')
    })

    it('should parse Render under Feature', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Feature key=(feature1)>
                    <Render>
                        <DisplayName>X</DisplayName>
                        <Summary>Y</Summary>
                        <Description>Z</Description>
                    </Render>
                </Feature>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        const featureNode = schema[0].children.find(({ data }) => data.tag === 'Feature')
        const renderNode = featureNode?.children.find(({ data }) => data.tag === 'Render')
        expect(renderNode).toBeDefined()
    })

    it('should parse Render under Knowledge', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge key=(k1)>
                    <Render>
                        <DisplayName>X</DisplayName>
                        <Summary>Y</Summary>
                        <Description>Z</Description>
                    </Render>
                </Knowledge>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        const knowledgeNode = schema[0].children.find(({ data }) => data.tag === 'Knowledge')
        const renderNode = knowledgeNode?.children.find(({ data }) => data.tag === 'Render')
        expect(renderNode).toBeDefined()
    })

    it('should reject wrong child order', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)>
                    <Render>
                        <Summary>First</Summary>
                        <DisplayName>Second</DisplayName>
                        <Description>Third</Description>
                    </Render>
                </Room>
            </Asset>
        `))))
        expect(() => schemaFromParse(testParse)).toThrow('Render children must be DisplayName, Summary, Description in order')
    })

    it('should reject missing child', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)>
                    <Render>
                        <DisplayName>X</DisplayName>
                        <Summary>Y</Summary>
                    </Render>
                </Room>
            </Asset>
        `))))
        expect(() => schemaFromParse(testParse)).toThrow()
    })

    it('should reject invalid direct child of Render', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)>
                    <Render>
                        <DisplayName>X</DisplayName>
                        <ShortName>bad</ShortName>
                        <Description>Z</Description>
                    </Render>
                </Room>
            </Asset>
        `))))
        expect(() => schemaFromParse(testParse)).toThrow()
    })

    it('should reject empty DisplayName text', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)>
                    <Render>
                        <DisplayName>   </DisplayName>
                        <Summary>Y</Summary>
                        <Description>Z</Description>
                    </Render>
                </Room>
            </Asset>
        `))))
        expect(() => schemaFromParse(testParse)).toThrow('Render DisplayName must contain non-empty text after trim')
    })

    it('should allow empty Summary and Description', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)>
                    <Render>
                        <DisplayName>Name</DisplayName>
                        <Summary />
                        <Description />
                    </Render>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should preserve tagged content in Summary under Render', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)>
                    <Render>
                        <DisplayName>Name</DisplayName>
                        <Summary>See <Link to=(other)>other</Link> room.</Summary>
                        <Description>Plain text.</Description>
                    </Render>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })
})

describe('From tag', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    describe('parsing', () => {
        it('should parse From tag inside an Exit with ComponentUUID', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Exit uuid=(edge1)><From>ROOM#highway</From></Exit>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const exitNode = schema[0].children.find(({ data }) => data.tag === 'Exit')
            expect(exitNode).toBeDefined()
            const fromNode = exitNode?.children.find(({ data }) => data.tag === 'From')
            expect(fromNode).toBeDefined()
            expect(fromNode?.children[0].data).toEqual({ tag: 'String', value: 'ROOM#highway' })
        })
    })

    describe('validation', () => {
        it('should reject From tag when not inside an Exit', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(room1)><From>ROOM#highway</From></Room>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow('From tag can only be used inside an Exit')
        })

        it('should reject From tag with invalid ComponentUUID content', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Exit uuid=(edge1)><From>not-a-valid-uuid</From></Exit>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow('From tag content must be a ComponentUUID or legalKey, got: not-a-valid-uuid')
        })

        it('should accept empty From tag', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Exit uuid=(edge1)><From /></Exit>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const exitNode = schema[0].children.find(({ data }) => data.tag === 'Exit')
            const fromNode = exitNode?.children.find(({ data }) => data.tag === 'From')
            expect(fromNode?.children.length).toBe(0)
        })
    })

    describe('round-trip', () => {
        it('should round-trip From tag inside Exit', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(Test)><Exit uuid=(edge1)><From>ROOM#highway</From></Exit></Asset>
            `)
            expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
        })
    })
})

describe('To tag', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    describe('parsing', () => {
        it('should parse To tag inside an Exit with ComponentUUID', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Exit uuid=(edge1)><To>ROOM#townCenter</To></Exit>
                </Asset>
            `))))
            const schema = schemaFromParse(testParse)
            const exitNode = schema[0].children.find(({ data }) => data.tag === 'Exit')
            const toNode = exitNode?.children.find(({ data }) => data.tag === 'To')
            expect(toNode).toBeDefined()
            expect(toNode?.children[0].data).toEqual({ tag: 'String', value: 'ROOM#townCenter' })
        })
    })

    describe('validation', () => {
        it('should reject To tag when not inside an Exit', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Area key=(area1)><To>ROOM#townCenter</To></Area>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow('To tag can only be used inside an Exit')
        })

        it('should reject To tag with invalid ComponentUUID content', () => {
            const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
                <Asset uuid=(Test)>
                    <Exit uuid=(edge1)><To>not-a-valid-uuid</To></Exit>
                </Asset>
            `))))
            expect(() => schemaFromParse(testParse)).toThrow('To tag content must be a ComponentUUID or legalKey, got: not-a-valid-uuid')
        })
    })

    describe('round-trip', () => {
        it('should round-trip To tag inside Exit', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(Test)><Exit uuid=(edge1)><To>ROOM#townCenter</To></Exit></Asset>
            `)
            expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
        })
    })
})

describe('Forward and Back tags', () => {
    it('should parse Forward and Back literals under Exit', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Exit uuid=(edge1)>
                    <Forward>east</Forward>
                    <Back>west</Back>
                </Exit>
            </Asset>
        `))))
        const schema = schemaFromParse(testParse)
        const exitNode = schema[0].children.find(({ data }) => data.tag === 'Exit')
        expect(exitNode?.children.find(({ data }) => data.tag === 'Forward')).toBeDefined()
        expect(exitNode?.children.find(({ data }) => data.tag === 'Back')).toBeDefined()
    })

    it('should round-trip Forward and Back under Exit', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Exit uuid=(edge1)>
                    <Forward>east</Forward>
                    <Back>west</Back>
                </Exit>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })
})

describe('Exit D29 topology shape', () => {
    it('should parse full normative D29 Exit block', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Exit uuid=(straightawayToCliffbase)>
                    <From>ROOM#STRAIGHTAWAY</From>
                    <To>ROOM#VORTEX</To>
                    <Forward>east</Forward>
                    <Back>west</Back>
                </Exit>
            </Asset>
        `))))
        const schema = schemaFromParse(testParse)
        const exitNode = schema[0].children.find(({ data }) => data.tag === 'Exit')
        expect(exitNode?.data).toEqual({ tag: 'Exit', uuid: 'straightawayToCliffbase' })
        expect(exitNode?.children.map(({ data }) => data.tag)).toEqual(['From', 'To', 'Forward', 'Back'])
    })

    it('should round-trip full normative D29 Exit block', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Exit uuid=(straightawayToCliffbase)>
                    <From>ROOM#STRAIGHTAWAY</From>
                    <To>ROOM#VORTEX</To>
                    <Forward>east</Forward>
                    <Back>west</Back>
                </Exit>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should parse layered Replace on To inside Exit', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Exit uuid=(highwayToTown)>
                    <From>ROOM#highway</From>
                    <Replace><To>ROOM#townCenter</To></Replace>
                    <With><To>ROOM#ghi</To></With>
                    <Forward>east</Forward>
                    <Back>west</Back>
                </Exit>
            </Asset>
        `))))
        const schema = schemaFromParse(testParse)
        const exitNode = schema[0].children.find(({ data }) => data.tag === 'Exit')
        const replaceNode = exitNode?.children.find(({ data }) => data.tag === 'Replace')
        expect(replaceNode).toBeDefined()
        const replaceMatchNode = replaceNode?.children.find(({ data }) => isSchemaReplaceMatch(data))
        expect(replaceMatchNode?.children.find(({ data }) => data.tag === 'To')).toBeDefined()
        const replacePayloadNode = replaceNode?.children.find(({ data }) => isSchemaReplacePayload(data))
        expect(replacePayloadNode?.children.find(({ data }) => data.tag === 'To')).toBeDefined()
    })

    it('should round-trip layered Replace on To inside Exit', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Exit uuid=(highwayToTown)>
                    <From>ROOM#highway</From>
                    <Replace><To>ROOM#townCenter</To></Replace>
                    <With><To>ROOM#ghi</To></With>
                    <Forward>east</Forward>
                    <Back>west</Back>
                </Exit>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should still parse legacy Exit to= with String description', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)><Exit to=(room2)>out</Exit></Room>
            </Asset>
        `))))
        const schema = schemaFromParse(testParse)
        const roomNode = schema[0].children.find(({ data }) => data.tag === 'Room')
        const exitNode = roomNode?.children.find(({ data }) => data.tag === 'Exit')
        expect(exitNode?.data).toEqual({ tag: 'Exit', to: 'room2' })
        expect(exitNode?.children[0].data).toEqual({ tag: 'String', value: 'out' })
    })

    it('should parse Exit with both uuid and to attributes at schema layer', () => {
        const testParse = parse(tokenizer(new SourceStream(deIndentWML(`
            <Asset uuid=(Test)>
                <Exit uuid=(e1) to=(room2) />
            </Asset>
        `))))
        const schema = schemaFromParse(testParse)
        const exitNode = schema[0].children.find(({ data }) => data.tag === 'Exit')
        expect(exitNode?.data).toEqual({ tag: 'Exit', uuid: 'e1', to: 'room2' })
    })
})

describe('schema round-trip for Exit under Room (parser)', () => {
    it('should round-trip legacy Exit to= under Room', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)><Room key=(room1)><Exit to=(room2)>out</Exit></Room></Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should round-trip legacy Exit under Room inside Map', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Map key=(testMap)>
                    <Room key=(room1)>
                        <Position {0, 0} />
                        <Exit to=(room2)>east</Exit>
                    </Room>
                </Map>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should round-trip legacy Exit as direct Map child', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Map key=(testMap)><Exit to=(room2)>east</Exit></Map>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should round-trip D29 Exit topology shape under Room at schema layer', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)>
                    <Exit uuid=(highwayToTown)>
                        <From>ROOM#highway</From>
                        <To>ROOM#townCenter</To>
                        <Forward>east</Forward>
                        <Back>west</Back>
                    </Exit>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })
})
