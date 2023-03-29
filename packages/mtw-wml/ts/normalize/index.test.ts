import {
    NormalizeTagMismatchError,
} from './baseClasses'
import { clearGeneratedKeys } from './keyUtil'
import Normalizer from '.'
import { schemaFromParse } from '../schema'
import parse from '../parser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import { isSchemaCondition, isSchemaExit, isSchemaFeature, isSchemaImport, isSchemaMessage, isSchemaRoom, isSchemaWithContents, SchemaBookmarkTag, SchemaFeatureTag, SchemaMessageTag, SchemaRoomTag, SchemaTag } from '../schema/baseClasses'

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
                <Name>Test Map</Name>
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
        normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
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
            <Import from=(base) />
        </Character>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
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
        normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
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
        normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
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
        normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
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
        normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
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
        normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
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
        expect(() => { normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false }) }).toThrowError(new NormalizeTagMismatchError(`Key 'ABC' is used to define elements of different tags ('Room' and 'Variable')`))
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
                <Name>Test Map</Name>
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
        normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
        expect(normalizer.schema).toEqual(testAsset)
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
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
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
                    index: 0,
                    replace: false
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
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
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
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
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
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            normalizer.delete({ key: 'testOne', index: 1, tag: 'Room' })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should rename synthetic keys to fill in gaps for deleted conditionals', () => {
            const testSource = `<Asset key=(Test) fileName="Test">
                <Variable key=(testVarOne) default={false} />
                <Variable key=(testVarTwo) default={false} />
                <Variable key=(testVarThree) default={false} />
                <If {testVarOne}>
                    <Room key=(testOne)>
                        <Description>
                            One
                        </Description>
                    </Room>
                </If>
                <If {testVarTwo}>
                    <Room key=(testOne)>
                        <Description>
                            Two
                        </Description>
                    </Room>
                </If>
                <If {testVarThree}>
                    <Room key=(testOne)>
                        <Description>
                            Three
                        </Description>
                    </Room>
                </If>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            normalizer.delete({ key: 'If-1', index: 0, tag: 'If' })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should delete empty parent conditions', () => {
            const testSource = `<Asset key=(TestAsset) fileName="Test">
                <Variable key=(testVar) default={false} />
                <If {testVar}>
                    <Room key=(testRoom)>
                        <Description>
                            One
                        </Description>
                    </Room>
                </If>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            normalizer.delete({ key: 'testRoom', index: 0, tag: 'Room' })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should delete an import', () => {
            const testSource = `<Asset key=(TestAsset) fileName="Test">
                <Import from=(base)>
                    <Use type="Room" key=(testOne) />
                </Import>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            normalizer.delete({ key: 'Import-0', index: 0, tag: 'Import' })
            expect(normalizer.normal).toMatchSnapshot()
        })
    })

    describe('positioned put method', () => {
        it('should add an item between two others', () => {
            const testSource = `<Asset key=(Test) fileName="Test">
                <Room key=(test)>
                    <Description>
                        One
                    </Description>
                </Room>
                <Room key=(test)>
                    <Description>
                        Three
                    </Description>
                </Room>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            const toAddSource = `<Room key=(test)><Description>Two</Description></Room>`
            const toAddAsset = schemaFromParse(parse(tokenizer(new SourceStream(toAddSource))))
            normalizer.put(toAddAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: false })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should correctly reorder when added item is nested', () => {
            const testSource = `<Asset key=(Test) fileName="Test">
                <Room key=(test)>
                    <Description>
                        One
                    </Description>
                </Room>
                <Room key=(test)>
                    <Description>
                        Three
                    </Description>
                </Room>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            const toAddSource = `<Map key=(testMap)><Room key=(test) x="0" y="0"><Description>Two</Description></Room></Map>`
            const toAddAsset = schemaFromParse(parse(tokenizer(new SourceStream(toAddSource))))
            normalizer.put(toAddAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: false })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should update an item in place', () => {
            const testSource = `<Asset key=(Test) fileName="Test">
                <Room key=(test)>
                    <Description>
                        Uno
                    </Description>
                </Room>
                <Room key=(test)>
                    <Description>
                        Two
                    </Description>
                </Room>
                <Room key=(test)>
                    <Description>
                        Tres
                    </Description>
                </Room>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            const toUpdateSource = `<Room key=(test)><Description>Dos</Description></Room>`
            const toUpdateAsset = schemaFromParse(parse(tokenizer(new SourceStream(toUpdateSource))))
            normalizer.put(toUpdateAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should replace an item with a different item', () => {
            const testSource = `<Asset key=(Test) fileName="Test">
                <Room key=(test)>
                    <Description>
                        One
                    </Description>
                </Room>
                <Room key=(test)>
                    <Description>
                        Foo
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
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            const toUpdateSource = `<Room key=(testTwo)><Description>Bar</Description></Room>`
            const toUpdateAsset = schemaFromParse(parse(tokenizer(new SourceStream(toUpdateSource))))
            normalizer.put(toUpdateAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should replace an item with a nest that includes the item', () => {
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
                <Room key=(test)>
                    <Description>
                        Three
                    </Description>
                </Room>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            const toUpdateSource = `<Map key=(testMap)><Room key=(test) x="0" y="0"><Description>Two</Description></Room></Map>`
            const toUpdateAsset = schemaFromParse(parse(tokenizer(new SourceStream(toUpdateSource))))
            normalizer.put(toUpdateAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should replace a nest that includes an item with the item itself', () => {
            const testSource = `<Asset key=(Test) fileName="Test">
                <Room key=(test)>
                    <Description>
                        One
                    </Description>
                </Room>
                <Map key=(testMap)>
                    <Room key=(test) x="0" y="0">
                        <Description>
                            Two
                        </Description>
                    </Room>
                </Map>
                <Room key=(test)>
                    <Description>
                        Three
                    </Description>
                </Room>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            const toUpdateSource = `<Room key=(test)><Description>Two</Description></Room>`
            const toUpdateAsset = schemaFromParse(parse(tokenizer(new SourceStream(toUpdateSource))))
            normalizer.put(toUpdateAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should replace a top level character item', () => {
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
            const testCharacter = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testCharacter[0], { contextStack: [], index: 0, replace: false })
            const toUpdateSource = `<Character key=(Tess) fileName="test">
                <Name>Tessa</Name>
                <FirstImpression>Frumpy goth</FirstImpression>
                <Pronouns
                    subject="she"
                    object="her"
                    possessive="her"
                    adjective="hers"
                    reflexive="herself"
                />
                <OneCoolThing>Thousand yard stare</OneCoolThing>
                <Outfit>A battered frock-coat</Outfit>
            </Character>`
            const toUpdateCharacter = schemaFromParse(parse(tokenizer(new SourceStream(toUpdateSource))))
            normalizer.put(toUpdateCharacter[0], { contextStack: [], index: 0, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should replace nested internal conditions', () => {
            const testSource = `<Asset key=(Test) fileName="Test">
                <Map key=(testMap)>
                    <Room key=(test) x="0" y="0" />
                    <If {true}>
                        <Room key=(testTwo) x="100" y="0" />
                    </If>
                </Map>
                <If {true}>
                    <Map key=(testMap)>
                        <Room key=(testThree) x="-100" y="0" />
                    </Map>
                </If>
            </Asset>`
            const normalizer = new Normalizer()
            const testCharacter = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testCharacter[0], { contextStack: [], index: 0, replace: false })
            const toUpdateSource = `<Map key=(testMap)>
                <Room key=(test) x="0" y="100">
                    <Description>
                        One
                    </Description>
                </Room>
                <If {true}>
                    <Room key=(testTwo) x="100" y="0">
                        <Description>
                            Two
                        </Description>
                    </Room>
                </If>
            </Map>`
            const toUpdateAsset = schemaFromParse(parse(tokenizer(new SourceStream(toUpdateSource))))
            normalizer.put(toUpdateAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 0, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should recalculate Map rooms property on contents update', () => {
            const testSource = `<Asset key=(Test) fileName="Test">
                <Map key=(testMap)>
                    <Room key=(test) x="0" y="0" />
                </Map>
            </Asset>`
            const normalizer = new Normalizer()
            const testCharacter = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testCharacter[0], { contextStack: [], index: 0, replace: false })
            const toAddSource = `<Room key=(testTwo) x="0" y="100" />`
            const toAddAsset = schemaFromParse(parse(tokenizer(new SourceStream(toAddSource))))
            normalizer.put(toAddAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'testMap', tag: 'Map', index: 0 }] })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should successfully put a duplicate item', () => {
            const testSource = `<Asset key=(TestAsset) fileName="Test">
                <Variable key=(testVar) default={false} />
                <Room key=(testRoom)>
                    <If {testVar} />
                    <If {testVar}><Exit to=(targetTwo)>two</Exit></If>
                </Room>
                <Room key=(targetOne) />
                <Room key=(targetTwo) />
                <Room key=(targetThree) />
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            const toAddSource = `<Room key=(testRoom)><If {testVar}><Exit to=(targetThree)>three</Exit></If></Room>`
            const toAddAsset = schemaFromParse(parse(tokenizer(new SourceStream(toAddSource))))
            const toAddRoomWrapper = toAddAsset[0]
            if (!isSchemaRoom(toAddRoomWrapper)) {
                throw new Error()
            }
            const ifPredicate = toAddRoomWrapper.contents[0]
            if (!isSchemaCondition(ifPredicate)) {
                throw new Error()
            }
            const { key, ...unkeyedIf } = ifPredicate
            normalizer.put(unkeyedIf, { contextStack: [{ key: 'TestAsset', tag: 'Asset', index: 0 }, { key: 'testRoom', tag: 'Room', index: 0 }], index: 2 })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should successfully replace a parent with duplicate contents', () => {
            const testSource = `<Asset key=(TestAsset) fileName="Test">
                <Variable key=(testVar) default={false} />
                <Room key=(testRoom)>
                    <If {testVar} />
                    <If {testVar}><Exit to=(targetTwo)>two</Exit></If>
                </Room>
                <Room key=(targetOne) />
                <Room key=(targetTwo) />
                <Room key=(targetThree) />
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            const toAddSource = `<Room key=(testRoom)>
                <If {testVar} />
                <If {testVar}><Exit to=(targetTwo)>two</Exit></If>
                <If {testVar}><Exit to=(targetThree)>three</Exit></If>
            </Room>`
            const toAddAsset = schemaFromParse(parse(tokenizer(new SourceStream(toAddSource))))
            const toAddRoomWrapper = toAddAsset[0]
            if (!isSchemaRoom(toAddRoomWrapper)) {
                throw new Error()
            }
            normalizer.put(toAddRoomWrapper, { contextStack: [{ key: 'TestAsset', tag: 'Asset', index: 0 }], index: 1, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should successfully extend an import in place', () => {
            const testSource = `<Asset key=(TestAsset) fileName="Test">
                <Import from=(base)>
                    <Use type="Room" key=(testOne) />
                </Import>
            </Asset>`
            const normalizer = new Normalizer()
            const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
            normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
            const toReplaceSource = `<Import from=(base)>
                <Use type="Room" key=(testOne) />
                <Use type="Room" key=(testTwo) />
            </Import>`
            const toReplaceAsset = schemaFromParse(parse(tokenizer(new SourceStream(toReplaceSource))))
            const toReplaceWrapper = toReplaceAsset[0]
            if (!isSchemaImport(toReplaceWrapper)) {
                throw new Error()
            }
            normalizer.put(toReplaceWrapper, { contextStack: [{ key: 'TestAsset', tag: 'Asset', index: 0 }], index: 0, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

    })

})