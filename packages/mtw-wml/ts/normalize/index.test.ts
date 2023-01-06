import {
    NormalizeTagMismatchError,
} from './baseClasses'
import { clearGeneratedKeys } from './keyUtil'
import Normalizer from '.'
import { schemaFromParse } from '../schema'
import parse from '../parser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import { isSchemaBookmark, isSchemaFeature, isSchemaMessage, isSchemaRoom, isSchemaWithContents, SchemaBookmarkTag, SchemaFeatureTag, SchemaMessageTag, SchemaRoomTag, SchemaTag } from '../schema/baseClasses'

const removeParseFromSchema = (nodes: SchemaTag[]): SchemaTag[] => {
    return nodes.map((node) => {
        if (isSchemaRoom(node)) {
            const { parse, ...rest } = node
            return {
                ...rest,
                contents: removeParseFromSchema(rest.contents),
                render: removeParseFromSchema(rest.render),
                name: removeParseFromSchema(rest.name)
            } as SchemaRoomTag
        }
        if (isSchemaFeature(node)) {
            const { parse, ...rest } = node
            return {
                ...rest,
                contents: removeParseFromSchema(rest.contents),
                render: removeParseFromSchema(rest.render),
                name: removeParseFromSchema(rest.name)
            } as SchemaFeatureTag
        }
        if (isSchemaMessage(node)) {
            const { parse, ...rest } = node
            return {
                ...rest,
                render: removeParseFromSchema(rest.render),
                contents: removeParseFromSchema(rest.contents)
            } as SchemaMessageTag
        }
        if (isSchemaWithContents(node)) {
            const { parse, ...rest } = node
            return {
                ...rest,
                contents: removeParseFromSchema(rest.contents)
            } as SchemaTag
        }
        const { parse, ...rest } = node
        return rest
    })
}

