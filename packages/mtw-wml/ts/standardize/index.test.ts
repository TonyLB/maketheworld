import { Schema, schemaToWML } from '../schema'
import { StandardForm, defaultSelected } from '.'
import { deIndentWML } from '../schema/utils'
import { GenericTree, GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from './components/room'
import { ExportItemContent, ImportItemContent } from './components/metaData'

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
                    <Example key=(base)>
                        <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                        <ElseIf {false} selected><Exit to=(GHI)>Test Exit</Exit></ElseIf>
                    </Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(defaultSelected(schemaTest(testWML)))).toEqual(testWML)
    })

    it('should not add default select when no fallthrough', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <Example key=(base)>
                        <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                        <ElseIf {false}><Exit to=(GHI)>Test Exit</Exit></ElseIf>
                    </Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(defaultSelected(schemaTest(testWML)))).toEqual(testWML)
    })

    it('should add default select on fallthrough when available', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <Example key=(base)>
                        <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                        <Else><Exit to=(GHI)>Test Exit</Exit></Else>
                    </Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(defaultSelected(schemaTest(testWML)))).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <Example key=(base)>
                        <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                        <Else selected><Exit to=(GHI)>Test Exit</Exit></Else>
                    </Example>
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
                        exits: []
                    },
                    payload: {
                        tag: 'Room',
                        key: 'testRoom',
                        exits: [{ data: { tag: 'Exit', from: 'testRoom', to: 'testRoomTwo', key: 'testRoom#testRoomTwo' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }],
                    }
                },
                testRemove: {
                    tag: 'Remove',
                    key: 'testRoomTwo',
                    component: {
                        tag: 'Room',
                        key: 'testRoomTwo',
                        exits: []
                    }
                }
            }
        })
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Replace><Room key=(testRoom) /></Replace>
                <With><Room key=(testRoom)><Exit to=(testRoomTwo)>out</Exit></Room></With>
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
                        data: { tag: 'Example', key: 'base' },
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
                            }]    
                        }]
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
                        { data: { tag: 'ReplaceMatch' }, children: [{ data: { tag: 'Room', key: 'testRoomReplace' }, children: [{ data: { tag: 'Example', key: 'base' }, children: [{ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] }] }] }] },
                        { data: { tag: 'ReplacePayload' }, children: [{ data: { tag: 'Room', key: 'testRoomReplace' }, children: [{ data: { tag: 'Example', key: 'base' }, children: [{ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Changed' }, children: [] }] }] }] }] }
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
                    examples: [{ key: 'base', tag: 'Example' }],
                    exits: [{
                        data: { tag: 'Remove' },
                        children: [{ data: { tag: 'Exit', from: 'testRoom', to: 'testDestination', key: 'testRoom#testDestination' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }]
                    }]
                },
                'testRoom.base': {
                    tag: 'Example',
                    key: 'testRoom.base',
                    name: [{
                        data: { tag: 'Replace' },
                        children: [{
                            data: { tag: 'ReplaceMatch' },
                            children: ['Lobby']
                        },
                        {
                            data: { tag: 'ReplacePayload' },
                            children: ['Foyer']
                        }]
                    }]
                },
                testRoomRemove: {
                    tag: 'Remove',
                    key: 'testRoomRemove',
                    component: {
                        tag: 'Room',
                        key: 'testRoomRemove',
                        exits: []
                    }
                },
                testRoomReplace: {
                    tag: 'Replace',
                    key: 'testRoomReplace',
                    match: {
                        tag: 'Room',
                        key: 'testRoomReplace',
                        examples: [{ key: 'base', tag: 'Example' }],
                        exits: []
                    },
                    payload: {
                        tag: 'Room',
                        key: 'testRoomReplace',
                        examples: [{ key: 'base', tag: 'Example' }],
                        exits: []
                    }
                },
                'testRoomReplace.base': {
                    tag: 'Replace',
                    key: 'testRoomReplace.base',
                    match: {
                        tag: 'Example',
                        key: 'testRoomReplace.base',
                        name: ['Name Test']
                    },
                    payload: {
                        tag: 'Example',
                        key: 'testRoomReplace.base',
                        name: ['Name Changed']
                    }
                }
            }
        })
    })

    it('should accept meta tags', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Meta key=(ABC) time="1234" />
            <Room key=(testRoom)>
                <Example key=(base)>
                    <Description>Test Description</Description>
                </Example>
            </Room>
        </Asset>`)

        expect(test.toJSON()).toEqual({
            key: 'Test',
            metaData: [{ data: { tag: 'Meta', key: 'ABC', time: 1234 }, children: [] }],
            byId: {
                testRoom: {
                    tag: 'Room',
                    key: 'testRoom',
                    examples: [{ key: 'base', tag: 'Example' }],
                    exits: [],
                },
                'testRoom.base': {
                    tag: 'Example',
                    key: 'testRoom.base',
                    description: ['Test Description']
                }
            }
        })
    })

    it('should accept parsed schema', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Example key=(base)>
                        <Name>Test Room</Name>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Example>
                </Room>
                <Feature key=(testFeature)>
                    <Example key=(base)><Description>Four</Description></Example>
                </Feature>
            </Asset>
        `)
        const schema = new Schema()
        schema.loadWML(testSource)
        const test = new StandardForm(schema.schema[0])
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

    it('should ignore authorization tags', () => {
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Grant player=(testPlayer) actions="test" />
                    <Example key=(base)>
                        <Description>
                            One
                            <br />
                        </Description>
                    </Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Example key=(base)><Description>One<br /></Description></Example>
                </Room>
            </Asset>
        `))
    })

    it('should properly nest components in a removed component', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Remove><Room key=(testRoom)><Feature key=(testFeature) /></Room></Remove>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
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
                    <Example key=(base)>
                        <Description><If {false}>Four</If></Description>
                    </Example>
                </Feature>
            </Asset>
        `))
    })

    it('should combine exits in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Example key=(base)>
                    <Description>
                        One
                        <br />
                    </Description>
                </Example>
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
                    <Example key=(base)><Description>One<br /></Description></Example>
                    <If {false}><Exit to=(testTwo)>Test Exit</Exit></If>
                </Room>
                <Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>
            </Asset>
        `))
    })

    it('should correctly return JSON for features nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Example key=(base)><Description>One</Description></Example>
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
                    examples: [{ key: 'base', tag: 'Example' }],
                    exits: [],
                    features: [
                        { tag: 'Feature', key: 'testLocal' },
                        { tag: 'Feature', global: true, key: 'testGlobal' }
                    ]
                },
                'test.base': {
                    tag: 'Example',
                    key: 'test.base',
                    description: ['One']
                },
                ['test.testLocal']: {
                    tag: 'Feature',
                    key: 'test.testLocal',
                    examples: [{ key: 'base', tag: 'Example' }]
                },
                ['test.testLocal.base']: {
                    tag: 'Example',
                    key: 'test.testLocal.base',
                    description: ['Local']
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
                    description: ['Global']
                },
                testTwo: {
                    tag: 'Room',
                    key: 'testTwo',
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
                    exits: [],
                    examples: [{ tag: 'Example', key: 'testLocal' }]
                },
                ['test.testLocal']: {
                    tag: 'Example',
                    key: 'test.testLocal',
                    description: ['Description Test']
                },
                testTwo: {
                    tag: 'Room',
                    key: 'testTwo',
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
                    description: ['Description Test']
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
                    description: ['Description Test']
                },
                testTwo: {
                    tag: 'Room',
                    key: 'testTwo',
                    exits: []
                }
            }
        })
    })

    it('should correctly return schema for features nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Feature key=(testLocal)>
                    <Example key=(base)>
                        <Description>Local</Description>
                    </Example>
                </Feature>
                <Feature global key=(testGlobal)>
                    <Example key=(base)>
                        <Description>Global</Description>
                    </Example>
                </Feature>
                <Example key=(base)><Description>One</Description></Example>
            </Room>
            <Room key=(testTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Feature key=(testLocal)>
                        <Example key=(base)><Description>Local</Description></Example>
                    </Feature>
                    <Feature global key=(testGlobal) />
                    <Example key=(base)><Description>One</Description></Example>
                </Room>
                <Room key=(testTwo) />
                <Feature key=(testGlobal)>
                    <Example key=(base)><Description>Global</Description></Example>
                </Feature>
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
                <Example key=(base)>
                    <Description>
                        One
                        <br />
                    </Description>
                </Example>
            </Room>
            <Room key=(testTwo) />
            <Message key=(testMessage)>
                Test message
                <Room key=(test)>
                    <Example key=(base)>
                        <Description>
                            Two
                        </Description>
                    </Example>
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
                    <Example key=(base)><Description>One<br />Two</Description></Example>
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
                <Example key=(base)>
                    <Description>
                        <Link to=(testFeatureOne)>test</Link>
                    </Description>
                </Example>
            </Room>
            <Feature key=(testFeatureOne)>
                <Example key=(base)>
                    <Name>TestOne</Name>
                    <Description><Link to=(testFeatureTwo)>two</Link></Description>
                </Example>
            </Feature>
            <Feature key=(testFeatureTwo)>
                <Example key=(base)>
                    <Name>TestTwo</Name>
                    <Description>Test</Description>
                </Example>
            </Feature>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Example key=(base)>
                        <Description><Link to=(testFeatureOne)>test</Link></Description>
                    </Example>
                </Room>
                <Feature key=(testFeatureOne)>
                    <Example key=(base)>
                        <Name>TestOne</Name>
                        <Description><Link to=(testFeatureTwo)>two</Link></Description>
                    </Example>
                </Feature>
                <Feature key=(testFeatureTwo)>
                    <Example key=(base)>
                        <Name>TestTwo</Name>
                        <Description>Test</Description>
                    </Example>
                </Feature>
            </Asset>
        `))
    })

    it('should render knowledge correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room key=(test)>
                <Example key=(base)>
                    <Description>
                        <Link to=(testKnowledgeOne)>test</Link>
                    </Description>
                </Example>
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
                    <Example key=(base)>
                        <Description><Link to=(testKnowledgeOne)>test</Link></Description>
                    </Example>
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

    it('should render maps correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Map key=(testMap)>
                <Name>Test map</Name>
                <Room key=(testRoomOne)>
                    <Position x="0" y="0" />
                    <Example key=(base)>
                        <Description>Test Room One</Description>
                    </Example>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <If {false}>
                    <Room key=(testRoomOne) />
                    <Room key=(testRoomTwo)>
                        <Position x="-100" y="0" />
                        <Example key=(base)>
                            <Description>Test Room Two</Description>
                        </Example>
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
                    <Example key=(base)><Description>Test Room One</Description></Example>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room key=(testRoomThree) />
                <Room key=(testRoomTwo)>
                    <Example key=(base)>
                        <Description><If {false}>Test Room Two</If></Description>
                    </Example>
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

    it('should render messages correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Message key=(testMessage)>
                Test message
                <Room key=(testRoomOne)>
                    <Example key=(base)>
                        <Description>Test Room One</Description>
                    </Example>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room key=(testRoomTwo)>
                    <Example key=(base)>
                        <Description>Test Room Two</Description>
                    </Example>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
            </Message>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Example key=(base)><Description>Test Room One</Description></Example>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room key=(testRoomTwo)>
                    <Example key=(base)><Description>Test Room Two</Description></Example>
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
                        <Example key=(base)><Description>Test Room One</Description></Example>
                        <Exit to=(testRoomTwo)>two</Exit>
                    </Room>
                </Message>
            </Moment>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Example key=(base)><Description>Test Room One</Description></Example>
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
                <Example key=(base)><Description>Test Room One</Description></Example>
                <Exit to=(testRoomTwo)>two</Exit>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Example key=(base)><Description>Test Room One</Description></Example>
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
                    <Example key=(base)><Description>Test Room One</Description></Example>
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
                    <Example key=(base)><Description>Test Room One</Description></Example>
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
            tag: 'Room'
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
                <Remove>
                    <Room key=(testRoomTwo)>
                        <Example key=(base)><Name>Test To Delete</Name></Example>
                    </Room>
                </Remove>
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
                    <OneCoolThing>Fuchsia eyes</OneCoolThing>
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
                    <Example key=(base)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Example>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Example key=(base)>
                        <Replace><Name>Lobby</Name></Replace>
                        <With><Name>Darkened lobby</Name></With>
                    </Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Example key=(base)>
                        <Name>Darkened lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Example>
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
                <Replace><Room key=(testRoomOne)><Example key=(base)><Name>Lobby</Name></Example></Room></Replace>
                <With><Room key=(testRoomOne)><Example key=(base)><Name>Changed</Name></Example></Room></With>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Remove>
                    <Room key=(testRoomOne)><Example key=(base)><Name>Changed</Name></Example></Room>
                </Remove>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Remove>
                    <Room key=(testRoomOne)>
                        <Example key=(base)><Name>Lobby</Name></Example>
                    </Room>
                </Remove>
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
                    <Room key=(testRoomOne)><Example key=(base)><Name>Lobby</Name></Example></Room>
                </Remove>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Remove>
                    <Room key=(testRoomOne)>
                        <Example key=(base)><Name>Lobby</Name></Example>
                    </Room>
                </Remove>
                <Room key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component replace of plain base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>                
                <Room key=(testRoomOne)>
                    <Example key=(base)><Name>Test</Name></Example>
                </Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace>
                        <Example key=(base)><Name>Test</Name></Example>
                    </Replace>
                    <With>
                        <Example key=(base)><Name>Changed</Name></Example>
                    </With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Example key=(base)><Name>Changed</Name></Example>
                </Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component replace of replace base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace>
                        <Example key=(base)><Name>Lobby</Name></Example>
                    </Replace>
                    <With>
                        <Example key=(base)><Name>Changed</Name></Example>
                    </With>
                </Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace>
                        <Example key=(base)><Name>Changed</Name></Example>
                    </Replace>
                    <With>
                        <Example key=(base)><Name>Changed again</Name></Example>
                    </With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace><Example key=(base)><Name>Lobby</Name></Example></Replace>
                    <With><Example key=(base)><Name>Changed again</Name></Example></With>
                </Room>
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
                <Room key=(testRoomOne)>
                    <Replace>
                        <Example key=(base)><Name>Lobby</Name></Example>
                    </Replace>
                    <With>
                        <Example key=(base)><Name>Changed</Name></Example>
                    </With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace><Example key=(base)><Name>Lobby</Name></Example></Replace>
                    <With><Example key=(base)><Name>Changed</Name></Example></With>
                </Room>
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
                    <Example key=(base)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Example>
                </Room>
                <Room key=(testRoomTwo)>
                    <Example key=(base)><Name>Test Two</Name></Example>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Example key=(base)>
                        <Name><Space />(at night)</Name>
                        <Description><Space />Shadows cling to the corners of the room.</Description>
                    </Example>
                </Room>
                <Room key=(testRoomThree)>
                    <Example key=(base)><Name>Test Three</Name></Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Example key=(base)>
                        <Name>Lobby (at night)</Name>
                        <Description>
                            A plain lobby. Shadows cling to the corners of the room.
                        </Description>
                    </Example>
                </Room>
                <Room key=(testRoomThree)>
                    <Example key=(base)><Name>Test Three</Name></Example>
                </Room>
                <Room key=(testRoomTwo)>
                    <Example key=(base)><Name>Test Two</Name></Example>
                </Room>
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
                    <Example key=(base)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Example>
                </Room>
                <Room key=(testRoomTwo)>
                    <Example key=(base)><Name>Test Two</Name></Example>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Import from=(primitives)>
                    <Room key=(testRoomThree) />
                </Import>
                <Room key=(testRoomOne)>
                    <Example key=(base)>
                        <Name><Space />(at night)</Name>
                        <Description><Space />Shadows cling to the corners of the room.</Description>
                    </Example>
                </Room>
                <Room key=(testRoomThree)>
                    <Example key=(base)><Name>Test Three</Name></Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(primitives)>
                    <Room key=(testRoomOne) />
                    <Room key=(testRoomThree) />
                </Import>
                <Room key=(testRoomOne)>
                    <Example key=(base)>
                        <Name>Lobby (at night)</Name>
                        <Description>
                            A plain lobby. Shadows cling to the corners of the room.
                        </Description>
                    </Example>
                </Room>
                <Room key=(testRoomThree)>
                    <Example key=(base)><Name>Test Three</Name></Example>
                </Room>
                <Room key=(testRoomTwo)>
                    <Example key=(base)><Name>Test Two</Name></Example>
                </Room>
            </Asset>
        `))
    })

    it('should merge edited metadata correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Import from=(primitives)>
                    <Room key=(testRoomOne) />
                </Import>
                <Room key=(testRoomOne)>
                    <Example key=(base)><Name>Test</Name></Example>
                </Room>
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
                <Room key=(testRoomOne)>
                    <Example key=(base)><Name>Test</Name></Example>
                </Room>
            </Asset>
        `))
    })

    it('should merge multiple serializable standardComponents correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Example key=(base)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Example>
                </Room>
                <Room key=(testRoomTwo)>
                    <Example key=(base)><Name>Test Two</Name></Example>
                </Room>
            </Asset>
        `)
        const testStandard = new StandardForm({
            key: 'Test',
            byId: {
                testRoomOne: {
                    tag: 'Room',
                    key: 'testRoomOne',
                    examples: [{ key: 'base', tag: 'Example' }],
                    exits: [],
                },
                'testRoomOne.base': {
                    tag: 'Example',
                    key: 'testRoomOne.base',
                    name: [{ data: { tag: 'String', value: ': Night' }, children: [] }],
                },
            },
            metaData: []
        })
        const standardizer = inherited.merge(testStandard)
        expect(schemaToWML([standardizer.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Example key=(base)>
                        <Name>Lobby: Night</Name>
                        <Description>A plain lobby.</Description>
                    </Example>
                </Room>
                <Room key=(testRoomTwo)>
                    <Example key=(base)><Name>Test Two</Name></Example>
                </Room>
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
        const base = new StandardRoom(deIndentWML(`<Room key=(test)><Example key=(one) /></Room>`)).withUniversalKey('ROOM#001')
        const incoming = new StandardRoom(deIndentWML(`<Room key=(test)><Example key=(two) /></Room>`))
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('ROOM#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Room key=(test)>
                    <Example key=(one) />
                    <Example key=(two) />
                </Room>
            `))
        }
    })

    it('should merge incoming component with universalKey', () => {
        const base = new StandardRoom(deIndentWML(`<Room key=(test)><Example key=(one) /></Room>`))
        const incoming = new StandardRoom(deIndentWML(`<Room key=(test)><Example key=(two) /></Room>`)).withUniversalKey('ROOM#001')
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('ROOM#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Room key=(test)>
                    <Example key=(one) />
                    <Example key=(two) />
                </Room>
            `))
        }
    })

    it('should merge identical universalKeys', () => {
        const base = new StandardRoom(deIndentWML(`<Room key=(test)><Example key=(one) /></Room>`)).withUniversalKey('ROOM#001')
        const incoming = new StandardRoom(deIndentWML(`<Room key=(test)><Example key=(two) /></Room>`)).withUniversalKey('ROOM#001')
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('ROOM#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Room key=(test)>
                    <Example key=(one) />
                    <Example key=(two) />
                </Room>
            `))
        }
    })

    it('should throw error on conflicting universalKeys', () => {
        const base = new StandardRoom(deIndentWML(`<Room key=(test) />`)).withUniversalKey('ROOM#001')
        const incoming = new StandardRoom(deIndentWML(`<Room key=(test) />`)).withUniversalKey('ROOM#002')
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
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Example key=(base)><Name>Old Name</Name></Example></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Example key=(base)><Name>New Name</Name></Example></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Room key=(testRoom)>
                        <Example key=(base)>
                            <Replace><Name>Old Name</Name></Replace>
                            <With><Name>New Name</Name></With>
                        </Example>
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

        it('should return the diff for nested feature components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Feature key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Feature key=(testFeature) /><Feature key=(testFeatureTwo) /></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Room key=(testRoom)><Feature key=(testFeatureTwo) /></Room>
                </Asset>
            `))
        })

        it('should return the diff for nested example components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Example key=(Example1) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Example key=(Example1) /><Example key=(Example2) /></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Room key=(testRoom)><Example key=(Example2) /></Room>
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

        it('should remove components with nested components properly', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room key=(testRoom)><Feature key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test) />`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Remove><Room key=(testRoom)><Feature key=(testFeature) /></Room></Remove>
                </Asset>
            `))
        })

        it('should diff a rename correctly', () => {
            const base = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(Room1)><Exit to=(Room2)>text</Exit></Room>
                    <Room key=(Room2)>
                        <Example key=(base)><Name>Garden</Name></Example>
                    </Room>
                </Asset>
            `)
            const incoming = base.renameKey([{ fromKey: 'Room2', toKey: 'garden' }])
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(garden)><Example key=(base)><Name>Garden</Name></Example></Room>
                    <Room key=(Room1)>
                        <Remove><Exit to=(Room2)>text</Exit></Remove>
                        <Exit to=(garden)>text</Exit>
                    </Room>
                    <Remove>
                        <Room key=(Room2)>
                            <Example key=(base)><Name>Garden</Name></Example>
                        </Room>
                    </Remove>
                </Asset>
            `))
        })

        it('should diff an import change correctly', () => {
            const base = new StandardForm(`
                <Asset key=(test)>
                    <Import from=(base)><Room key=(Room1) /></Import>
                </Asset>
            `)
            const incoming = base._clone()
            incoming._byId['Room1'] = incoming._byId['Room1'].withImport(new ImportItemContent('base', 'testRoom'))
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Import from=(base)>
                        <Replace><Room key=(Room1) /></Replace>
                        <With><Room key=(testRoom) as=(Room1) /></With>
                    </Import>
                    <Room key=(Room1) />
                </Asset>
            `))
        })

        it('should diff an export change correctly', () => {
            const base = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(Room1) />
                    <Export><Room key=(Room1) as=(testOne) /></Export>
                </Asset>
            `)
            const incoming = base._clone()
            incoming._byId['Room1'] = incoming._byId['Room1'].withExport(new ExportItemContent('testTwo'))
            console.log(`incoming: ${schemaToWML([incoming.schema])}`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(Room1) />
                    <Export>
                        <Replace><Room key=(Room1) as=(testOne) /></Replace>
                        <With><Room key=(Room1) as=(testTwo) /></With>
                    </Export>
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
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: ['testRoom'], cascadeConditions: [{ conditionType: 'Link', cascadeType: 'Full', chainCascade: true }] }]).schema])).toEqual(deIndentWML(`
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
                    <Example key=(base)>
                        <Name>Clocktower</Name>
                        <Description>
                            A tower built of white sandstone blocks, with an ornate clock
                            set on the northern face.
                        </Description>
                    </Example>
                </Feature>
                <Knowledge key=(testKnowledge)>
                    <Example key=(base)>
                        <Name>Learn</Name>
                        <Description>There is so much to know!</Description>
                    </Example>
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

    it('should group sub-components correctly in JSON', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Feature key=(testGlobal)>
                    <Example key=(base)>
                        <Description>Global</Description>
                    </Example>
                </Feature>
                <Room key=(testRoom)>
                    <Feature key=(testLocal)>
                        <Example key=(base)>
                            <Name>Clocktower</Name>
                            <Description>
                                A tower built of white sandstone blocks, with an ornate clock set on
                                the northern face.
                            </Description>
                        </Example>
                    </Feature>
                    <Feature global key=(testGlobal) />
                    <Example key=(base)>
                        <Name>Vortex</Name>
                    </Example>
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
                features: [{ key: 'testLocal', tag: 'Feature' }, { key: 'testGlobal', global: true, tag: 'Feature' }],
                examples: [{ key: 'base', tag: 'Example'}],
                exits: []
            },
            {
                tag: 'Example',
                key: 'testRoom.base',
                name:['Vortex']
            },
            {
                tag: 'Feature',
                key: 'testRoom.testLocal',
                examples: [{ key: 'base', tag: 'Example' }],
                universalKey: 'FEATURE#004'
            },
            {
                tag: 'Example',
                key: 'testRoom.testLocal.base',
                description: ['A tower built of white sandstone blocks, with an ornate clock set on the northern face.'],
                name: ['Clocktower']
            },
            { tag: 'Room', key: 'testRoomTwo', universalKey: 'ROOM#002', exits: [] },
            {
                tag: 'Feature',
                key: 'testGlobal',
                universalKey: 'FEATURE#003',
                examples: [{ key: 'base', tag: 'Example' }]
            },
            {
                tag: 'Example',
                key: 'testGlobal.base',
                description: ['Global']
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


    describe('renameKey', () => {
        it('should retarget links to the renamed key', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Feature key=(testFeatureOne)>
                        <Example key=(base)>
                            <Description>
                                <Link to=(testFeatureOne)>self link</Link>
                                <Link to=(testFeatureTwo)>other link</Link>
                            </Description>
                        </Example>
                    </Feature>
                    <Feature key=(testFeatureTwo)>
                        <Example key=(base)>
                            <Description><Link to=(testFeatureOne)>back link</Link></Description>
                        </Example>
                    </Feature>
                </Asset>
            `)
            expect(schemaToWML([test.renameKey([{ fromKey: 'testFeatureOne', toKey: 'renamedFeature' }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Feature key=(renamedFeature)>
                        <Example key=(base)>
                            <Description>
                                <Link to=(renamedFeature)>self link</Link>
                                <Link to=(testFeatureTwo)>other link</Link>
                            </Description>
                        </Example>
                    </Feature>
                    <Feature key=(testFeatureTwo)>
                        <Example key=(base)>
                            <Description>
                                <Link to=(renamedFeature)>back link</Link>
                            </Description>
                        </Example>
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
                        <Example key=(base)>
                            <Description>Test One <Link to=(testRoomTwo)>link</Link></Description>
                        </Example>
                    </Room>
                    <Room key=(testRoomTwo)>
                        <Example key=(base)>
                            <Description>Test Two <Link to=(testRoomOne)>link</Link></Description>
                        </Example>
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
                        <Example key=(base)>
                            <Description>
                                Test Two <Link to=(testRoomTwo)>link</Link>
                            </Description>
                        </Example>
                    </Room>
                    <Room key=(testRoomTwo)>
                        <Example key=(base)>
                            <Description>
                                Test One <Link to=(testRoomOne)>link</Link>
                            </Description>
                        </Example>
                    </Room>
                </Asset>
            `))
        })

    })

})
