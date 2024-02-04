import {
    NormalizeTagMismatchError,
} from './baseClasses'
import { clearGeneratedKeys } from './keyUtil'
import Normalizer from '.'
import { Schema, schemaFromParse, schemaToWML } from '../schema'
import parse from '../simpleParser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import { isSchemaCondition, isSchemaImport, isSchemaRoom, SchemaTag } from '../schema/baseClasses'
import { deIndentWML } from '../schema/utils'
import { GenericTreeNode } from '../tree/baseClasses'
import { stripIDFromTree } from '../tree/genericIDTree'

describe('WML normalize', () => {

    beforeEach(() => {
        clearGeneratedKeys()
    })

    it('should return empty map on empty schema', () => {
        expect((new Normalizer()).normal).toEqual({})
    })

    it('should normalize a room', () => {
        const testSource = `
        <Asset key=(Test)>
            <Room key=(a123)>
                <Name>Test Name</Name>
                <Description>Test Description</Description>
            </Room>
        </Asset>`
        const normalizer = new Normalizer()
        normalizer.loadWML(testSource)
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(testSource))
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
                <Room key=(a123)><Position x="200" y="150" /></Room>
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

    it('should correctly serialize exports', () => {
        const testSource = `<Asset key=(Test)>
            <Room key=(testRoom) />
            <Export><Room key=(testRoom) as=(Room2) /></Export>
        </Asset>`
        const normalizer = new Normalizer()
        normalizer.loadWML(testSource)
        expect(normalizer.normal).toEqual({
            Test: {
                key: 'Test',
                tag: 'Asset',
                Story: false,
                instance: false,
                appearances: [{
                    data: { key: 'Test', tag: 'Asset' },
                    contextStack: [],
                    children: [{ data: { key: 'testRoom', tag: 'Room', index: 0 }, children: [] }]
                }]
            },
            testRoom: {
                key: 'testRoom',
                tag: 'Room',
                exportAs: 'Room2',
                appearances: [{
                    data: { key: 'testRoom', tag: 'Room' },
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    children: []
                }]
            }
        })
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
                <Room key=(a123)><Position x="200" y="150" /></Room>
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
                    It activates!<Room key=(a123) />
                </Message>
            </Moment>
            <Export><Room key=(a123) as=(Room2) /></Export>
        </Asset>`
        const schema = new Schema()
        schema.loadWML(testSource)
        const normalizer = new Normalizer()
        normalizer.loadSchema(schema.schema)
        expect(normalizer.schema).toEqual(stripIDFromTree(schema.schema))
    })

    describe('assignDependencies function', () => {
        it('should correctly assign dependencies in a nested conditional', () => {
            const testSource = `<Asset key=(Test)>
                <Room key=(room1) />
                <Map key=(map1)>
                    <If {true}><Room key=(room1) x="0" y="0" /></If>
                </Map>
            </Asset>`
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.assignDependencies((src) => ([src]))
            expect(normalizer._normalForm['If-0']).toEqual({
                key: 'If-0',
                tag: 'If',
                conditions: [{ if: 'true', dependencies: ['true'] }],
                appearances: [{
                    contextStack: [{ tag: 'Asset', key: 'Test', index: 0 }, { tag: 'Map', key: 'map1', index: 0 }],
                    data: { tag: 'If', conditions: [{ if: 'true', dependencies: ['true'] }]},
                    children: [{ data: { tag: 'Room', key: 'room1', index: 1 }, children: [] }]
                }]
            })
        })

        it('should correctly assign dependencies in a Computed tag', () => {
            const testSource = `<Asset key=(Test)>
                <Computed key=(compute1) src={true} />
            </Asset>`
            const normalizer = new Normalizer()
            normalizer.loadWML(testSource)
            normalizer.assignDependencies((src) => ([src]))
            expect(normalizer._normalForm['compute1']).toEqual({
                key: 'compute1',
                tag: 'Computed',
                src: 'true',
                dependencies: ['true'],
                appearances: [{
                    contextStack: [{ tag: 'Asset', key: 'Test', index: 0 }],
                    data: { tag: 'Computed', key: 'compute1', src: 'true', dependencies: ['true'] },
                    children: []
                }]
            })
        })

    })

    xdescribe('merge function', () => {
        it('should merge two schemata', () => {
            const testOne = new Normalizer()
            testOne.loadWML(`
                <Asset key=(testOne)>
                    <Room key=(TestRoom)>
                        <Description>
                            TestZero<If {true}>
                                TestOne
                            </If><If {false}>
                                TestTwo
                                TestThree
                            </If>
                        </Description>
                    </Room>
                </Asset>
            `)
            const testTwo = new Normalizer()
            testTwo.loadWML(`
                <Asset key=(testOne)>
                    <Room key=(TestRoom)>
                        <Description>
                            TestFour
                            TestZero<If {false}>
                                <If {1==0}>
                                    TestFive
                                </If>
                                <If {true}>
                                    TestSix
                                </If>
                            </If>
                            <If {true}>
                                TestSeven
                            </If>
                        </Description>
                    </Room>
                </Asset>
            `)
            testOne.merge(testTwo)
            expect(testOne.schema).toEqual([])
        })
    })

    describe('select function', () => {
        it('should select a single key from a normalForm', () => {
            const testOne = new Normalizer()
            testOne.loadWML(`
                <Asset key=(testOne)>
                    <Room key=(room1)>
                        <Name>Test room</Name>
                        <Description>
                            TestZero
                        </Description>
                    </Room>
                    <Room key=(room2) />
                    <If {true}>
                        <Room key=(room1)>
                            <Description>: Addendum</Description>
                        </Room>
                    </If>
                    <Variable key=(testVar) default={false} />
                </Asset>
            `)
            expect(testOne.select({ key: 'room1', selector: schemaToWML })).toEqual(deIndentWML(`
                <Asset key=(testOne)>
                    <Room key=(room1)>
                        <Name>Test room</Name>
                        <Description>TestZero</Description>
                    </Room>
                    <If {true}>
                        <Room key=(room1)><Description>: Addendum</Description></Room>
                    </If>
                </Asset>
            `))
        })
    })

})