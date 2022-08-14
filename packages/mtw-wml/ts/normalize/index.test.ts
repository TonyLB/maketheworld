import normalize, {
    NormalizeTagMismatchError,
    transformNode,
    postProcessAppearance,
    addElement
} from '.'
import { NormalCharacter, NormalForm } from './baseClasses'
import { clearGeneratedKeys } from './keyUtil'
import Normalizer from './newNormalize'
import {
    schemaFromParse,
    validatedSchema
} from '..'
import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'
import parse from '../parser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'

describe('WML normalize', () => {

    beforeEach(() => {
        clearGeneratedKeys()
    })
    describe('transformNode', () => {
        it('should pass room key unchanged', () => {
            expect(transformNode(
                [{ key: 'Test', tag: 'Asset', index: 0 }],
                {
                    key: 'ABC',
                    tag: 'Room',
                    name: 'Vortex',
                    contents: []
                }
            )).toMatchSnapshot()
        })

        it('should synthesize a key for condition tag', () => {
            expect(transformNode(
                [{ key: 'Test', tag: 'Asset', index: 0 }],
                {
                    tag: 'Condition',
                    if: 'true',
                    contents: []
                }
            )).toMatchSnapshot()
        })

        it('should pass a global exit in a room wrapper, with synthetic key', () => {
            expect(transformNode(
                [{ key: 'Test', tag: 'Asset', index: 0 }],
                {
                    tag: 'Exit',
                    to: 'ABC',
                    from: 'DEF',
                    contents: []
                }
            )).toMatchSnapshot()
        })

        it('should pass a local from exit at same level, with synthetic key', () => {
            expect(transformNode(
                [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'ABC', tag: 'Room', index: 0 }],
                {
                    tag: 'Exit',
                    to: 'DEF',
                    contents: []
                }
            )).toMatchSnapshot()
            expect(transformNode(
                [
                    { key: 'Test', tag: 'Asset', index: 0 },
                    { key: 'ABC', tag: 'Room', index: 0 },
                    { key: 'Condition-0', tag: 'Condition', index: 0 }
                ],
                {
                    tag: 'Exit',
                    to: 'DEF',
                    contents: []
                }
            )).toMatchSnapshot()
        })

        it('should pass a local to exit in a sibling room wrapper, with synthetic key', () => {
            expect(transformNode(
                [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'ABC', tag: 'Room', index: 0 }],
                {
                    tag: 'Exit',
                    from: 'DEF',
                    contents: []
                }
            )).toMatchSnapshot()
            expect(transformNode(
                [
                    { key: 'Test', tag: 'Asset', index: 0 },
                    { key: 'ABC', tag: 'Room', index: 0 },
                    { key: 'Condition-0', tag: 'Condition', index: 0 }
                ],
                {
                    tag: 'Exit',
                    from: 'DEF',
                    contents: []
                }
            )).toMatchSnapshot()
        })

    })

    describe('postProcessAppearance', () => {
        it('should aggregate locations into Map rooms', () => {
            const testNormalForm: NormalForm = {
                TestAsset: {
                    key: 'TestAsset',
                    tag: 'Asset',
                    appearances: [{
                        contextStack: [],
                        contents: [{
                            key: 'TestMap',
                            tag: 'Map',
                            index: 0
                        }],
                        location: [0]
                    }]
                },
                TestMap: {
                    key: 'TestMap',
                    tag: 'Map',
                    appearances: [{
                        contextStack: [{ key: 'TestAsset', tag: 'Asset', index: 0 }],
                        contents: [{
                            key: 'welcomeRoom',
                            tag: 'Room',
                            index: 0
                        },
                        {
                            key: 'VORTEX',
                            tag: 'Room',
                            index: 0
                        }],
                        images: [],
                        rooms: {
                            welcomeRoom: {
                                x: 0,
                                y: 100,
                                location: [0, 0, 0]
                            },
                            VORTEX: {
                                x: 0,
                                y: 0,
                                location: [0, 0, 1]
                            }
                        },
                        location: [0, 0]
                    }]
                },
                welcomeRoom: {
                    key: 'welcomeRoom',
                    tag: 'Room',
                    appearances: [{
                        contextStack: [{ key: 'TestAsset', tag: 'Asset', index: 0 }, { key: 'TestMap', tag: 'Map', index: 0 }],
                        contents: [],
                        location: [0, 0, 0]
                    }]
                },
                VORTEX: {
                    key: 'VORTEX',
                    tag: 'Room',
                    appearances: [{
                        contextStack: [{ key: 'TestAsset', tag: 'Asset', index: 0 }, { key: 'TestMap', tag: 'Map', index: 0 }],
                        contents: [],
                        location: [0, 0, 1]
                    }]
                }
            }
            expect(postProcessAppearance(testNormalForm, 'TestMap', 0)).toMatchSnapshot()
        })
    })

    describe('addElement', () => {
        const testMap = {
            Test: {
                key: 'Test',
                tag: 'Asset',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        tag: 'Room',
                        key: 'ABC',
                        index: 0
                    },
                    {
                        tag: 'Condition',
                        key: 'Condition-0',
                        index: 0
                    }],
                }]
            },
            ABC: {
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: 'Vortex',
                    contents: [{
                        tag: 'Exit',
                        key: 'ABC#DEF',
                        index: 0
                    }]
                }]
            },
            'ABC#DEF': {
                key: 'ABC#DEF',
                tag: 'Exit',
                appearances: [{
                    contextStack: [{
                        key: 'Test',
                        tag: 'Asset',
                        index: 0
                    },
                    {
                        key: 'ABC',
                        tag: 'Room',
                        index: 0
                    }]
                }]
            },
            'Condition-0': {
                key: 'Condition-0',
                tag: 'Condition',
                if: 'true',
                appearances: [{
                    contextStack: [{
                        key: 'Test',
                        tag: 'Asset',
                        index: 0
                    }],
                    contents: []
                }]
            }
        }

        it('should add an element with matching contextStack', () => {
            expect(addElement(testMap, {
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                node: {
                    key: 'ABC',
                    tag: 'Room',
                    render: [{
                        tag: 'String',
                        value: 'Vortex!',
                        spaceBefore: false,
                        spaceAfter: false
                    }],
                    contents: []
                }
            })).toMatchSnapshot()
        })

        it('should add an element with differing contextStack', () => {
            expect(addElement(testMap, {
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                node: {
                    key: 'ABC',
                    tag: 'Room',
                    render: [{
                        tag: 'String',
                        value: 'Vortex!',
                        spaceBefore: false,
                        spaceAfter: false
                    }],
                    contents: []
                }
            })).toMatchSnapshot()
        })

        it('should add an element with unspecified indices in the context-stack', () => {
            expect(addElement(testMap, {
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition' }, { key: 'DEF', tag: 'Room' }],
                node: {
                    key: 'DEF#ABC',
                    tag: 'Exit',
                    to: 'ABC',
                    from: 'DEF',
                    contents: []
                }
            })).toMatchSnapshot()
        })
    })

    it('should return empty map on empty schema', () => {
        expect(normalize({})).toEqual({})
        expect((new Normalizer()).normal).toEqual({})
    })

    it('should normalize a character asset', () => {
        const testCharacter: NormalCharacter = {
            tag: 'Character',
            key: 'TESS',
            Name: 'Tess',
            fileURL: 'testIcon.png',
            Pronouns: {
                subject: 'she',
                object: 'her',
                possessive: 'her',
                adjective: 'hers',
                reflexive: 'herself'
            },
            FirstImpression: 'Frumpy Goth',
            OneCoolThing: 'Fuchsia eyes',
            Outfit: 'A battered hoodie trimmed with lace',
            fileName: 'test.wml',
        }
        expect(normalize(testCharacter)).toMatchSnapshot()
    })

    it('should normalize every needed tag', () => {
        const testSource = `<Asset key=(Test) fileName="Test" >
            <Import from=(BASE)>
                <Use key=(basePower) as=(power) type="Variable" />
                <Use key=(overview) type="Room" />
            </Import>
            <Room key=(a123)>
                <Exit from=(b456) />
                <Feature key=(clockTower) />
            </Room>
            <Map key=(TestMap)>
                <Image key=(ImageTest) fileURL="https://test.com/imageTest.png" />
                <Room key=(a123) x="200" y="150" />
            </Map>
            <Feature key=(clockTower)>
                <Name>Clock Tower</Name>
            </Feature>
            <Variable key=(active) default={true} />
            <Computed key=(inactive) src={!active}>
                <Depend on=(active) />
            </Computed>
            <Action key=(toggleActive) src={active = !active} />
        </Asset>`
        const holding = normalize(validatedSchema(wmlGrammar.match(testSource)))
        expect(holding).toMatchSnapshot()
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()
    })
    
    it('should create wrapping elements for exits where needed', () => {
        const testSource = `<Asset key=(Test) fileName="Test" >
            <Room key=(a123)>
                <Exit from=(b456) />
            </Room>
        </Asset>`
        const holding = normalize(validatedSchema(wmlGrammar.match(testSource)))
        expect(holding).toMatchSnapshot()
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should normalize exits into their parent room where needed', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Name>Vortex</Name>
                <Exit to=(b456) />
            </Room>
            <Exit from=(b456) to=(a123) />
            <Room key=(b456)>
                <Name>Welcome</Name>
            </Room>
        </Asset>`
        const holding = normalize(validatedSchema(wmlGrammar.match(testSource)))
        expect(holding).toMatchSnapshot()
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should accumulate multiple appearances of the same key', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Name>Vortex</Name>
            </Room>
            <Room key=(a123)>
                <Description>
                    Hello, world!
                </Description>
            </Room>
            <Condition if={true}>
                <Room key=(a123)>
                    <Description>
                        Vortex!
                    </Description>
                </Room>
            </Condition>
        </Asset>`
        const holding = normalize(validatedSchema(wmlGrammar.match(testSource)))
        expect(holding).toMatchSnapshot()
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
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
            <Condition if={strong}>
                <Depend on=(strong) />
                <Room key=(a123)>
                    <Description>
                        Vortex!
                    </Description>
                </Room>
            </Condition>
            <Variable key=(strong) default={false} />
        </Asset>`
        const holding = normalize(validatedSchema(wmlGrammar.match(testSource)))
        expect(holding).toMatchSnapshot()
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
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
            <Condition if={strong}>
                <Depend on=(strong) />
                <Room key=(a123)>
                    <Description>
                        Vortex!
                    </Description>
                </Room>
            </Condition>
            <Condition if={!strong}>
                <Depend on=(strong) />
                <Condition if={trendy}>
                    <Depend on=(trendy) />
                    <Room key=(a123)>
                        <Description>
                            V.O.R.T.E.X.
                        </Description>
                    </Room>
                </Condition>
            </Condition>
            <Variable key=(strong) default={false} />
            <Variable key=(trendy) default={false} />
        </Asset>`
        const holding = normalize(validatedSchema(wmlGrammar.match(testSource)))
        expect(holding).toMatchSnapshot()
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
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
        const holding = normalize(validatedSchema(wmlGrammar.match(testSource)))
        expect(holding).toMatchSnapshot()
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
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
        expect(() => (normalize(validatedSchema(wmlGrammar.match(testSource))))).toThrowError(new NormalizeTagMismatchError(`Key 'ABC' is used to define elements of different tags ('Room' and 'Variable')`))
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        expect(() => { normalizer.add(testAsset[0], { contextStack: [], location: [0] }) }).toThrowError(new NormalizeTagMismatchError(`Key 'ABC' is used to define elements of different tags ('Room' and 'Variable')`))
    })
})