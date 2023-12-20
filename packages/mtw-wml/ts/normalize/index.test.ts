import {
    NormalizeTagMismatchError,
} from './baseClasses'
import { clearGeneratedKeys } from './keyUtil'
import Normalizer from '.'
import { schemaFromParse, schemaToWML } from '../simpleSchema'
import parse from '../simpleParser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import { isSchemaCondition, isSchemaImport, isSchemaRoom, SchemaTag } from '../simpleSchema/baseClasses'
import { deIndentWML } from '../simpleSchema/utils'

describe('WML normalize', () => {

    beforeEach(() => {
        clearGeneratedKeys()
    })

    it('should return empty map on empty schema', () => {
        expect((new Normalizer()).normal).toEqual({})
    })

    it('should normalize every needed tag', () => {
        const testSource = `<Asset key=(Test)>
            <Import from=(BASE)>
                <Variable key=(power) from=(basePower) />
                <Room key=(overview) />
                <Knowledge key=(baseInfo) />
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
            <Knowledge key=(town)>
                <Name>Waverly</Name>
                <Description>The town of Waverly is a pleasant place to live.</Description>
            </Knowledge>
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
        normalizer.loadWML(testSource)
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should normalize all types of links', () => {
        const testSource = `<Asset key=(Test)>
            <Feature key=(clockTower)>
                <Name>Clock Tower</Name>
                <Description>
                    <Link to=(town)>Waverly</Link>
                    <Link to=(clockTower)>Clock</Link>
                    <Link to=(toggleActive)>Toggle</Link>
                </Description>
            </Feature>
            <Knowledge key=(town)>
                <Name>Waverly</Name>
                <Description>The town of Waverly is a pleasant place to live.</Description>
            </Knowledge>
            <Variable key=(active) default={true} />
            <Action key=(toggleActive) src={active = !active} />
        </Asset>`
        const normalizer = new Normalizer()
        normalizer.loadWML(testSource)
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should normalize a character', () => {
        const testSource = `<Character key=(Tess)>
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
        normalizer.loadWML(testSource)
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should accumulate multiple appearances of the same key', () => {
        const testSource = `<Asset key=(Test)>
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
        normalizer.loadWML(testSource)
        expect(normalizer.normal).toMatchSnapshot()

    })

    it('should denormalize condition dependencies into contextStack', () => {
        const testSource = `<Asset key=(Test)>
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
        normalizer.loadWML(testSource)
        expect(normalizer.normal).toMatchSnapshot()

    })

    it('should correctly handle multiple and nested conditionals', () => {
        const testSource = `<Asset key=(Test)>
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
        normalizer.loadWML(testSource)
        expect(normalizer.normal).toMatchSnapshot()

    })

    it('should correctly handle conditionals in message text', () => {
        const testSource = `<Asset key=(Test)>
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
        normalizer.loadWML(testSource)
        expect(normalizer.normal).toMatchSnapshot()

    })

    it('should correctly serialize multiple unconditioned descriptions', () => {
        const testSource = `<Asset key=(Test)>
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
        normalizer.loadWML(testSource)
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should throw an error on mismatched key use', () => {
        const testSource = `<Asset key=(Test)>
            <Room key=(ABC)>
                <Name>Vortex</Name>
                <Description>
                    Hello, world!
                </Description>
            </Room>
            <Variable key=(ABC) default={true} />
        </Asset>`
        const normalizer = new Normalizer()
        expect(() => { normalizer.loadWML(testSource) }).toThrowError(new NormalizeTagMismatchError(`Key 'ABC' is used to define elements of different tags ('Room' and 'Variable')`))
    })

    it('should correctly round-trip from schema to normalize and back', () => {
        const testSource = `<Asset key=(Test)>
            <Import from=(BASE)>
                <Variable key=(power) from=(basePower) />
                <Room key=(overview) />
                <Knowledge key=(baseInfo) />
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
            <Knowledge key=(learning)>
                <Name>Knowledge is power</Name>
                <Description>There is so much to learn!</Description>
            </Knowledge>
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
            <Export><Room key=(a123) as=(Room2) /></Export>
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
        expect(normalizer.schema).toEqual(testAsset)
    })

    describe('renameItem method', () => {
        it('should correctly rename an item', () => {
            const testSource = deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(test)>
                        <Description>One</Description>
                    </Room>
                    <Variable key=(testVar) default={false} />
                    <If {testVar}>
                        <Room key=(test)>
                            <Description>: Suffix</Description>
                        </Room>
                    </If>
                </Asset>
            `)
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.renameItem('test', 'renamed')
            expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(renamed)><Description>One</Description></Room>
                    <Variable key=(testVar) default={false} />
                    <If {testVar}>
                        <Room key=(renamed)><Description>: Suffix</Description></Room>
                    </If>
                </Asset>
            `))
        })

        it('should correctly update export when option specified', () => {
            const testSource = deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(test)>
                        <Description>One</Description>
                    </Room>
                    <Variable key=(testVar) default={false} />
                    <If {testVar}>
                        <Room key=(test)>
                            <Description>: Suffix</Description>
                        </Room>
                    </If>
                </Asset>
            `)
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.renameItem('test', 'renamed', { updateExports: true })
            expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(renamed)><Description>One</Description></Room>
                    <Variable key=(testVar) default={false} />
                    <If {testVar}>
                        <Room key=(renamed)><Description>: Suffix</Description></Room>
                    </If>
                    <Export><Room key=(renamed) as=(test) /></Export>
                </Asset>
            `))
        })

        it('should correctly preserve previous export when option specified', () => {
            const testSource = deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(test)>
                        <Description>One</Description>
                    </Room>
                    <Variable key=(testVar) default={false} />
                    <If {testVar}>
                        <Room key=(test)>
                            <Description>: Suffix</Description>
                        </Room>
                    </If>
                    <Export><Room key=(test) as=(Room1) /></Export>
                </Asset>
            `)
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.renameItem('test', 'renamed', { updateExports: true })
            expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(renamed)><Description>One</Description></Room>
                    <Variable key=(testVar) default={false} />
                    <If {testVar}>
                        <Room key=(renamed)><Description>: Suffix</Description></Room>
                    </If>
                    <Export><Room key=(renamed) as=(Room1) /></Export>
                </Asset>
            `))
        })

        it('should correctly rename an exit', () => {
            const testSource = deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(test)><Description>One</Description></Room>
                    <Room key=(testTwo)><Exit to=(test)>Go</Exit></Room>
                </Asset>
            `)
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.renameItem('test', 'renamed')
            expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(renamed)><Description>One</Description></Room>
                    <Room key=(testTwo)><Exit to=(renamed)>Go</Exit></Room>
                </Asset>
            `))
        })

        it('should correctly rename a link', () => {
            const testSource = deIndentWML(`
                <Asset key=(TestAsset)>
                    <Feature key=(testFeature)><Description>Test</Description></Feature>
                    <Room key=(test)>
                        <Description>
                            One
                            <Link to=(testFeature)>test</Link>
                        </Description>
                    </Room>
                </Asset>
            `)
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.renameItem('testFeature', 'renamed')
            expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
                <Asset key=(TestAsset)>
                    <Feature key=(renamed)><Description>Test</Description></Feature>
                    <Room key=(test)>
                        <Description>One <Link to=(renamed)>test</Link></Description>
                    </Room>
                </Asset>
            `))
        })

        it('should correctly reformat a map with a renamed room', () => {
            const testSource = deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(test)><Description>One</Description></Room>
                    <Map key=(testMap)><Room key=(test) x="0" y="100" /></Map>
                </Asset>
            `)
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.renameItem('test', 'renamed')
            expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(renamed)><Description>One</Description></Room>
                    <Map key=(testMap)><Room key=(renamed) x="0" y="100" /></Map>
                </Asset>
            `))
        })

        it('should correctly reformat a message with a renamed room', () => {
            const testSource = deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(test)><Description>One</Description></Room>
                    <Message key=(testMessage)>Test!<Room key=(test) /></Message>
                </Asset>
            `)
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.renameItem('test', 'renamed')
            expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(renamed)><Description>One</Description></Room>
                    <Message key=(testMessage)>Test!<Room key=(renamed) /></Message>
                </Asset>
            `))
        })

        it('should correctly reformat a moment with a renamed message', () => {
            const testSource = deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(test)><Description>One</Description></Room>
                    <Message key=(testMessage)>Test!<Room key=(test) /></Message>
                    <Moment key=(testMoment)><Message key=(testMessage) /></Moment>
                </Asset>
            `)
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.renameItem('testMessage', 'renamed')
            expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(test)><Description>One</Description></Room>
                    <Message key=(renamed)>Test!<Room key=(test) /></Message>
                    <Moment key=(testMoment)><Message key=(renamed) /></Moment>
                </Asset>
            `))
        })

    })

    describe('put method', () => {
        it('should add an item in contents', () => {
            const testSource = `<Asset key=(TestAsset)>
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
            normalizer.loadWML(testSource)
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

        it('should default the key if none provided', () => {
            const testSource = `<Asset key=(TestAsset)>
                <Room key=(Room1)>
                    <Description>
                        One
                    </Description>
                </Room>
                <Room key=(test)>
                    <Description>
                        Two
                    </Description>
                </Room>
                <Export><Room key=(test) as=(Room2) /></Export>
            </Asset>`
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.put(
                { tag: 'Room' as const, key: '', name: [], contents: [], render: [] },
                {
                    contextStack: [
                        { tag: 'Asset', key: 'TestAsset', index: 0 }
                    ],
                    index: 2,
                    replace: false
                }
            )
            expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
                <Asset key=(TestAsset)>
                    <Room key=(Room1)><Description>One</Description></Room>
                    <Room key=(test)><Description>Two</Description></Room>
                    <Room key=(Room3) />
                    <Export><Room key=(test) as=(Room2) /></Export>
                </Asset>
            `))
        })
        
    })

    describe('delete method', () => {
        it('should remove a single appearance', () => {
            const testSource = `<Asset key=(Test)>
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
            normalizer.loadWML(testSource)
            normalizer.delete({ key: 'test', index: 1, tag: 'Room' })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should remove the entire element on removing last appearance', () => {
            const testSource = `<Asset key=(Test)>
                <Room key=(test)>
                    <Description>
                        One
                    </Description>
                </Room>
            </Asset>`
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.delete({ key: 'test', index: 0, tag: 'Room' })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should cascade deletes when removing an appearance with contents', () => {
            const testSource = `<Asset key=(Test)>
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
            normalizer.loadWML(testSource)
            normalizer.delete({ key: 'testOne', index: 1, tag: 'Room' })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should rename synthetic keys to fill in gaps for deleted conditionals', () => {
            const testSource = `<Asset key=(Test)>
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
            normalizer.loadWML(testSource)
            normalizer.delete({ key: 'If-1', index: 0, tag: 'If' })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should delete empty parent conditions', () => {
            const testSource = `<Asset key=(TestAsset)>
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
            normalizer.loadWML(testSource)
            normalizer.delete({ key: 'testRoom', index: 0, tag: 'Room' })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should delete an import', () => {
            const testSource = `<Asset key=(TestAsset)>
                <Import from=(base)>
                    <Room key=(testOne) />
                </Import>
            </Asset>`
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.delete({ key: 'Import-0', index: 0, tag: 'Import' })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should correctly delete from inside a conditional with options', () => {
            const testSource = `<Asset key=(Test)>
                <Room key=(room1) />
                <If {true}><Room key=(room1)><Name>Test</Name></Room></If>
            </Asset>`
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.delete({ key: 'room1', index: 1, tag: 'Room' }, { removeEmptyConditions: false })
            expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
                <Asset key=(Test)><Room key=(room1) /><If {true} /></Asset>
            `))

        })
    })

    describe('positioned put method', () => {
        it('should add an item between two others', () => {
            const testSource = `<Asset key=(Test)>
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
            normalizer.loadWML(testSource)
            const toAddSource = `<Room key=(test)><Description>Two</Description></Room>`
            const toAddAsset = schemaFromParse(parse(tokenizer(new SourceStream(toAddSource))))
            normalizer.put(toAddAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: false })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should correctly reorder when added item is nested', () => {
            const testSource = `<Asset key=(Test)>
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
            normalizer.loadWML(testSource)
            const toAddSource = `<Map key=(testMap)><Room key=(test) x="0" y="0"><Description>Two</Description></Room></Map>`
            const toAddAsset = schemaFromParse(parse(tokenizer(new SourceStream(toAddSource))))
            normalizer.put(toAddAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: false })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should update an item in place', () => {
            const testSource = `<Asset key=(Test)>
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
            normalizer.loadWML(testSource)
            const toUpdateSource = `<Room key=(test)><Description>Dos</Description></Room>`
            const toUpdateAsset = schemaFromParse(parse(tokenizer(new SourceStream(toUpdateSource))))
            normalizer.put(toUpdateAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should replace an item with a different item', () => {
            const testSource = `<Asset key=(Test)>
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
            normalizer.loadWML(testSource)
            const toUpdateSource = `<Room key=(testTwo)><Description>Bar</Description></Room>`
            const toUpdateAsset = schemaFromParse(parse(tokenizer(new SourceStream(toUpdateSource))))
            normalizer.put(toUpdateAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should replace an item with a nest that includes the item', () => {
            const testSource = `<Asset key=(Test)>
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
            normalizer.loadWML(testSource)
            const toUpdateSource = `<Map key=(testMap)><Room key=(test) x="0" y="0"><Description>Two</Description></Room></Map>`
            const toUpdateAsset = schemaFromParse(parse(tokenizer(new SourceStream(toUpdateSource))))
            normalizer.put(toUpdateAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should replace a nest that includes an item with the item itself', () => {
            const testSource = `<Asset key=(Test)>
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
            normalizer.loadWML(testSource)
            const toUpdateSource = `<Room key=(test)><Description>Two</Description></Room>`
            const toUpdateAsset = schemaFromParse(parse(tokenizer(new SourceStream(toUpdateSource))))
            normalizer.put(toUpdateAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 1, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should replace a top level character item', () => {
            const testSource = `<Character key=(Tess)>
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
            normalizer.loadWML(testSource)
            const toUpdateSource = `<Character key=(Tess)>
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
            const testSource = `<Asset key=(Test)>
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
            normalizer.loadWML(testSource)
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
            const testSource = `<Asset key=(Test)>
                <Map key=(testMap)>
                    <Room key=(test) x="0" y="0" />
                </Map>
            </Asset>`
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            const toAddSource = `<Room key=(testTwo) x="0" y="100" />`
            const toAddAsset = schemaFromParse(parse(tokenizer(new SourceStream(toAddSource))))
            normalizer.put(toAddAsset[0], { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'testMap', tag: 'Map', index: 0 }] })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should successfully put a duplicate item', () => {
            const testSource = `<Asset key=(TestAsset)>
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
            normalizer.loadWML(testSource)
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
            const testSource = `<Asset key=(TestAsset)>
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
            normalizer.loadWML(testSource)
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
            const testSource = `<Asset key=(TestAsset)>
                <Import from=(base)>
                    <Room key=(testOne) />
                </Import>
            </Asset>`
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            const toReplaceSource = `<Import from=(base)>
                <Room key=(testOne) />
                <Room key=(testTwo) />
            </Import>`
            const toReplaceAsset = schemaFromParse(parse(tokenizer(new SourceStream(toReplaceSource))))
            const toReplaceWrapper = toReplaceAsset[0]
            if (!isSchemaImport(toReplaceWrapper)) {
                throw new Error()
            }
            normalizer.put(toReplaceWrapper, { contextStack: [{ key: 'TestAsset', tag: 'Asset', index: 0 }], index: 0, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should successfully put an import in a character', () => {
            const testSource = `<Character key=(Tess)>
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
            normalizer.loadWML(testSource)
            const toAddSource = `<Import from=(base) />`
            const toAddAsset = schemaFromParse(parse(tokenizer(new SourceStream(toAddSource))))
            const toAddWrapper = toAddAsset[0]
            if (!isSchemaImport(toAddWrapper)) {
                throw new Error()
            }
            normalizer.put(toAddWrapper, { contextStack: [{ key: 'Tess', tag: 'Character', index: 0 }] })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should recalculate Variable default property on update', () => {
            const testSource = `<Asset key=(Test)>
                <Variable key=(testVar) default={false} />
            </Asset>`
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            const variableUpdate: SchemaTag = {
                tag: 'Variable',
                key: 'testVar',
                default: 'true'
            }
            normalizer.put(variableUpdate, { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }], index: 0, replace: true })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should add Knowledge to an asset', () => {
            const testSource = `<Asset key=(Test) />`
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            const knowledgeUpdate: SchemaTag = {
                tag: 'Knowledge',
                key: 'testKnowledge',
                contents: [],
                render: [{ tag: 'String', value: 'Learning!' }],
                name: [{ tag: 'String', value: 'Knowledge is power' }]
            }
            normalizer.put(knowledgeUpdate, { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }] })
            expect(normalizer.normal).toMatchSnapshot()
        })

        it('should correctly update appearances in a nested conditional', () => {
            const testSource = `<Asset key=(Test)>
                <Room key=(room1) />
                <Map key=(map1)>
                    <If {true}><Room key=(room1) x="0" y="0" /></If>
                </Map>
            </Asset>`
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            const roomUpdate: SchemaTag = {
                tag: 'Room',
                key: 'room1',
                contents: [],
                render: [],
                name: [],
                x: 100,
                y: 0
            }
            normalizer.put(roomUpdate, { contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'map1', tag: 'Map', index: 0 }, { key: 'If-0', tag: 'If', index: 0 }], index: 0, replace: true })
            expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(room1) />
                <Map key=(map1)><If {true}><Room key=(room1) x="100" y="0" /></If></Map>
            </Asset>
            `))
        })
    })

    xdescribe('merge function', () => {
        it('should merge two schemata', () => {
            const testOne = new Normalizer()
            testOne.loadSchema([
                {
                    tag: 'Asset',
                    key: 'TestOne',
                    Story: undefined,
                    contents: [{
                        tag: 'Room',
                        key: 'TestRoom',
                        name: [],
                        render: [],
                        contents: [{
                            tag: 'Description',
                            contents: [
                                { tag: 'String', value: 'TestZero'},
                                {
                                    tag: 'If',
                                    conditions: [{
                                        if: 'test',
                                        dependencies: ['test'],
                                    }],
                                    contents: [{
                                        tag: 'String',
                                        value: 'TestOne'
                                    }]
                                },
                                {
                                    tag: 'If',
                                    conditions: [{
                                        if: 'test2',
                                        dependencies: ['test2']
                                    },
                                    {
                                        if: 'test',
                                        dependencies: ['test']
                                    }],
                                    contents: [
                                        { tag: 'String', value: 'TestTwo'},
                                        { tag: 'String', value: 'TestThree'}
                                    ]
                                }
                            ]
                        }]
                    }]
                }
            ])
            const testTwo = new Normalizer()
            testTwo.loadSchema([
                {
                    tag: 'Asset',
                    key: 'TestOne',
                    Story: undefined,
                    contents: [{
                        tag: 'Room',
                        key: 'TestRoom',
                        name: [],
                        render: [],
                        contents: [{
                            tag: 'Description',
                            contents: [
                                { tag: 'String', value: 'TestFour'},
                                {
                                    tag: 'If',
                                    conditions: [{
                                        if: 'test2',
                                        dependencies: ['test2']
                                    }],
                                    contents: [{
                                        tag: 'If',
                                        conditions: [{
                                            if: 'test3',
                                            dependencies: ['test3']
                                        }],
                                        contents: [{ tag: 'String', value: 'TestFive'}]
                                    },
                                    {
                                        tag: 'If',
                                        conditions: [{
                                            if: 'test',
                                            dependencies: ['test']
                                        }],
                                        contents: [{ tag: 'String', value: 'TestSix'}]

                                    }]
                                },
                                {
                                    tag: 'If',
                                    conditions: [{
                                        if: 'test',
                                        dependencies: ['test'],
                                    }],
                                    contents: [{
                                        tag: 'String',
                                        value: 'TestSeven'
                                    }]
                                }
                            ]
                        }]
                    }]
                }
            ])
            testOne.merge(testTwo)
            expect(testOne.schema).toEqual([])
        })
    })

})