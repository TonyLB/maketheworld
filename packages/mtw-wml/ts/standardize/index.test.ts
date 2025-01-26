import { Schema, schemaToWML } from '../schema'
import { StandardForm, defaultSelected } from '.'
import { deIndentWML } from '../schema/utils'
import { GenericTree, GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '../schema/baseClasses'
import StandardRoom from './components/room'

describe('defaultSelected', () => {
    const schemaTest = (wml: string): GenericTree<SchemaTag> => {
        const schema = new Schema()
        schema.loadWML(wml)
        return schema.schema
    }
    
    it('should leave WML unchanged when selected exists', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                    <ElseIf {false} selected><Exit to=(GHI)>Test Exit</Exit></ElseIf>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(defaultSelected(schemaTest(testWML)))).toEqual(testWML)
    })

    it('should not add default select when no fallthrough', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                    <ElseIf {false}><Exit to=(GHI)>Test Exit</Exit></ElseIf>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(defaultSelected(schemaTest(testWML)))).toEqual(testWML)
    })

    it('should add default select on fallthrough when available', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                    <Else><Exit to=(GHI)>Test Exit</Exit></Else>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(defaultSelected(schemaTest(testWML)))).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                    <Else selected><Exit to=(GHI)>Test Exit</Exit></Else>
                </Room>
            </Asset>
        `))
    })

})

describe('StandardForm', () => {

    it('should return an empty wrapper unchanged', () => {
        const test = new StandardForm(`<Asset key=(Test) />`)
        expect(test.header).toEqual({ tag: 'Asset', key: 'Test', universalKey: 'ASSET#Test' })
        expect(schemaToWML([test.schema])).toEqual(`<Asset key=(Test) />`)
    })

    it('should accept edit tags in JSON form', () => {
        const test = new StandardForm({
            key: 'test',
            metaData: [],
            byId: {
                testReplace: {
                    tag: 'Replace',
                    key: 'testRoom',
                    match: {
                        tag: 'Room',
                        key: 'testRoom',
                        themes: [],
                        exits: []
                    },
                    payload: {
                        tag: 'Room',
                        key: 'testRoom',
                        themes: [],
                        exits: [],
                        name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Test' }, children: [] }] }
                    }
                },
                testRemove: {
                    tag: 'Remove',
                    key: 'testRoomTwo',
                    component: {
                        tag: 'Room',
                        key: 'testRoomTwo',
                        themes: [],
                        exits: []
                    }
                }
            }
        })
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Replace><Room key=(testRoom) /></Replace>
                <With><Room key=(testRoom)><Name>Test</Name></Room></With>
                <Remove><Room key=(testRoomTwo) /></Remove>
            </Asset>
        `))
    })

    it('should accept edit tags', () => {
        const test: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Asset', key: 'Test', Story: undefined },
            children: [
                {
                    data: { tag: 'Room', key: 'testRoom' },
                    children: [{
                        data: { tag: 'Replace' },
                        children: [{
                            data: { tag: 'ReplaceMatch' },
                            children: [{
                                data: { tag: 'Name' },
                                children: [{ data: { tag: 'String', value: 'Lobby' }, children: [] }]
                            }]
                        },
                        {
                            data: { tag: 'ReplacePayload' },
                            children: [{
                                data: { tag: 'Name' },
                                children: [{ data: { tag: 'String', value: 'Foyer' }, children: [] }]
                            }]
                        }],
                        
                    },
                    {
                        data: { tag: 'Remove' },
                        children: [{ data: { tag: 'Exit', from: 'testRoom', to: 'testDestination', key: 'testRoom#testDestination' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }]
                    }]
                },
                { data: { tag: 'Remove' }, children: [{ data: { tag: 'Room', key: 'testRoomRemove' }, children: [] }] },
                {
                    data: { tag: 'Replace' },
                    children: [
                        { data: { tag: 'ReplaceMatch' }, children: [{ data: { tag: 'Room', key: 'testRoomReplace' }, children: [{ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] }] }] },
                        { data: { tag: 'ReplacePayload' }, children: [{ data: { tag: 'Room', key: 'testRoomReplace' }, children: [{ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Changed' }, children: [] }] }] }] }
                    ]
                }
            ]
        }

        const standard = new StandardForm(test)
        expect(standard.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            byId: {
                testRoom: {
                    tag: 'Room',
                    key: 'testRoom',
                    name: {
                        data: { tag: 'Replace' },
                        children: [{
                            data: { tag: 'ReplaceMatch' },
                            children: [{
                                data: { tag: 'Name' },
                                children: [{ data: { tag: 'String', value: 'Lobby' }, children: [] }]
                            }]
                        },
                        {
                            data: { tag: 'ReplacePayload' },
                            children: [{
                                data: { tag: 'Name' },
                                children: [{ data: { tag: 'String', value: 'Foyer' }, children: [] }]
                            }]
                        }]
                    },
                    exits: [{
                        data: { tag: 'Remove' },
                        children: [{ data: { tag: 'Exit', from: 'testRoom', to: 'testDestination', key: 'testRoom#testDestination' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }]
                    }],
                    themes: []
                },
                testRoomRemove: {
                    tag: 'Remove',
                    key: 'testRoomRemove',
                    component: {
                        tag: 'Room',
                        key: 'testRoomRemove',
                        exits: [],
                        themes: []
                    }
                },
                testRoomReplace: {
                    tag: 'Replace',
                    key: 'testRoomReplace',
                    match: {
                        tag: 'Room',
                        key: 'testRoomReplace',
                        name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
                        exits: [],
                        themes: []
                    },
                    payload: {
                        tag: 'Room',
                        key: 'testRoomReplace',
                        name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Changed' }, children: [] }] },
                        exits: [],
                        themes: []
                    }
                }
            }
        })
    })

    it('should accept meta tags', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Meta key=(ABC) time="1234" />
            <Room key=(testRoom)>
                <Description>Test Description</Description>
            </Room>
        </Asset>`)

        expect(test.toJSON()).toEqual({
            key: 'Test',
            metaData: [{ data: { tag: 'Meta', key: 'ABC', time: 1234 }, children: [] }],
            byId: {
                testRoom: {
                    tag: 'Room',
                    key: 'testRoom',
                    themes: [],
                    description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Test Description' }, children: [] }] },
                    exits: [],
                }
            }
        })
    })

    it('should accept condition tags without including wrapperKey', () => {
        const standard = new StandardForm(`<Asset key=(Test)>
            <Room key=(Room1)>
                <Description>
                    <If {true}>True</If><Else>False</Else>
                </Description>
            </Room>
        </Asset>`)

        expect(standard.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            byId: {
                "Room1": {
                    tag: 'Room',
                    key: 'Room1',
                    exits: [],
                    themes: [],
                    description: { data: { tag: 'Description' }, children: [{
                        data: { tag: 'If' },
                        children: [
                            {
                                data: { tag: 'Statement', if: 'true' },
                                children: [{ data: { tag: 'String', value: 'True' }, children: [] }]
                            },
                            {
                                data: { tag: 'Fallthrough' },
                                children: [{ data: { tag: 'String', value: 'False' }, children: [] }]
                            }
                        ]
                    }] },
                }
            }
        })
    })

    it('should accept parsed schema', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Name>Test Room</Name>
                    <Summary>One<br /><If {false}>Two</If></Summary>
                    <Description>Three</Description>
                </Room>
                <Feature key=(testFeature)>
                    <Example key=(base)>
                        <Description><If {false}>Four</If></Description>
                    </Example>
                </Feature>
            </Asset>
        `)
        const schema = new Schema()
        schema.loadWML(testSource)
        const test = new StandardForm(schema.schema[0])
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

    it('should combine descriptions in rooms and features', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Example key=(testExample)>
                    <Summary>
                        One
                        <br />
                    </Summary>
                    <Description>Three</Description>
                </Example>
            </Room>
            <If {false}>
                <Room key=(test)>
                    <Example key=(testExample)><Summary>Two</Summary></Example>
                </Room>
                <Feature key=(testFeature)>
                    <Example key=(base)><Description>Four</Description></Example>
                </Feature>
            </If>
            <Room key=(test)>
                <Example key=(testExample)><Name>Test Room</Name></Example>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Example key=(testExample)>
                        <Name>Test Room</Name>
                        <Summary>One<br /><If {false}>Two</If></Summary>
                        <Description>Three</Description>
                    </Example>
                </Room>
                <Feature key=(testFeature)>
                    <Example key=(base)><Description><If {false}>Four</If></Description></Example>
                </Feature>
            </Asset>
        `))
    })

    it('should combine exits in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>
                    One
                    <br />
                </Description>
            </Room>
            <Room key=(testTwo) />
            <If {false}>
                <Room key=(test)>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            </If>
            <Room key=(testTwo)>
                <Exit to=(test)>Test Return</Exit>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Description>One<br /></Description>
                    <If {false}><Exit to=(testTwo)>Test Exit</Exit></If>
                </Room>
                <Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>
            </Asset>
        `))
    })

    it('should correctly return JSON for features nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>One</Description>
                <Feature key=(testLocal)>
                    <Example key=(base)><Description>Local</Description></Example>
                </Feature>
                <Feature global key=(testGlobal)>
                    <Example key=(base)><Description>Global</Description></Example>
                </Feature>
            </Room>
            <Room key=(testTwo) />
        </Asset>`)
        expect(test.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            byId: {
                test: {
                    tag: 'Room',
                    key: 'test',
                    themes: [],
                    description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'One' }, children: [] }] },
                    exits: [],
                    features: [
                        { tag: 'Feature', key: 'testLocal' },
                        { tag: 'Feature', global: true, key: 'testGlobal' }
                    ]
                },
                ['test.testLocal']: {
                    tag: 'Feature',
                    key: 'test.testLocal',
                    examples: [{ key: 'base', tag: 'Example' }]
                },
                ['test.testLocal.base']: {
                    tag: 'Example',
                    key: 'test.testLocal.base',
                    description: [{ data: { tag: 'String', value: 'Local' }, children: [] }]
                },
                testGlobal: {
                    tag: 'Feature',
                    key: 'testGlobal',
                    global: true,
                    examples: [{ key: 'base', tag: 'Example' }]
                },
                ['testGlobal.base']: {
                    tag: 'Example',
                    key: 'testGlobal.base',
                    description: [{ data: { tag: 'String', value: 'Global' }, children: [] }]
                },
                testTwo: {
                    tag: 'Room',
                    key: 'testTwo',
                    themes: [],
                    exits: []
                }
            }
        })
    })

    it('should correctly return JSON for examples nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Example key=(testLocal)>
                    <Description>Description Test</Description>
                </Example>
            </Room>
            <Room key=(testTwo) />
        </Asset>`)
        expect(test.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            byId: {
                test: {
                    tag: 'Room',
                    key: 'test',
                    themes: [],
                    exits: [],
                    examples: [{ tag: 'Example', key: 'testLocal' }]
                },
                ['test.testLocal']: {
                    tag: 'Example',
                    key: 'test.testLocal',
                    description: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }]
                },
                testTwo: {
                    tag: 'Room',
                    key: 'testTwo',
                    themes: [],
                    exits: []
                }
            }
        })
    })

    it('should correctly return JSON for examples nested in Knowledge', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Knowledge key=(test)>
                <Example key=(testLocal)>
                    <Description>Description Test</Description>
                </Example>
            </Knowledge>
        </Asset>`)
        expect(test.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            byId: {
                test: {
                    tag: 'Knowledge',
                    key: 'test',
                    examples: [{ tag: 'Example', key: 'testLocal' }]
                },
                ['test.testLocal']: {
                    tag: 'Example',
                    key: 'test.testLocal',
                    description: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }]
                }
            }
        })
    })

    it('should correct return JSON for examples nested in features nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Feature key=(testFeature)>
                    <Example key=(testLocal)>
                        <Description>Description Test</Description>
                    </Example>
                </Feature>
            </Room>
            <Room key=(testTwo) />
        </Asset>`)
        expect(test.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            byId: {
                test: {
                    tag: 'Room',
                    key: 'test',
                    themes: [],
                    exits: [],
                    features: [{ tag: 'Feature', key: 'testFeature' }]
                },
                ['test.testFeature']: {
                    tag: 'Feature',
                    key: 'test.testFeature',
                    examples: [{ tag: 'Example', key: 'testLocal' }]
                },
                ['test.testFeature.testLocal']: {
                    tag: 'Example',
                    key: 'test.testFeature.testLocal',
                    description: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }]
                },
                testTwo: {
                    tag: 'Room',
                    key: 'testTwo',
                    themes: [],
                    exits: []
                }
            }
        })
    })

    it('should correctly return schema for features nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>One</Description>
                <Feature key=(testLocal)>
                    <Description>Local</Description>
                </Feature>
                <Feature global key=(testGlobal)>
                    <Description>Global</Description>
                </Feature>
            </Room>
            <Room key=(testTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Feature key=(testLocal)><Description>Local</Description></Feature>
                    <Feature global key=(testGlobal) />
                    <Description>One</Description>
                </Room>
                <Room key=(testTwo) />
                <Feature key=(testGlobal)><Description>Global</Description></Feature>
            </Asset>
        `))
    })

    it('should correctly return schema for examples nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Example key=(testLocal)>
                    <Description>Description Test</Description>
                </Example>
            </Room>
            <Room key=(testTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Example key=(testLocal)>
                        <Description>Description Test</Description>
                    </Example>
                </Room>
                <Room key=(testTwo) />
            </Asset>
        `))
    })

    it('should correctly return schema for examples nested in knowledge', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Knowledge key=(test)>
                    <Example key=(testLocal)>
                        <Description>Description Test</Description>
                    </Example>
                </Knowledge>
            </Asset>
        `)
        const test = new StandardForm(testSource)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

    it('should correctly return schema for examples nested in features nested in rooms', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Feature key=(testFeature)>
                        <Example key=(testLocal)>
                            <Description>Description Test</Description>
                        </Example>
                    </Feature>
                </Room>
                <Room key=(testTwo) />
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    it('should combine render in nested rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>
                    One
                    <br />
                </Description>
            </Room>
            <Room key=(testTwo) />
            <Message key=(testMessage)>
                Test message
                <Room key=(test)>
                    <Description>
                        Two
                    </Description>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            </Message>
            <Room key=(testTwo)>
                <Exit to=(test)>Test Return</Exit>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Description>One<br />Two</Description>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
                <Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>
                <Message key=(testMessage)><Room key=(test) />Test message</Message>
            </Asset>
        `))
    })

    it('should render features and links correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>
                    <Link to=(testFeatureOne)>test</Link>
                </Description>
            </Room>
            <Feature key=(testFeatureOne)>
                <Name>TestOne</Name>
                <Description><Link to=(testFeatureTwo)>two</Link></Description>
            </Feature>
            <Feature key=(testFeatureTwo)>
                <Name>TestTwo</Name>
                <Description>Test</Description>
            </Feature>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Description><Link to=(testFeatureOne)>test</Link></Description>
                </Room>
                <Feature key=(testFeatureOne)>
                    <Name>TestOne</Name>
                    <Description><Link to=(testFeatureTwo)>two</Link></Description>
                </Feature>
                <Feature key=(testFeatureTwo)>
                    <Name>TestTwo</Name>
                    <Description>Test</Description>
                </Feature>
            </Asset>
        `))
    })

    it('should render knowledge correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>
                    <Link to=(testKnowledgeOne)>test</Link>
                </Description>
            </Room>
            <Knowledge key=(testKnowledgeOne)>
                <Example key=(base)>
                    <Name>TestOne</Name>
                    <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                </Example>
            </Knowledge>
            <Knowledge key=(testKnowledgeTwo)>
                <Example key=(base)>
                    <Name>TestTwo</Name>
                    <Description>Test</Description>
                </Example>
            </Knowledge>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Description><Link to=(testKnowledgeOne)>test</Link></Description>
                </Room>
                <Knowledge key=(testKnowledgeOne)>
                    <Example key=(base)>
                        <Name>TestOne</Name>
                        <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                    </Example>
                </Knowledge>
                <Knowledge key=(testKnowledgeTwo)>
                    <Example key=(base)>
                        <Name>TestTwo</Name>
                        <Description>Test</Description>
                    </Example>
                </Knowledge>
            </Asset>
        `))
    })

    it('should render bookmarks correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Bookmark key=(testOne)>
                TestOne<Bookmark key=(testThree) />
            </Bookmark>
            <Bookmark key=(testTwo)>
                TestTwo<Bookmark key=(testOne) />
            </Bookmark>
            <Bookmark key=(testThree)>
                TestThree
            </Bookmark>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Bookmark key=(testOne)>TestOne<Bookmark key=(testThree) /></Bookmark>
                <Bookmark key=(testThree)>TestThree</Bookmark>
                <Bookmark key=(testTwo)>TestTwo<Bookmark key=(testOne) /></Bookmark>
            </Asset>
        `))
    })

    it('should render maps correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Map key=(testMap)>
                <Name>Test map</Name>
                <Room key=(testRoomOne)>
                    <Position x="0" y="0" />
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <If {false}>
                    <Room key=(testRoomOne) />
                    <Room key=(testRoomTwo)>
                        <Position x="-100" y="0" />
                        <Description>Test Room Two</Description>
                        <Exit to=(testRoomOne)>one</Exit>
                    </Room>
                </If>
                <If {true} />
                <Room key=(testRoomThree) />
                <Image key=(mapBackground) />
            </Map>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Image key=(mapBackground) />
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room key=(testRoomThree) />
                <Room key=(testRoomTwo)>
                    <Description><If {false}>Test Room Two</If></Description>
                    <If {false}><Exit to=(testRoomOne)>one</Exit></If>
                </Room>
                <Map key=(testMap)>
                    <Name>Test map</Name>
                    <Image key=(mapBackground) />
                    <Room key=(testRoomOne)><Position x="0" y="0" /></Room>
                    <Room key=(testRoomThree) />
                    <If {false}>
                        <Room key=(testRoomOne) />
                        <Room key=(testRoomTwo)><Position x="-100" y="0" /></Room>
                    </If>
                    <If {true} />
                </Map>
            </Asset>
        `))
    })

    it('should render empty maps', () => {
        const test = new StandardForm(`<Asset key=(Test)><Map key=(testMap) /></Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)><Map key=(testMap) /></Asset>
        `))
    })

    it('should render themes correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Map key=(testMap)>
                <Room key=(testRoomOne)>
                    <Position x="0" y="0" />
                </Room>
            </Map>
            <Theme key=(testTheme)>
                <Name>Spooky shenanigans</Name>
                <Prompt>Spooky</Prompt>
                <Room key=(testRoomOne) />
                <Map key=(testMap) />
            </Theme>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Map key=(testMap)>
                    <Room key=(testRoomOne)><Position x="0" y="0" /></Room>
                </Map>
                <Theme key=(testTheme)>
                    <Name>Spooky shenanigans</Name>
                    <Prompt>Spooky</Prompt>
                    <Room key=(testRoomOne) />
                    <Map key=(testMap) />
                </Theme>
            </Asset>
        `))
    })

    it('should render messages correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Message key=(testMessage)>
                Test message
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room key=(testRoomTwo)>
                    <Description>Test Room Two</Description>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
            </Message>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room key=(testRoomTwo)>
                    <Description>Test Room Two</Description>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
                <Message key=(testMessage)>
                    <Room key=(testRoomOne) />
                    <Room key=(testRoomTwo) />
                    Test message
                </Message>
            </Asset>
        `))
    })

    it('should render moments correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Moment key=(testMoment)>
                <Message key=(testMessage)>
                    Test message
                    <Room key=(testRoomOne)>
                        <Description>Test Room One</Description>
                        <Exit to=(testRoomTwo)>two</Exit>
                    </Room>
                </Message>
            </Moment>
        </Asset>`)
        // console.log(`byId: ${JSON.stringify(test._byId, null, 4)}`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Message key=(testMessage)><Room key=(testRoomOne) />Test message</Message>
                <Moment key=(testMoment)><Message key=(testMessage) /></Moment>
            </Asset>
        `))
    })

    it('should render variables correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Variable key=(testVar) default={false} />
            <Room key=(testRoomOne)>
                <Description>Test Room One</Description>
                <Exit to=(testRoomTwo)>two</Exit>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Variable key=(testVar) default={false} />
            </Asset>
        `))
    })

    it('should render computes', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Computed key=(computeOne) src={computeThree} />
            <Computed key=(computeTwo) src={!computeOne} />
            <Computed key=(computeThree) src={!testVar} />
            <Variable key=(testVar) default={false} />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Variable key=(testVar) default={false} />
                <Computed key=(computeOne) src={computeThree} />
                <Computed key=(computeThree) src={!testVar} />
                <Computed key=(computeTwo) src={!computeOne} />
            </Asset>
        `))
    })

    it('should render actions correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Action key=(actionOne) src={testVar = !testVar} />
            <Computed key=(computeOne) src={!testVar} />
            <Variable key=(testVar) default={false} />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Variable key=(testVar) default={false} />
                <Computed key=(computeOne) src={!testVar} />
                <Action key=(actionOne) src={testVar = !testVar} />
            </Asset>
        `))
    })

    it('should render imports correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Import from=(vanishingPoint)>
                <Variable key=(power) as=(testVar) />
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Map key=(testMap)>
                    <Room key=(testRoomTwo)><Position x="100" y="0" /></Room>
                </Map>
            </Import>
            <Room key=(testRoomTwo) />
            <Variable key=(testVar) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(vanishingPoint)>
                    <Room key=(testRoomOne) />
                    <Map key=(testMap) />
                    <Variable key=(power) as=(testVar) />
                </Import>
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room key=(testRoomTwo) />
                <Map key=(testMap)>
                    <Room key=(testRoomTwo)><Position x="100" y="0" /></Room>
                </Map>
            </Asset>
        `))
    })

    it('should correctly reflect empty imports in byId', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Import from=(vanishingPoint)>
                <Room key=(testRoomOne) />
            </Import>
        </Asset>`)
        const firstRoom = test._byId.testRoomOne
        expect(firstRoom.toJSON()).toEqual({
            exits: [],
            key: 'testRoomOne',
            tag: 'Room',
            themes: [],
            from: {
                action: 'Content',
                payload: { assetId: 'vanishingPoint', fromKey: 'testRoomOne' }
            }
        })
        const mapTest = new StandardForm(`<Asset key=(Test)>
            <Map key=(testMap)>
                <Room key=(testRoomOne)><Position x="0" y="100" /></Room>
            </Map>
        </Asset>`)
        expect(mapTest._byId.testRoomOne.toJSON()).toEqual({
            exits: [],
            key: 'testRoomOne',
            tag: 'Room',
            themes: []
        })
    })

    it('should render unedited imports correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Import from=(vanishingPoint)>
                <Room key=(testRoomOne) />
            </Import>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(vanishingPoint)><Room key=(testRoomOne) /></Import>
            </Asset>
        `))
    })

    it('should render renamed imports correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Import from=(vanishingPoint)>
                <Room key=(testRoomOne) as=(testRoomTwo)>
                    <ShortName>Test</ShortName>
                </Room>
            </Import>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(vanishingPoint)>
                    <Room key=(testRoomOne) as=(testRoomTwo) />
                </Import>
                <Room key=(testRoomTwo)><ShortName>Test</ShortName></Room>
            </Asset>
        `))
    })

    it('should render exports correctly', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Export><Room key=(testRoomOne) as=(Room2) /></Export>
            </Asset>
        `)
        const test = new StandardForm(testSource)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

    it('should render Remove tags correctly', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Remove><Room key=(testRoomTwo)><Name>Test To Delete</Name></Room></Remove>
            </Asset>
        `)
        const test = new StandardForm(testSource)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

    it('should render Replace tags correctly', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Replace><Variable key=(testVariable) default={true} /></Replace>
                <With><Variable key=(testVariable) default={false} /></With>
            </Asset>
        `)
        const test = new StandardForm(testSource)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

    it('should handle characters correctly', () => {
        const testSource = deIndentWML(`
            <Asset key=(test)>
                <Character key=(Tess)>
                    <Name>Tess</Name>
                    <Pronouns
                        subject="she"
                        object="her"
                        possessive="her"
                        adjective="hers"
                        reflexive="herself"
                    />
                    <FirstImpression>Frumpy Goth</FirstImpression>
                    <OneCoolThing>Fuchsia eyes</OneCoolThing>
                    <Outfit>
                        A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.
                    </Outfit>
                    <Image key=(TessIcon) />
                </Character>
                <Image key=(TessIcon) />
            </Asset>
        `)
        const test = new StandardForm(testSource)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

    it('should merge edit value tags correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Lobby</Name>
                    <Description>A plain lobby.</Description>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace><Name>Lobby</Name></Replace>
                    <With><Name>Darkened lobby</Name></With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Darkened lobby</Name>
                    <Description>A plain lobby.</Description>
                </Room>
            </Asset>
        `))
    })

    it('should merge edit component remove of plain base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Lobby</Name>
                    <Description>A plain lobby.</Description>
                </Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Remove>
                    <Room key=(testRoomOne)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Room>
                </Remove>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)><Room key=(testRoomTwo) /></Asset>
        `))
    })

    it('should merge edit component clear of fields in imported example correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Import from=(base)>
                    <Room key=(testRoomOne) />
                </Import>
                <Room key=(testRoomOne)>
                    <Example key=(base)>
                        <Name>Lobby</Name>
                    </Example>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Import from=(base)>
                    <Room key=(testRoomOne) />
                </Import>
                <Room key=(testRoomOne)>
                    <Example key=(base)>
                        <Remove><Name>Lobby</Name></Remove>
                    </Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(base)><Room key=(testRoomOne) /></Import>
                <Room key=(testRoomOne)><Example key=(base) /></Room>
            </Asset>
        `))
    })

    it('should merge edit component remove of replace base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Lobby</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed</Name></Room></With>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Remove>
                    <Room key=(testRoomOne)><Name>Changed</Name></Room>
                </Remove>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Remove><Room key=(testRoomOne)><Name>Lobby</Name></Room></Remove>
                <Room key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component remove of empty base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Remove>
                    <Room key=(testRoomOne)><Name>Lobby</Name></Room>
                </Remove>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Remove><Room key=(testRoomOne)><Name>Lobby</Name></Room></Remove>
                <Room key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component replace of plain base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>                
                <Room key=(testRoomOne)><Name>Test</Name></Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Test</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed</Name></Room></With>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)><Name>Changed</Name></Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component replace of replace base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Lobby</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed</Name></Room></With>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Changed</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed again</Name></Room></With>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Lobby</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed again</Name></Room></With>
                <Room key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component replace of empty base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Lobby</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed</Name></Room></With>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Lobby</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed</Name></Room></With>
                <Room key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should apply edits on merge', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Room key=(testRoomTwo)>
                    <Exit to=(testRoomOne)>out</Exit>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomTwo)>
                    <Remove><Exit to=(testRoomOne)>out</Exit></Remove>
                    <Exit to=(testRoomOne)>depart</Exit>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Room key=(testRoomTwo)><Exit to=(testRoomOne)>depart</Exit></Room>
            </Asset>
        `))
    })

    it('should correctly merge multiple replaces', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace><ShortName>One</ShortName></Replace>
                    <With><ShortName>Two</ShortName></With>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace><ShortName>Two</ShortName></Replace>
                    <With><ShortName>Three</ShortName></With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace><ShortName>One</ShortName></Replace>
                    <With><ShortName>Three</ShortName></With>
                </Room>
            </Asset>
        `))
    })

    it('should correctly filter no-op replace results', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace><ShortName>One</ShortName></Replace>
                    <With><ShortName>Two</ShortName></With>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace><ShortName>Two</ShortName></Replace>
                    <With><ShortName>One</ShortName></With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)><Room key=(testRoomOne) /></Asset>
        `))
    })

    it('should merge multiple standardComponents correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Lobby</Name>
                    <Description>A plain lobby.</Description>
                </Room>
                <Room key=(testRoomTwo)><Name>Test Two</Name></Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name><Space />(at night)</Name>
                    <Description><Space />Shadows cling to the corners of the room.</Description>
                </Room>
                <Room key=(testRoomThree)><Name>Test Three</Name></Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Lobby (at night)</Name>
                    <Description>
                        A plain lobby. Shadows cling to the corners of the room.
                    </Description>
                </Room>
                <Room key=(testRoomThree)><Name>Test Three</Name></Room>
                <Room key=(testRoomTwo)><Name>Test Two</Name></Room>
            </Asset>
        `))
    })

    it('should merge metadata correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Import from=(primitives)>
                    <Room key=(testRoomOne) />
                </Import>
                <Room key=(testRoomOne)>
                    <Name>Lobby</Name>
                    <Description>A plain lobby.</Description>
                </Room>
                <Room key=(testRoomTwo)><Name>Test Two</Name></Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Import from=(primitives)>
                    <Room key=(testRoomThree) />
                </Import>
                <Room key=(testRoomOne)>
                    <Name><Space />(at night)</Name>
                    <Description><Space />Shadows cling to the corners of the room.</Description>
                </Room>
                <Room key=(testRoomThree)><Name>Test Three</Name></Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(primitives)>
                    <Room key=(testRoomOne) />
                    <Room key=(testRoomThree) />
                </Import>
                <Room key=(testRoomOne)>
                    <Name>Lobby (at night)</Name>
                    <Description>
                        A plain lobby. Shadows cling to the corners of the room.
                    </Description>
                </Room>
                <Room key=(testRoomThree)><Name>Test Three</Name></Room>
                <Room key=(testRoomTwo)><Name>Test Two</Name></Room>
            </Asset>
        `))
    })

    it('should merge edited metadata correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Import from=(primitives)>
                    <Room key=(testRoomOne) />
                </Import>
                <Room key=(testRoomOne)><Name>Test</Name></Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Remove>
                    <Import from=(primitives)>
                        <Room key=(testRoomOne) />
                    </Import>
                </Remove>
                <Import from=(test)>
                    <Room key=(testRoomOne) />
                </Import>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(test)><Room key=(testRoomOne) /></Import>
                <Room key=(testRoomOne)><Name>Test</Name></Room>
            </Asset>
        `))
    })

    it('should merge multiple serializable standardComponents correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Lobby</Name>
                    <Description>A plain lobby.</Description>
                </Room>
                <Room key=(testRoomTwo)><Name>Test Two</Name></Room>
            </Asset>
        `)
        const testStandard = new StandardForm({
            key: 'Test',
            byId: {
                testRoomOne: {
                    tag: 'Room',
                    key: 'testRoomOne',
                    exits: [],
                    themes: [],
                    name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: ': Night' }, children: [] }] }
                }
            },
            metaData: []
        })
        const standardizer = inherited.merge(testStandard)
        expect(schemaToWML([standardizer.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Lobby: Night</Name>
                    <Description>A plain lobby.</Description>
                </Room>
                <Room key=(testRoomTwo)><Name>Test Two</Name></Room>
            </Asset>
        `))
    })

    it('should merge with an empty value', () => {
        const inherited = new StandardForm(`<Asset key=(Test) />`)
        const testStandard = new StandardForm({
            key: 'Test',
            byId: {
                testRoomOne: {
                    tag: 'Room',
                    key: 'testRoomOne',
                    exits: [],
                    themes: [],
                    shortName: {
                        data: { tag: 'Replace' },
                        children: [
                            { data: { tag: 'ReplaceMatch' }, children: [{ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'Test' }, children: [] }] }] },
                            { data: { tag: 'ReplacePayload' }, children: [{ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'TestReplace' }, children: [] }] }] }
                        ]
                    }
                }
            },
            metaData: []
        })
        const standardizer = inherited.merge(testStandard)
        expect(schemaToWML([standardizer.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace><ShortName>Test</ShortName></Replace>
                    <With><ShortName>TestReplace</ShortName></With>
                </Room>
            </Asset>
        `))
    })

    it('should merge base component with universalKey', () => {
        const base = new StandardRoom(deIndentWML(`<Room key=(test)><Description>One</Description></Room>`)).withUniversalKey('ROOM#001')
        const incoming = new StandardRoom(deIndentWML(`<Room key=(test)><Description>Two</Description></Room>`))
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('ROOM#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Room key=(test)><Description>OneTwo</Description></Room>
            `))
        }
    })

    it('should merge incoming component with universalKey', () => {
        const base = new StandardRoom(deIndentWML(`<Room key=(test)><Description>One</Description></Room>`))
        const incoming = new StandardRoom(deIndentWML(`<Room key=(test)><Description>Two</Description></Room>`)).withUniversalKey('ROOM#001')
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('ROOM#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Room key=(test)><Description>OneTwo</Description></Room>
            `))
        }
    })

    it('should merge identical universalKeys', () => {
        const base = new StandardRoom(deIndentWML(`<Room key=(test)><Description>One</Description></Room>`)).withUniversalKey('ROOM#001')
        const incoming = new StandardRoom(deIndentWML(`<Room key=(test)><Description>Two</Description></Room>`)).withUniversalKey('ROOM#001')
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('ROOM#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Room key=(test)><Description>OneTwo</Description></Room>
            `))
        }
    })

    it('should throw error on conflicting universalKeys', () => {
        const base = new StandardRoom(deIndentWML(`<Room key=(test)><Description>One</Description></Room>`)).withUniversalKey('ROOM#001')
        const incoming = new StandardRoom(deIndentWML(`<Room key=(test)><Description>Two</Description></Room>`)).withUniversalKey('ROOM#002')
        expect(() => { base.merge(incoming) }).toThrow()
    })

    it('should deserialize empty NDJSON correctly', () => {
        expect((new StandardForm([{ tag: 'Asset', key: 'Test', universalKey: 'ASSET#Test' }])).toJSON()).toEqual({
            key: 'Test',
            byId: {},
            metaData: []
        })
    })

    describe('diff method', () => {
        it('should return an empty diff for identical forms', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset key=(Test) />`)
        })

        it('should return the incoming form when base is empty', () => {
            const base = new StandardForm(`<Asset key=(Test) />`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset key=(Test)><Room key=(testRoom) /></Asset>`)
        })

        it('should remove the base form components when incoming is empty', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test) />`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset key=(Test)><Remove><Room key=(testRoom) /></Remove></Asset>`)
        })

        it('should return the diff for added components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room key=(testRoom) /><Room key=(testRoomTwo) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset key=(Test)><Room key=(testRoomTwo) /></Asset>`)
        })

        it('should return the diff for removed components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom) /><Room key=(testRoomTwo) /></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset key=(Test)><Remove><Room key=(testRoomTwo) /></Remove></Asset>`)
        })

        it('should return the diff for modified components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Name>Old Name</Name></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Name>New Name</Name></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Room key=(testRoom)>
                        <Replace><Name>Old Name</Name></Replace>
                        <With><Name>New Name</Name></With>
                    </Room>
                </Asset>
            `))
        })

        it('should return the diff for added and removed components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room key=(testRoomTwo) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Remove><Room key=(testRoom) /></Remove>
                    <Room key=(testRoomTwo) />
                </Asset>
            `))
        })

        it('should return the diff for nested components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Feature key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Feature key=(testFeature) /><Feature key=(testFeatureTwo) /></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Room key=(testRoom)><Feature key=(testFeatureTwo) /></Room>
                </Asset>
            `))
        })

        it('should remove nested components properly', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Feature key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Room key=(testRoom)><Remove><Feature key=(testFeature) /></Remove></Room>
                </Asset>
            `))
        })
    })

    describe('subset method', () => {
        it('should properly subset an asset with full content without cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Example key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Example>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: ['testRoom'] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Example key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Example>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                </Asset>
            `))
        })    

        it('should properly subset an asset with exit content without cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Example key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Example>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Exit', keys: ['testRoom'] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                </Asset>
            `))
        })    

        it('should properly subset an asset with shortName content without cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Example key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Example>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'ShortName', keys: ['testRoom'] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoom)><ShortName>Test Room</ShortName></Room>
                </Asset>
            `))
        })    

        it('should properly subset an asset with stub content without cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Example key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Example>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Stub', keys: ['testRoom'] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)><Room key=(testRoom) /></Asset>
            `))
        })    

        it('should properly subset an asset with link cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <Example key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Example>
                    </Room>
                    <Feature key=(testFeature)>
                        <Example key=(base)>
                            <Description><Link to=(testFeatureTwo)>link</Link></Description>
                        </Example>
                    </Feature>
                    <Feature key=(testFeatureTwo) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: ['testRoom'], cascadeConditions: [{ conditionType: 'Link', cascadeType: 'Stub' }] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <Example key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Example>
                    </Room>
                    <Feature key=(testFeature) />
                </Asset>
            `))
        })

        it('should properly subset a chained cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <Description><Link to=(testFeature)>link</Link></Description>
                    </Room>
                    <Feature key=(testFeature)>
                        <Description><Link to=(testFeatureTwo)>link</Link></Description>
                    </Feature>
                    <Feature key=(testFeatureTwo) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: ['testRoom'], cascadeConditions: [{ conditionType: 'Link', cascadeType: 'Full', chainCascade: true }] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <Description><Link to=(testFeature)>link</Link></Description>
                    </Room>
                    <Feature key=(testFeature)>
                        <Description><Link to=(testFeatureTwo)>link</Link></Description>
                    </Feature>
                    <Feature key=(testFeatureTwo) />
                </Asset>
            `))
        })    

        it('should subset a looping chained cascade without error', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Feature key=(testFeature)>
                        <Example key=(base)>
                            <Description><Link to=(testFeatureTwo)>link</Link></Description>
                        </Example>
                    </Feature>
                    <Feature key=(testFeatureTwo)>
                        <Example key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Example>
                    </Feature>
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: ['testFeature'], cascadeConditions: [{ conditionType: 'Link', cascadeType: 'Full', chainCascade: true }] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Feature key=(testFeature)>
                        <Example key=(base)>
                            <Description><Link to=(testFeatureTwo)>link</Link></Description>
                        </Example>
                    </Feature>
                    <Feature key=(testFeatureTwo)>
                        <Example key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Example>
                    </Feature>
                </Asset>
            `))
        })    

        it('should properly subset an asset with position cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Map key=(testMap)>
                        <Room key=(testRoom)><Position x="0" y="0" /></Room>
                    </Map>
                    <Room key=(testRoom)>
                        <Example key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Example>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: ['testMap'], cascadeConditions: [{ conditionType: 'Position', cascadeType: 'Stub' }] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoom) />
                    <Map key=(testMap)>
                        <Room key=(testRoom)><Position x="0" y="0" /></Room>
                    </Map>
                </Asset>
            `))
        })

        it('should properly subset an asset with exit cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Example key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Example>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo)>
                        <Exit to=(testRoomOne)>enter</Exit>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Exit', keys: ['testRoom'], cascadeConditions: [{ conditionType: 'Exit', cascadeType: 'Exit' }] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo)><Exit to=(testRoomOne)>enter</Exit></Room>
                </Asset>
            `))
        })    

    })

    it('should round-trip all component types through NDJSON', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Image key=(testBackground) />
                <Room key=(testRoom)>
                    <ShortName>Vortex</ShortName>
                    <Example key=(base)>
                        <Name>Vortex</Name>
                        <Description>Vortex Desc</Description>
                    </Example>
                </Room>
                <Feature key=(testFeature)>
                    <Name>Clocktower</Name>
                    <Description>
                        A tower built of white sandstone blocks, with an ornate clock set on
                        the northern face.
                    </Description>
                </Feature>
                <Knowledge key=(testKnowledge)>
                    <Name>Learn</Name>
                    <Description>There is so much to know!</Description>
                </Knowledge>
                <Map key=(testMap)>
                    <Image key=(testBackground) />
                    <Room key=(testRoom)><Position x="0" y="100" /></Room>
                </Map>
                <Message key=(openDoor)><Room key=(testRoom) />The door opens!</Message>
                <Moment key=(openDoorMoment)><Message key=(openDoor) /></Moment>
                <Variable key=(open) default={false} />
                <Computed key=(closed) src={!open} />
                <Action key=(toggleOpen) src={open = !open} />
            </Asset>
        `)
        const testSource = new StandardForm(testWML)
        testSource._byId.testBackground = testSource._byId.testBackground.withUniversalKey('IMAGE#001')
        testSource._byId.testRoom = testSource._byId.testRoom.withUniversalKey('ROOM#002')
        testSource._byId["testRoom.base"] = testSource._byId["testRoom.base"].withUniversalKey('EXAMPLE#025')
        testSource._byId.testFeature = testSource._byId.testFeature.withUniversalKey('FEATURE#003')
        testSource._byId.testKnowledge = testSource._byId.testKnowledge.withUniversalKey('KNOWLEDGE#004')
        testSource._byId.testMap = testSource._byId.testMap.withUniversalKey('MAP#005')
        testSource._byId.openDoor = testSource._byId.openDoor.withUniversalKey('MESSAGE#006')
        testSource._byId.openDoorMoment = testSource._byId.openDoorMoment.withUniversalKey('MOMENT#007')
        testSource._byId.open = testSource._byId.open.withUniversalKey('VARIABLE#008')
        testSource._byId.closed = testSource._byId.closed.withUniversalKey('COMPUTED#009')
        testSource._byId.toggleOpen = testSource._byId.toggleOpen.withUniversalKey('ACTION#010')

        const ndjson = testSource.toNDJSON()
        const test = new StandardForm(ndjson)
        expect(schemaToWML([test.schema])).toEqual(testWML)
        expect(test.byId.testBackground.universalKey).toEqual('IMAGE#001')
        expect(test.byId.testRoom.universalKey).toEqual('ROOM#002')
        expect(test.byId["testRoom.base"].universalKey).toEqual('EXAMPLE#025')
        expect(test.byId.testFeature.universalKey).toEqual('FEATURE#003')
        expect(test.byId.testKnowledge.universalKey).toEqual('KNOWLEDGE#004')
        expect(test.byId.testMap.universalKey).toEqual('MAP#005')
        expect(test.byId.openDoor.universalKey).toEqual('MESSAGE#006')
        expect(test.byId.openDoorMoment.universalKey).toEqual('MOMENT#007')
        expect(test.byId.open.universalKey).toEqual('VARIABLE#008')
        expect(test.byId.closed.universalKey).toEqual('COMPUTED#009')
        expect(test.byId.toggleOpen.universalKey).toEqual('ACTION#010')
    })

    it('should group sub-components correctly in NDJSON', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Feature key=(testGlobal)>
                    <Description>Global</Description>
                </Feature>
                <Room key=(testRoom)>
                    <Feature key=(testLocal)>
                        <Name>Clocktower</Name>
                        <Description>
                            A tower built of white sandstone blocks, with an ornate clock set on
                            the northern face.
                        </Description>
                    </Feature>
                    <Feature global key=(testGlobal) />
                    <Name>Vortex</Name>
                </Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const testSource = new StandardForm(testWML)
        testSource._byId.testRoom = testSource._byId.testRoom.withUniversalKey('ROOM#001')
        testSource._byId.testRoomTwo = testSource._byId.testRoomTwo.withUniversalKey('ROOM#002')
        testSource._byId.testGlobal = testSource._byId.testGlobal.withUniversalKey('FEATURE#003')
        testSource._byId["testRoom.testLocal"] = testSource._byId["testRoom.testLocal"].withUniversalKey('FEATURE#004')

        const ndjson = testSource.toNDJSON()
        expect(ndjson).toEqual([
            { tag: 'Asset', key: 'test', universalKey: 'ASSET#test' },
            {
                tag: 'Room',
                key: 'testRoom',
                universalKey: 'ROOM#001',
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] },
                features: [{ key: 'testLocal', tag: 'Feature' }, { key: 'testGlobal', global: true, tag: 'Feature' }],
                exits: [],
                themes: []
            },
            {
                tag: 'Feature',
                key: 'testRoom.testLocal',
                universalKey: 'FEATURE#004',
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'A tower built of white sandstone blocks, with an ornate clock set on the northern face.' }, children: [] }] },
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Clocktower' }, children: [] }] }
            },
            { tag: 'Room', key: 'testRoomTwo', universalKey: 'ROOM#002', exits: [], themes: [] },
            {
                tag: 'Feature',
                key: 'testGlobal',
                universalKey: 'FEATURE#003',
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Global' }, children: [] }] }
            }
        ])
    })

    it('should round-trip imports through NDJSON', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Import from=(testImport)><Room key=(testIn) as=(testRoom) /></Import>
                <Room key=(testRoom)><ShortName>Test</ShortName></Room>
            </Asset>
        `)
        const testSource = new StandardForm(testWML)
        const test = new StandardForm(testSource.toNDJSON())
        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    it('should round-trip unchanged imports through NDJSON', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Import from=(testImport)><Room key=(testIn) as=(testRoom) /></Import>
            </Asset>
        `)
        const testSource = new StandardForm(testWML)
        const test = new StandardForm(testSource.toNDJSON())
        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    it('should round-trip exports through NDJSON', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoom)><ShortName>Test</ShortName></Room>
                <Export><Room key=(testRoom) as=(Room3) /></Export>
            </Asset>
        `)
        const testSource = new StandardForm(testWML)
        const test = new StandardForm(testSource.toNDJSON())
        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    // it('should filter correctly', () => {
    //     const inheritedSource = deIndentWML(`
    //         <Asset key=(Test)>
    //             <Inherited>
    //                 <Room key=(testRoomOne)>
    //                     <Name>Lobby</Name>
    //                     <Description>A plain lobby.</Description>
    //                 </Room>
    //             </Inherited>
    //         </Asset>
    //     `)
    //     const inheritedSchema = new Schema()
    //     inheritedSchema.loadWML(inheritedSource)
    //     const testSource = deIndentWML(`
    //         <Asset key=(Test)>
    //             <Room key=(testRoomOne)>
    //                 <Name><Space />(at night)</Name>
    //                 <Description><Space />Shadows cling to the corners of the room.</Description>
    //             </Room>
    //         </Asset>
    //     `)
    //     const testSchema = new Schema()
    //     testSchema.loadWML(testSource)
    //     const standardizer = new Standardizer(inheritedSchema.schema, testSchema.schema)
    //     expect(schemaToWML(standardizer.filter({ not: { match: 'Inherited' }}).schema)).toEqual(deIndentWML(`
    //         <Asset key=(Test)>
    //             <Room key=(testRoomOne)>
    //                 <Name><Space />(at night)</Name>
    //                 <Description>
    //                     <Space />Shadows cling to the corners of the room.
    //                 </Description>
    //             </Room>
    //         </Asset>
    //     `))
    //     expect(schemaToWML(standardizer.filter({ match: 'Inherited' }).schema)).toEqual(deIndentWML(`
    //         <Asset key=(Test)>
    //             <Room key=(testRoomOne)>
    //                 <Name><Inherited>Lobby</Inherited></Name>
    //                 <Description><Inherited>A plain lobby.</Inherited></Description>
    //             </Room>
    //         </Asset>
    //     `))
    // })

    // it('should prune correctly', () => {
    //     const inheritedSource = deIndentWML(`
    //         <Asset key=(Test)>
    //             <Inherited>
    //                 <Room key=(testRoomOne)>
    //                     <Name>Lobby</Name>
    //                     <Description>A plain lobby.</Description>
    //                 </Room>
    //             </Inherited>
    //         </Asset>
    //     `)
    //     const inheritedSchema = new Schema()
    //     inheritedSchema.loadWML(inheritedSource)
    //     const inheritedStandard = new Standardizer(inheritedSchema.schema)
    //     expect(schemaToWML(inheritedStandard.prune({ match: 'Inherited' }).schema)).toEqual(deIndentWML(`
    //         <Asset key=(Test)>
    //             <Room key=(testRoomOne)>
    //                 <Name>Lobby</Name>
    //                 <Description>A plain lobby.</Description>
    //             </Room>
    //         </Asset>
    //     `))
    // })

    // it('should assign dependencies correctly', () => {
    //     const extract = () => ['Test']
    //     const testSource = deIndentWML(`
    //         <Asset key=(Test)>
    //             <Room key=(testRoomOne)>
    //                 <Name>Unconditioned<If {testVar}>Conditioned</If></Name>
    //             </Room>
    //             <Variable key=(testVar) default={true} />
    //         </Asset>
    //     `)
    //     const test = schemaTestStandarized(testSource)
    //     test.assignDependencies(extract)
    //     expect(test.standardForm.byId.testRoomOne).toEqual({
    //         tag: 'Room',
    //         key: 'testRoomOne',
    //         shortName: { data: { tag: 'ShortName' }, children: [] },
    //         name: {
    //             data: { tag: 'Name' },
    //             children: [
    //                 { data: { tag: 'String', value: 'Unconditioned' }, children: [] },
    //                 {
    //                     data: { tag: 'If' },
    //                     children: [{
    //                         data: { tag: 'Statement', if: 'testVar', dependencies: ['Test'], selected: false },
    //                         children: [{ data: { tag: 'String', value: 'Conditioned' }, children: [] }]
    //                     }]
    //                 }
    //             ]
    //         },
    //         summary: { data: { tag: 'Summary' }, children: [] },
    //         description: { data: { tag: 'Description' }, children: [] },
    //         exits: [],
    //         themes: []
    //     })
    // })

    describe('renameKey', () => {
        it('should retarget links to the renamed key', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Feature key=(testFeatureOne)>
                        <Description>
                            <Link to=(testFeatureOne)>self link</Link>
                            <Link to=(testFeatureTwo)>other link</Link>
                        </Description>
                    </Feature>
                    <Feature key=(testFeatureTwo)>
                        <Description><Link to=(testFeatureOne)>back link</Link></Description>
                    </Feature>
                </Asset>
            `)
            expect(schemaToWML([test.renameKey([{ fromKey: 'testFeatureOne', toKey: 'renamedFeature' }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Feature key=(renamedFeature)>
                        <Description>
                            <Link to=(renamedFeature)>self link</Link>
                            <Link to=(testFeatureTwo)>other link</Link>
                        </Description>
                    </Feature>
                    <Feature key=(testFeatureTwo)>
                        <Description><Link to=(renamedFeature)>back link</Link></Description>
                    </Feature>
                </Asset>
            `))
        })

        it('should retarget exits to the renamed key', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoomOne)><Exit to=(testRoomTwo)>exit</Exit></Room>
                    <Room key=(testRoomTwo)><Exit to=(testRoomOne)>enter</Exit></Room>
                </Asset>
            `)
            expect(schemaToWML([test.renameKey([{ fromKey: 'testRoomOne', toKey: 'renamedRoom' }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(renamedRoom)><Exit to=(testRoomTwo)>exit</Exit></Room>
                    <Room key=(testRoomTwo)><Exit to=(renamedRoom)>enter</Exit></Room>
                </Asset>
            `))
        })

        it('should retarget map positions to the renamed key', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoomOne) />
                    <Map key=(testMapOne)>
                        <Room key=(testRoomOne)><Position x="100" y="100" /></Room>
                    </Map>
                </Asset>
            `)
            expect(schemaToWML([test.renameKey([{ fromKey: 'testRoomOne', toKey: 'renamedRoom' }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(renamedRoom) />
                    <Map key=(testMapOne)>
                        <Room key=(renamedRoom)><Position x="100" y="100" /></Room>
                    </Map>
                </Asset>
            `))
        })

        it('should eliminate exportAs when renamed to same key', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoomOne) />
                    <Export><Room key=(testRoomOne) as=(renamedRoom) /></Export>
                </Asset>
            `)
            expect(schemaToWML([test.renameKey([{ fromKey: 'testRoomOne', toKey: 'renamedRoom' }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)><Room key=(renamedRoom) /></Asset>
            `))
        })

        it('should retain old exportAs when specified', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoomOne) />
                </Asset>
            `)
            expect(schemaToWML([test.renameKey([{ fromKey: 'testRoomOne', toKey: 'renamedRoom', retainOldExportAs: true }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(renamedRoom) />
                    <Export><Room key=(renamedRoom) as=(testRoomOne) /></Export>
                </Asset>
            `))
        })

        it('should throw on collision', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoomOne) />
                    <Room key=(testRoomTwo) />
                </Asset>
            `)
            expect(() => (test.renameKey([{ fromKey: 'testRoomOne', toKey: 'testRoomTwo', retainOldExportAs: true }]))).toThrow()
        })

        it('should swap two keys without collision', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoomOne)>
                        <Description>Test One <Link to=(testRoomTwo)>link</Link></Description>
                    </Room>
                    <Room key=(testRoomTwo)>
                        <Description>Test Two <Link to=(testRoomOne)>link</Link></Description>
                    </Room>
                </Asset>
            `)
            expect(schemaToWML([
                test.renameKey([
                    { fromKey: 'testRoomOne', toKey: 'testRoomTwo' },
                    { fromKey: 'testRoomTwo', toKey: 'testRoomOne' }
                ]).schema
            ])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoomOne)>
                        <Description>Test Two <Link to=(testRoomTwo)>link</Link></Description>
                    </Room>
                    <Room key=(testRoomTwo)>
                        <Description>Test One <Link to=(testRoomOne)>link</Link></Description>
                    </Room>
                </Asset>
            `))
        })

    })

})