describe('WML normalize', () => {

    beforeEach(() => {
        clearGeneratedKeys()
    })

    it('should return empty map on empty schema', () => {
        expect((new Normalizer()).normal).toEqual({})
    })

    it('should normalize every needed tag', () => {
        const testSource = `<Asset key=(Test) fileName="Test" >
            <Import from=(BASE)>
                <Use key=(basePower) as=(power) type="Variable" />
                <Use key=(overview) type="Room" />
            </Import>
            <Room key=(a123)>
                <Exit to=(b456) />
                <Feature key=(clockTower) />
            </Room>
            <Room key=(b456) />
            <Map key=(TestMap)>
                <Image key=(ImageTest) />
                <Room key=(a123) x="200" y="150" />
            </Map>
            <Feature key=(clockTower)>
                <Name>Clock Tower</Name>
            </Feature>
            <Variable key=(active) default={true} />
            <Computed key=(inactive) src={!active} />
            <Action key=(toggleActive) src={active = !active} />
            <Bookmark key=(postFix)><Space />Inactive</Bookmark>
            <Moment key=(activateMoment)>
                <Message key=(activate)>
                    <Room key=(a123) />
                    It activates!
                </Message>
            </Moment>
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.put(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should normalize a character', () => {
        const testSource = `<Character key=(Tess) fileName="test">
            <Name>Tess</Name>
            <FirstImpression>Frumpy goth</FirstImpression>
            <Pronouns
                subject="she"
                object="her"
                possessive="her"
                adjective="hers"
                reflexive="herself"
            />
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A battered frock-coat</Outfit>
        </Character>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.put(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should accumulate multiple appearances of the same key', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Name>Vortex</Name>
            </Room>
            <Room key=(a123)>
                <Description>
                    Hello, world!<Space />
                </Description>
            </Room>
            <If {true}>
                <Room key=(a123)>
                    <Description>
                        Vortex!
                    </Description>
                </Room>
            </If>
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.put(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()

    })

    it('should denormalize condition dependencies into contextStack', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Name>Vortex</Name>
                <Description>
                    Hello, world!
                </Description>
            </Room>
            <If {strong}>
                <Room key=(a123)>
                    <Description>
                        Vortex!
                    </Description>
                </Room>
            </If>
            <Variable key=(strong) default={false} />
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.put(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()

    })

    it('should correctly handle multiple and nested conditionals', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Name>Vortex</Name>
                <Description>
                    Hello, world!
                </Description>
            </Room>
            <If {strong}>
                <Room key=(a123)>
                    <Description>
                        Vortex!
                    </Description>
                </Room>
            </If>
            <If {!strong}>
                <If {trendy}>
                    <Room key=(a123)>
                        <Description>
                            V.O.R.T.E.X.
                        </Description>
                    </Room>
                </If>
            </If>
            <Variable key=(strong) default={false} />
            <Variable key=(trendy) default={false} />
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.put(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()

    })

    it('should correctly handle conditionals in message text', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Name>Vortex</Name>
                <Description>
                    Hello, world!<If {strong}> Vortex!</If>
                    <If {!strong}>
                        <If {trendy}>
                            V.O.R.T.E.X.
                        </If>
                    </If>
                </Description>
            </Room>
            <Variable key=(strong) default={false} />
            <Variable key=(trendy) default={false} />
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.put(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()

    })

    it('should correctly serialize multiple unconditioned descriptions', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(test)>
                <Description>
                    One
                </Description>
            </Room>
            <Room key=(test)>
                <Description>
                    Two
                </Description>
            </Room>
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.put(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should throw an error on mismatched key use', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(ABC)>
                <Name>Vortex</Name>
                <Description>
                    Hello, world!
                </Description>
            </Room>
            <Variable key=(ABC) default={true} />
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        expect(() => { normalizer.put(testAsset[0], { contextStack: [], location: [0] }) }).toThrowError(new NormalizeTagMismatchError(`Key 'ABC' is used to define elements of different tags ('Room' and 'Variable')`))
    })

    it('should correctly round-trip from schema to normalize and back', () => {
        const testSource = `<Asset key=(Test) fileName="Test" >
            <Import from=(BASE)>
                <Use key=(basePower) as=(power) type="Variable" />
                <Use key=(overview) type="Room" />
            </Import>
            <Room key=(a123)>
                <Feature key=(clockTower) />
                <Exit to=(b456) />
            </Room>
            <Map key=(TestMap)>
                <Room key=(a123) x="200" y="150" />
                <Image key=(ImageTest) />
            </Map>
            <Feature key=(clockTower)>
                <Name>Clock Tower</Name>
            </Feature>
            <Variable key=(active) default={true} />
            <Computed key=(inactive) src={!active} />
            <Action key=(toggleActive) src={active = !active} />
            <Bookmark key=(postFix)><Space />Inactive</Bookmark>
            <Moment key=(activateMoment)>
                <Message key=(activate)>
                    <Room key=(a123) />
                    It activates!
                </Message>
            </Moment>
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.put(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.schema).toEqual(removeParseFromSchema(testAsset))
    })

    describe('put method', () => {
        it('should add an item in contents', () => {
            const testSource = `<Asset key=(TestAsset) fileName="Test">
                <Room key=(test)>
                    <Description>
                        One
                    </Description>
                </Room>
                <Room key=(test)>
                    <Description>
                        Two
                    </Description>
                </Room>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], location: [0] })
            //
            // TODO: Refactor put arguments to allow:
            //    (a) specifying the item into the contents of which the element should be added/put
            //    (b) specifying an optional index in the contents order at which to put
            //    (c) specifying whether the put should insert or overwrite
            //
            normalizer.put(
                { tag: 'Name' as 'Name', contents: [{ tag: 'String', value: 'TestName' }] },
                {
                    contextStack: [
                        { tag: 'Asset', key: 'TestAsset', index: 0 },
                        { tag: 'Room', key: 'test', index: 0 }
                    ],
                    location: [0, 0]
                }
            )
            expect(normalizer.normal).toMatchSnapshot()
        })
        
    })

    describe('delete method', () => {
        it('should remove a single appearance', () => {
            const testSource = `<Asset key=(Test) fileName="Test">
                <Room key=(test)>
                    <Description>
                        One
                    </Description>
                </Room>
                <Room key=(test)>
                    <Description>
                        Two
                    </Description>
                </Room>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], location: [0] })
            normalizer.delete({ key: 'test', index: 1, tag: 'Room' })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should remove the entire element on removing last appearance', () => {
            const testSource = `<Asset key=(Test) fileName="Test">
                <Room key=(test)>
                    <Description>
                        One
                    </Description>
                </Room>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], location: [0] })
            normalizer.delete({ key: 'test', index: 0, tag: 'Room' })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should cascade deletes when removing an appearance with contents', () => {
            const testSource = `<Asset key=(Test) fileName="Test">
                <Variable key=(testVar) default={false} />
                <Room key=(testOne)>
                    <Description>
                        One
                    </Description>
                </Room>
                <Room key=(testOne)>
                    <If {testVar}><Exit to=(testTwo)>go</Exit></If>
                </Room>
                <Room key=(testTwo) />
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], location: [0] })
            normalizer.delete({ key: 'testOne', index: 1, tag: 'Room' })
            expect(normalizer.normal).toMatchSnapshot()
        })
    })
})