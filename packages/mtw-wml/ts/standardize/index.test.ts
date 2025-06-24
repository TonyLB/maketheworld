import { Schema, schemaToWML } from '../schema'
import { StandardForm, defaultSelected } from '.'
import { deIndentWML } from '../schema/utils'
import { GenericTree, GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from './components/room'
import StandardCharacter from './components/character'
import { StandardKey } from './components/reference'
import StandardFeature from './components/feature'
jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})


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
            components: [
                {
                    tag: 'Replace',
                    key: 'testRoom',
                    universalKey: 'ROOM#testRoom',
                    match: {
                        tag: 'Room',
                        key: 'testRoom',
                        universalKey: 'ROOM#testRoom',
                        exits: []
                    },
                    payload: {
                        tag: 'Room',
                        key: 'testRoom',
                        exits: [{ data: { tag: 'Exit', from: 'testRoom', to: 'testRoomTwo', key: 'testRoom#testRoomTwo' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }],
                    }
                },
                {
                    tag: 'Remove',
                    key: 'testRoomTwo',
                    universalKey: 'ROOM#testRoomTwo',
                    component: {
                        tag: 'Room',
                        key: 'testRoomTwo',
                        universalKey: 'ROOM#testRoomTwo',
                        exits: []
                    }
                }
            ]
        })
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Replace><Room uuid=(testRoom) key=(testRoom) /></Replace>
                <With><Room key=(testRoom)><Exit to=(testRoomTwo)>out</Exit></Room></With>
                <Remove><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Remove>
            </Asset>
        `))
    })

    it('should accept edit tags', () => {
        const test: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Asset', key: 'Test', Story: undefined },
            children: [
                {
                    data: { tag: 'Room', key: 'testRoom', uuid: 'ROOM#testRoom' },
                    children: [{
                        data: { tag: 'Example', uuid: 'EXAMPLE#testRoomBase' },
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
                { data: { tag: 'Remove' }, children: [{ data: { tag: 'Room', key: 'testRoomRemove', uuid: 'ROOM#testRoomRemove' }, children: [] }] },
                {
                    data: { tag: 'Replace' },
                    children: [
                        { data: { tag: 'ReplaceMatch' }, children: [{ data: { tag: 'Room', key: 'testRoomReplace', uuid: 'ROOM#testRoomReplace' }, children: [{ data: { tag: 'Example', uuid: 'EXAMPLE#testRoomReplaceBase' }, children: [{ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] }] }] }] },
                        { data: { tag: 'ReplacePayload' }, children: [{ data: { tag: 'Room', key: 'testRoomReplace', uuid: 'ROOM#testRoomReplace' }, children: [{ data: { tag: 'Example', uuid: 'EXAMPLE#testRoomReplaceBase' }, children: [{ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Changed' }, children: [] }] }] }] }] }
                    ]
                }
            ]
        }

        const standard = new StandardForm(test)
        expect(standard.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            components: [
                {
                    tag: 'Room',
                    key: 'testRoom',
                    universalKey: 'ROOM#testRoom',
                    examples: ['EXAMPLE#testRoomBase'],
                    exits: [{
                        data: { tag: 'Remove' },
                        children: [{ data: { tag: 'Exit', from: 'testRoom', to: 'testDestination', key: 'testRoom#testDestination' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }]
                    }]
                },
                {
                    tag: 'Example',
                    context: [{ key: 'testRoom', tag: 'Room', universalKey: 'ROOM#testRoom' }],
                    universalKey: 'EXAMPLE#testRoomBase',
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
                {
                    tag: 'Remove',
                    key: 'testRoomRemove',
                    component: {
                        tag: 'Room',
                        key: 'testRoomRemove',
                        universalKey: 'ROOM#testRoomRemove',
                        exits: []
                    }
                },
                {
                    tag: 'Replace',
                    key: 'testRoomReplace',
                    match: {
                        tag: 'Room',
                        key: 'testRoomReplace',
                        universalKey: 'ROOM#testRoomReplace',
                        examples: ['EXAMPLE#testRoomReplaceBase'],
                        exits: []
                    },
                    payload: {
                        tag: 'Room',
                        key: 'testRoomReplace',
                        universalKey: 'ROOM#testRoomReplace',
                        examples: ['EXAMPLE#testRoomReplaceBase'],
                        exits: []
                    }
                },
                {
                    tag: 'Replace',
                    match: {
                        tag: 'Example',
                        context: [{ key: 'testRoomReplace', tag: 'Room', universalKey: 'ROOM#testRoomReplace' }],
                        universalKey: 'EXAMPLE#testRoomReplaceBase',
                        name: ['Name Test']
                    },
                    payload: {
                        tag: 'Example',
                        context: [{ key: 'testRoomReplace', tag: 'Room', universalKey: 'ROOM#testRoomReplace' }],
                        universalKey: 'EXAMPLE#testRoomReplaceBase',
                        name: ['Name Changed']
                    }
                }
            ]
        })
    })

    it('should accept meta tags', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Meta key=(ABC) time="1234" />
            <Room uuid=(testRoom) key=(testRoom)>
                <Example uuid=(testRoomBase) key=(base)>
                    <Description>Test Description</Description>
                </Example>
            </Room>
        </Asset>`)

        expect(test.toJSON()).toEqual({
            key: 'Test',
            metaData: [{ data: { tag: 'Meta', key: 'ABC', time: 1234 }, children: [] }],
            components: [
                {
                    tag: 'Room',
                    key: 'testRoom',
                    universalKey: 'ROOM#testRoom',
                    examples: [{ key: 'base', tag: 'Example', universalKey: 'EXAMPLE#testRoomBase' }],
                    exits: [],
                },
                {
                    tag: 'Example',
                    key: 'base',
                    context: [{ key: 'testRoom', tag: 'Room', universalKey: 'ROOM#testRoom' }],
                    universalKey: 'EXAMPLE#testRoomBase',
                    description: ['Test Description']
                }
            ]
        })
    })

    it('should accept parsed schema', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Example uuid=(testFeatureBase)>
                        <Description>Four</Description>
                    </Example>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Example uuid=(testRoomBase)>
                        <Name>Test Room</Name>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Example>
                </Room>
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
                <Room uuid=(test) key=(test)>
                    <Grant player=(testPlayer) actions="test" />
                    <Example uuid=(testRoomBase) key=(base)>
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
                <Room uuid=(test) key=(test)>
                    <Example uuid=(testRoomBase) key=(base)>
                        <Description>One<br /></Description>
                    </Example>
                </Room>
            </Asset>
        `))
    })

    it('should properly nest components in a removed component', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Remove>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature) />
                    </Room>
                </Remove>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    it('should correctly relocate nested components to rendering level', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoom) key=(testRoom)>
                    <Feature key=(testFeature)>
                        <Example key=(testFeatureExample)>
                            <Description>Test Feature</Description>
                        </Example>
                    </Feature>
                </Room>
                <Feature uuid=(testFeature) key=(testFeature) />
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Example key=(testFeatureExample)>
                        <Description>Test Feature</Description>
                    </Example>
                </Feature>
                <Room uuid=(testRoom) key=(testRoom)><Feature key=(testFeature) /></Room>
            </Asset>
        `))
    })

    it('should combine descriptions in rooms and features', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room uuid=(test) key=(test)>
                <Example uuid=(testRoomExample) key=(testExample)>
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
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Example uuid=(testFeatureBase) key=(base)><Description>Four</Description></Example>
                </Feature>
            </If>
            <Room key=(test)>
                <Example key=(testExample)><Name>Test Room</Name></Example>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Example uuid=(testFeatureBase) key=(base)>
                        <Description><If {false}>Four</If></Description>
                    </Example>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Example uuid=(testRoomExample) key=(testExample)>
                        <Name>Test Room</Name>
                        <Summary>One<br /><If {false}>Two</If></Summary>
                        <Description>Three</Description>
                    </Example>
                </Room>
            </Asset>
        `))
    })

    it('should combine exits in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room uuid=(testRoom) key=(test)>
                <Example uuid=(testRoomBase) key=(base)>
                    <Description>
                        One
                        <br />
                    </Description>
                </Example>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
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
                <Room uuid=(testRoom) key=(test)>
                    <Example uuid=(testRoomBase) key=(base)>
                        <Description>One<br /></Description>
                    </Example>
                    <If {false}><Exit to=(testTwo)>Test Exit</Exit></If>
                </Room>
                <Room uuid=(testTwo) key=(testTwo)>
                    <Exit to=(test)>Test Return</Exit>
                </Room>
            </Asset>
        `))
    })

    it('should correctly return JSON for features nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Feature uuid=(testGlobal) key=(testGlobal) />
            <Room uuid=(testRoom) key=(test)>
                <Example uuid=(testRoomBase)><Description>One</Description></Example>
                <Feature uuid=(testLocal) key=(testLocal)>
                    <Example uuid=(testLocalBase)><Description>Local</Description></Example>
                </Feature>
                <Feature uuid=(testGlobal) key=(testGlobal)>
                    <Example uuid=(testGlobalBase)><Description>Global</Description></Example>
                </Feature>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
        </Asset>`)
        expect(test.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            components: [{
                tag: 'Feature',
                key: 'testGlobal',
                universalKey: 'FEATURE#testGlobal',
                examples: ['EXAMPLE#testGlobalBase']
            },
            {
                tag: 'Room',
                key: 'test',
                universalKey: 'ROOM#testRoom',
                examples: ['EXAMPLE#testRoomBase'],
                exits: [],
                features: [
                    { tag: 'Feature', key: 'testLocal', universalKey: 'FEATURE#testLocal' },
                    { tag: 'Feature', key: 'testGlobal', universalKey: 'FEATURE#testGlobal' }
                ]
            },
            {
                tag: 'Example',
                context: [{ key: 'test', tag: 'Room', universalKey: 'ROOM#testRoom' }],
                universalKey: 'EXAMPLE#testRoomBase',
                description: ['One']
            },
            //
            // The following Example appears out of natural order, because the StandardForm has not been finalized (and therefore it
            // thinks that it is sorted in the place that it appeared, not under its (relocated) parent Feature).
            //
            {
                tag: 'Example',
                context: [{ key: 'test', tag: 'Room', universalKey: 'ROOM#testRoom' }, { key: 'testGlobal', tag: 'Feature', universalKey: 'FEATURE#testGlobal' }],
                universalKey: 'EXAMPLE#testGlobalBase',
                description: ['Global']
            },
            {
                tag: 'Feature',
                key: 'testLocal',
                context: [{ key: 'test', tag: 'Room', universalKey: 'ROOM#testRoom' }],
                universalKey: 'FEATURE#testLocal',
                examples: ['EXAMPLE#testLocalBase']
            },
            {
                tag: 'Example',
                context: [{ key: 'test', tag: 'Room', universalKey: 'ROOM#testRoom' }, { key: 'testLocal', tag: 'Feature', universalKey: 'FEATURE#testLocal' }],
                universalKey: 'EXAMPLE#testLocalBase',
                description: ['Local']
            },
            {
                tag: 'Room',
                key: 'testTwo',
                universalKey: 'ROOM#testTwo',
                exits: []
            }]
        })
    })

    it('should correctly return JSON for examples nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room uuid=(test) key=(test)>
                <Example uuid=(testLocal)>
                    <Description>Description Test</Description>
                </Example>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
        </Asset>`)
        expect(test.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            components: [{
                tag: 'Room',
                key: 'test',
                universalKey: 'ROOM#test',
                exits: [],
                examples: ['EXAMPLE#testLocal']
            },
            {
                tag: 'Example',
                context: [{ key: 'test', tag: 'Room', universalKey: 'ROOM#test' }],
                universalKey: 'EXAMPLE#testLocal',
                description: ['Description Test']
            },
            {
                tag: 'Room',
                key: 'testTwo',
                universalKey: 'ROOM#testTwo',
                exits: []
            }]
        })
    })

    it('should correctly return JSON for examples nested in Knowledge', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Knowledge uuid=(test) key=(test)>
                <Example uuid=(testLocal)>
                    <Description>Description Test</Description>
                </Example>
            </Knowledge>
        </Asset>`)
        expect(test.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            components: [{
                tag: 'Knowledge',
                key: 'test',
                universalKey: 'KNOWLEDGE#test',
                examples: ['EXAMPLE#testLocal']
            },
            {
                tag: 'Example',
                context: [{ key: 'test', tag: 'Knowledge', universalKey: 'KNOWLEDGE#test' }],
                universalKey: 'EXAMPLE#testLocal',
                description: ['Description Test']
            }]
        })
    })

    it('should correct return JSON for examples nested in features nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room uuid=(test) key=(test)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Example uuid=(testLocal) key=(testLocal)>
                        <Description>Description Test</Description>
                    </Example>
                </Feature>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
        </Asset>`)
        expect(test.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            components: [{
                tag: 'Room',
                key: 'test',
                universalKey: 'ROOM#test',
                exits: [],
                features: [{ tag: 'Feature', key: 'testFeature', universalKey: 'FEATURE#testFeature' }]
            },
            {
                tag: 'Feature',
                key: 'testFeature',
                context: [{ key: 'test', tag: 'Room', universalKey: 'ROOM#test' }],
                universalKey: 'FEATURE#testFeature',
                examples: [{ tag: 'Example', key: 'testLocal', universalKey: 'EXAMPLE#testLocal' }]
            },
            {
                tag: 'Example',
                context: [{ key: 'test', tag: 'Room', universalKey: 'ROOM#test' }, { key: 'testFeature', tag: 'Feature', universalKey: 'FEATURE#testFeature' }],
                key: 'testLocal',
                universalKey: 'EXAMPLE#testLocal',
                description: ['Description Test']
            },
            {
                tag: 'Room',
                key: 'testTwo',
                universalKey: 'ROOM#testTwo',
                exits: []
            }]
        })
    })

    it('should correctly return schema for features nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Feature uuid=(testGlobal) key=(testGlobal) />
            <Room uuid=(test) key=(test)>
                <Feature uuid=(testLocal) key=(testLocal)>
                    <Example uuid=(testFeatureExample)>
                        <Description>Local</Description>
                    </Example>
                </Feature>
                <Feature key=(testGlobal)>
                    <Example uuid=(testGlobalExample)>
                        <Description>Global</Description>
                    </Example>
                </Feature>
                <Example uuid=(testBase)><Description>One</Description></Example>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Feature uuid=(testGlobal) key=(testGlobal)>
                    <Example uuid=(testGlobalExample)>
                        <Description>Global</Description>
                    </Example>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Feature uuid=(testLocal) key=(testLocal)>
                        <Example uuid=(testFeatureExample)>
                            <Description>Local</Description>
                        </Example>
                    </Feature>
                    <Feature key=(testGlobal) />
                    <Example uuid=(testBase)><Description>One</Description></Example>
                </Room>
                <Room uuid=(testTwo) key=(testTwo) />
            </Asset>
        `))
    })

    it('should correctly return schema for examples nested in rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room uuid=(test) key=(test)>
                <Example uuid=(testLocal) key=(testLocal)>
                    <Description>Description Test</Description>
                </Example>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(test) key=(test)>
                    <Example uuid=(testLocal) key=(testLocal)>
                        <Description>Description Test</Description>
                    </Example>
                </Room>
                <Room uuid=(testTwo) key=(testTwo) />
            </Asset>
        `))
    })

    it('should correctly return schema for examples nested in knowledge', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Knowledge uuid=(test) key=(test)>
                    <Example uuid=(testLocal) key=(testLocal)>
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
                <Room uuid=(test) key=(test)>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Example uuid=(testLocal) key=(testLocal)>
                            <Description>Description Test</Description>
                        </Example>
                    </Feature>
                </Room>
                <Room uuid=(testTwo) key=(testTwo) />
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    it('should combine render in nested rooms', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room uuid=(test) key=(test)>
                <Example uuid=(testBase) key=(base)>
                    <Description>
                        One
                        <br />
                    </Description>
                </Example>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
            <Message uuid=(testMessage) key=(testMessage)>
                Test message
                <Room uuid=(test) key=(test)>
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
                <Room uuid=(test) key=(test)>
                    <Example uuid=(testBase) key=(base)>
                        <Description>One<br />Two</Description>
                    </Example>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
                <Room uuid=(testTwo) key=(testTwo)>
                    <Exit to=(test)>Test Return</Exit>
                </Room>
                <Message uuid=(testMessage) key=(testMessage)>
                    <Room uuid=(test) key=(test) />Test message
                </Message>
            </Asset>
        `))
    })

    it('should render features and links correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room uuid=(test) key=(test)>
                <Example uuid=(testBase)>
                    <Description>
                        <Link to=(testFeatureOne)>test</Link>
                    </Description>
                </Example>
            </Room>
            <Feature uuid=(testFeatureOne) key=(testFeatureOne)>
                <Example uuid=(testFeatureOneBase)>
                    <Name>TestOne</Name>
                    <Description><Link to=(testFeatureTwo)>two</Link></Description>
                </Example>
            </Feature>
            <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                <Example uuid=(testFeatureTwoBase)>
                    <Name>TestTwo</Name>
                    <Description>Test</Description>
                </Example>
            </Feature>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Feature uuid=(testFeatureOne) key=(testFeatureOne)>
                    <Example uuid=(testFeatureOneBase)>
                        <Name>TestOne</Name>
                        <Description><Link to=(testFeatureTwo)>two</Link></Description>
                    </Example>
                </Feature>
                <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                    <Example uuid=(testFeatureTwoBase)>
                        <Name>TestTwo</Name>
                        <Description>Test</Description>
                    </Example>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Example uuid=(testBase)>
                        <Description><Link to=(testFeatureOne)>test</Link></Description>
                    </Example>
                </Room>
            </Asset>
        `))
    })

    it('should render knowledge correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room uuid=(test) key=(test)>
                <Example uuid=(testBase)>
                    <Description>
                        <Link to=(testKnowledgeOne)>test</Link>
                    </Description>
                </Example>
            </Room>
            <Knowledge uuid=(testKnowledgeOne) key=(testKnowledgeOne)>
                <Example uuid=(testKnowledgeOneBase)>
                    <Name>TestOne</Name>
                    <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                </Example>
            </Knowledge>
            <Knowledge uuid=(testKnowledgeTwo) key=(testKnowledgeTwo)>
                <Example uuid=(testKnowledgeTwoBase)>
                    <Name>TestTwo</Name>
                    <Description>Test</Description>
                </Example>
            </Knowledge>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Knowledge uuid=(testKnowledgeOne) key=(testKnowledgeOne)>
                    <Example uuid=(testKnowledgeOneBase)>
                        <Name>TestOne</Name>
                        <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                    </Example>
                </Knowledge>
                <Knowledge uuid=(testKnowledgeTwo) key=(testKnowledgeTwo)>
                    <Example uuid=(testKnowledgeTwoBase)>
                        <Name>TestTwo</Name>
                        <Description>Test</Description>
                    </Example>
                </Knowledge>
                <Room uuid=(test) key=(test)>
                    <Example uuid=(testBase)>
                        <Description><Link to=(testKnowledgeOne)>test</Link></Description>
                    </Example>
                </Room>
            </Asset>
        `))
    })

    it('should render maps correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Map uuid=(testMap) key=(testMap)>
                <Name>Test map</Name>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Position x="0" y="0" />
                    <Example uuid=(testRoomOneBase)>
                        <Description>Test Room One</Description>
                    </Example>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <If {false}>
                    <Room uuid=(testRoomOne) key=(testRoomOne) />
                    <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                        <Position x="-100" y="0" />
                        <Example uuid=(testRoomTwoBase)>
                            <Description>Test Room Two</Description>
                        </Example>
                        <Exit to=(testRoomOne)>one</Exit>
                    </Room>
                </If>
                <If {true} />
                <Room uuid=(testRoomThree) key=(testRoomThree) />
                <Image key=(mapBackground) />
            </Map>
            <Room uuid=(testRoomOne) />
            <Room uuid=(testRoomTwo) />
            <Room uuid=(testRoomThree) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Image key=(mapBackground) />
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)>
                        <Description>Test Room One</Description>
                    </Example>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree) />
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Example uuid=(testRoomTwoBase)>
                        <Description><If {false}>Test Room Two</If></Description>
                    </Example>
                    <If {false}><Exit to=(testRoomOne)>one</Exit></If>
                </Room>
                <Map uuid=(testMap) key=(testMap)>
                    <Name>Test map</Name>
                    <Image key=(mapBackground) />
                    <Room uuid=(testRoomOne) key=(testRoomOne)>
                        <Position x="0" y="0" />
                    </Room>
                </Map>
            </Asset>
        `))
    })

    it('should render empty maps', () => {
        const test = new StandardForm(`<Asset key=(Test)><Map uuid=(testMap) key=(testMap) /></Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)><Map uuid=(testMap) key=(testMap) /></Asset>
        `))
    })

    it('should render messages correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Message uuid=(testMessage) key=(testMessage)>
                Test message
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)>
                        <Description>Test Room One</Description>
                    </Example>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Example uuid=(testRoomTwoBase)>
                        <Description>Test Room Two</Description>
                    </Example>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
            </Message>
            <Room uuid=(testRoomOne) />
            <Room uuid=(testRoomTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)>
                        <Description>Test Room One</Description>
                    </Example>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Example uuid=(testRoomTwoBase)>
                        <Description>Test Room Two</Description>
                    </Example>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
                <Message uuid=(testMessage) key=(testMessage)>
                    <Room uuid=(testRoomOne) key=(testRoomOne) />
                    <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                    Test message
                </Message>
            </Asset>
        `))
    })

    it('should render moments correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Moment uuid=(testMoment) key=(testMoment)>
                <Message uuid=(testMessage) key=(testMessage)>
                    Test message
                    <Room uuid=(testRoomOne) key=(testRoomOne)>
                        <Example uuid=(testRoomOneBase)>
                            <Description>Test Room One</Description>
                        </Example>
                        <Exit to=(testRoomTwo)>two</Exit>
                    </Room>
                </Message>
            </Moment>
            <Room uuid=(testRoomOne) />
            <Room uuid=(testRoomTwo) key=(testRoomTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)>
                        <Description>Test Room One</Description>
                    </Example>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                <Moment uuid=(testMoment) key=(testMoment)>
                    <Message uuid=(testMessage) key=(testMessage)>
                        <Room uuid=(testRoomOne) key=(testRoomOne) />Test message
                    </Message>
                </Moment>
            </Asset>
        `))
    })

    it('should render variables correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Variable uuid=(testVar) key=(testVar) default={false} />
            <Room uuid=(testRoomOne) key=(testRoomOne)>
                <Example uuid=(testRoomOneBase) key=(base)><Description>Test Room One</Description></Example>
                <Exit to=(testRoomTwo)>two</Exit>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase) key=(base)>
                        <Description>Test Room One</Description>
                    </Example>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Variable uuid=(testVar) key=(testVar) default={false} />
            </Asset>
        `))
    })

    it('should render computes', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Computed uuid=(computeOne) key=(computeOne) src={computeThree} />
            <Computed uuid=(computeTwo) key=(computeTwo) src={!computeOne} />
            <Computed uuid=(computeThree) key=(computeThree) src={!testVar} />
            <Variable uuid=(testVar) key=(testVar) default={false} />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Variable uuid=(testVar) key=(testVar) default={false} />
                <Computed uuid=(computeOne) key=(computeOne) src={computeThree} />
                <Computed uuid=(computeThree) key=(computeThree) src={!testVar} />
                <Computed uuid=(computeTwo) key=(computeTwo) src={!computeOne} />
            </Asset>
        `))
    })

    it('should render actions correctly', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Action uuid=(actionOne) key=(actionOne) src={testVar = !testVar} />
            <Computed uuid=(computeOne) key=(computeOne) src={!testVar} />
            <Variable uuid=(testVar) key=(testVar) default={false} />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Variable uuid=(testVar) key=(testVar) default={false} />
                <Computed uuid=(computeOne) key=(computeOne) src={!testVar} />
                <Action uuid=(actionOne) key=(actionOne) src={testVar = !testVar} />
            </Asset>
        `))
    })

    it('should correctly reflect empty imports in byId', () => {
        const test = new StandardForm(`<Asset key=(Test)>
            <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#test) />
        </Asset>`)
        const firstRoom = test._byId.testRoomOne
        expect(firstRoom.toJSON()).toEqual({
            exits: [],
            key: 'testRoomOne',
            universalKey: 'ROOM#testRoomOne',
            tag: 'Room',
            from: `ASSET#test`
        })
        const mapTest = new StandardForm(`<Asset key=(Test)>
            <Map uuid=(testMap) key=(testMap)>
                <Room uuid=(testRoomOne) key=(testRoomOne)><Position x="0" y="100" /></Room>
            </Map>
        </Asset>`)
        expect(mapTest._byId.testRoomOne.toJSON()).toEqual({
            context: [{ key: 'testMap', tag: 'Map', universalKey: 'MAP#testMap' }],
            exits: [],
            key: 'testRoomOne',
            universalKey: 'ROOM#testRoomOne',
            tag: 'Room'
        })
    })

    it('should render Remove tags correctly', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) />
                <Remove>
                    <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                        <Example uuid=(testRoomTwoBase) key=(base)>
                            <Name>Test To Delete</Name>
                        </Example>
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
                <Room uuid=(testRoomOne) key=(testRoomOne) />
                <Replace>
                    <Variable uuid=(testVariable) key=(testVariable) default={true} />
                </Replace>
                <With>
                    <Variable uuid=(testVariable) key=(testVariable) default={false} />
                </With>
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
                    <Image key=(TessIcon) />
                </Character>
                <Image key=(TessIcon) />
            </Asset>
        `)
        const test = new StandardForm(testSource)
        expect(test.byId.Tess instanceof StandardCharacter).toBe(true)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

    it('should merge edit value tags correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase) key=(base)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Example>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase) key=(base)>
                        <Replace><Name>Lobby</Name></Replace>
                        <With><Name>Darkened lobby</Name></With>
                    </Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase) key=(base)>
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
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Name>Lobby</Name>
                    <Description>A plain lobby.</Description>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Remove>
                    <Room uuid=(testRoomOne) key=(testRoomOne)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Room>
                </Remove>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>
        `))
    })

    it('should merge edit component remove of replace base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Replace><Room uuid=(testRoomOne) key=(testRoomOne)><Example uuid=(testRoomOneBase) key=(base)><Name>Lobby</Name></Example></Room></Replace>
                <With><Room uuid=(testRoomOne) key=(testRoomOne)><Example uuid=(testRoomOneBase) key=(base)><Name>Changed</Name></Example></Room></With>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Remove>
                    <Room uuid=(testRoomOne) key=(testRoomOne)>
                        <Example uuid=(testRoomOneBase) key=(base)><Name>Changed</Name></Example>
                    </Room>
                </Remove>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Remove>
                    <Room uuid=(testRoomOne) key=(testRoomOne)>
                        <Example uuid=(testRoomOneBase) key=(base)>
                            <Name>Lobby</Name>
                        </Example>
                    </Room>
                </Remove>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component remove of empty base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Remove>
                    <Room uuid=(testRoomOne) key=(testRoomOne)><Example uuid=(testRoomOneBase) key=(base)><Name>Lobby</Name></Example></Room>
                </Remove>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Remove>
                    <Room uuid=(testRoomOne) key=(testRoomOne)>
                        <Example uuid=(testRoomOneBase) key=(base)>
                            <Name>Lobby</Name>
                        </Example>
                    </Room>
                </Remove>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component replace of plain base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>                
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)><Name>Test</Name></Example>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace>
                        <Example uuid=(testRoomOneBase)><Name>Test</Name></Example>
                    </Replace>
                    <With>
                        <Example uuid=(testRoomOneBase)>
                            <Name>Changed</Name>
                        </Example>
                    </With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)><Name>Changed</Name></Example>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component replace of replace base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace>
                        <Example uuid=(testRoomOneBase)><Name>Lobby</Name></Example>
                    </Replace>
                    <With>
                        <Example uuid=(testRoomOneBase)><Name>Changed</Name></Example>
                    </With>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace>
                        <Example uuid=(testRoomOneBase)><Name>Changed</Name></Example>
                    </Replace>
                    <With>
                        <Example uuid=(testRoomOneBase)><Name>Changed again</Name></Example>
                    </With>
                </Room>
            </Asset>
        `)
        const merged = inherited.merge(test)
        expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace>
                        <Example uuid=(testRoomOneBase)><Name>Lobby</Name></Example>
                    </Replace>
                    <With>
                        <Example uuid=(testRoomOneBase)>
                            <Name>Changed again</Name>
                        </Example>
                    </With>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component replace of empty base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace>
                        <Example uuid=(testRoomOneBase)><Name>Lobby</Name></Example>
                    </Replace>
                    <With>
                        <Example uuid=(testRoomOneBase)><Name>Changed</Name></Example>
                    </With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace>
                        <Example uuid=(testRoomOneBase)><Name>Lobby</Name></Example>
                    </Replace>
                    <With>
                        <Example uuid=(testRoomOneBase)><Name>Changed</Name></Example>
                    </With>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should apply edits on merge', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) />
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Exit to=(testRoomOne)>out</Exit>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Remove><Exit to=(testRoomOne)>out</Exit></Remove>
                    <Exit to=(testRoomOne)>depart</Exit>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) />
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Exit to=(testRoomOne)>depart</Exit>
                </Room>
            </Asset>
        `))
    })

    it('should correctly merge multiple replaces', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace><ShortName>One</ShortName></Replace>
                    <With><ShortName>Two</ShortName></With>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace><ShortName>Two</ShortName></Replace>
                    <With><ShortName>Three</ShortName></With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace><ShortName>One</ShortName></Replace>
                    <With><ShortName>Three</ShortName></With>
                </Room>
            </Asset>
        `))
    })

    it('should correctly filter no-op replace results', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace><ShortName>One</ShortName></Replace>
                    <With><ShortName>Two</ShortName></With>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace><ShortName>Two</ShortName></Replace>
                    <With><ShortName>One</ShortName></With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)><Room uuid=(testRoomOne) key=(testRoomOne) /></Asset>
        `))
    })

    it('should merge multiple standardComponents correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Example>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Example uuid=(testRoomTwoBase)><Name>Test Two</Name></Example>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)>
                        <Name><Space />(at night)</Name>
                        <Description><Space />Shadows cling to the corners of the room.</Description>
                    </Example>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree)>
                    <Example uuid=(testRoomThreeBase)><Name>Test Three</Name></Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)>
                        <Name>Lobby (at night)</Name>
                        <Description>
                            A plain lobby. Shadows cling to the corners of the room.
                        </Description>
                    </Example>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree)>
                    <Example uuid=(testRoomThreeBase)><Name>Test Three</Name></Example>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Example uuid=(testRoomTwoBase)><Name>Test Two</Name></Example>
                </Room>
            </Asset>
        `))
    })

    it('should merge metadata correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#primitives)>
                    <Example uuid=(testRoomOneBase)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Example>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Example uuid=(testRoomTwoBase)>
                        <Name>Test Two</Name>
                    </Example>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)>
                        <Name><Space />(at night)</Name>
                        <Description><Space />Shadows cling to the corners of the room.</Description>
                    </Example>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree) from=(ASSET#primitives)>
                    <Example uuid=(testRoomThreeBase)>
                        <Name>Test Three</Name>
                    </Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#primitives)>
                    <Example uuid=(testRoomOneBase)>
                        <Name>Lobby (at night)</Name>
                        <Description>
                            A plain lobby. Shadows cling to the corners of the room.
                        </Description>
                    </Example>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree) from=(ASSET#primitives)>
                    <Example uuid=(testRoomThreeBase)><Name>Test Three</Name></Example>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Example uuid=(testRoomTwoBase)><Name>Test Two</Name></Example>
                </Room>
            </Asset>
        `))
    })

    it('should merge edited metadata correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#primitives)>
                    <Example uuid=(testRoomOneBase)><Name>Test</Name></Example>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset key=(Test)>
                <Replace>
                    <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#primitives)>
                        <Example uuid=(testRoomOneBase)><Name>Test</Name></Example>
                    </Room>
                </Replace>
                <With>
                    <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#test)>
                        <Example uuid=(testRoomOneBase)><Name>Test</Name></Example>
                    </Room>
                </With>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#test)>
                    <Example uuid=(testRoomOneBase)><Name>Test</Name></Example>
                </Room>
            </Asset>
        `))
    })

    it('should merge multiple serializable standardComponents correctly', () => {
        const inherited = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Example>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Example uuid=(testRoomTwoBase)>
                        <Name>Test Two</Name>
                    </Example>
                </Room>
            </Asset>
        `)
        const testStandard = new StandardForm({
            key: 'Test',
            components: [
                {
                    tag: 'Room',
                    key: 'testRoomOne',
                    universalKey: 'ROOM#testRoomOne',
                    examples: ['EXAMPLE#testRoomOneBase'],
                    exits: [],
                },
                {
                    tag: 'Example',
                    universalKey: 'EXAMPLE#testRoomOneBase',
                    context: [{ tag: 'Room', key: 'testRoomOne', universalKey: 'ROOM#testRoomOne' }],
                    name: [{ data: { tag: 'String', value: ': Night' }, children: [] }],
                },
            ],
            metaData: []
        })
        const standardizer = inherited.merge(testStandard)
        expect(schemaToWML([standardizer.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Example uuid=(testRoomOneBase)>
                        <Name>Lobby: Night</Name>
                        <Description>A plain lobby.</Description>
                    </Example>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Example uuid=(testRoomTwoBase)><Name>Test Two</Name></Example>
                </Room>
            </Asset>
        `))
    })

    it('should merge with an empty value', () => {
        const inherited = new StandardForm(`<Asset key=(Test) />`)
        const testStandard = new StandardForm({
            key: 'Test',
            components: [
                {
                    tag: 'Room',
                    key: 'testRoomOne',
                    universalKey: 'ROOM#testRoomOne',
                    exits: [],
                    shortName: {
                        tag: 'Replace',
                        match: 'Test',
                        payload: 'Replace'
                    }
                }
            ],
            metaData: []
        })
        const standardizer = inherited.merge(testStandard)
        expect(schemaToWML([standardizer.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace><ShortName>Test</ShortName></Replace>
                    <With><ShortName>Replace</ShortName></With>
                </Room>
            </Asset>
        `))
    })

    it('should merge base component with universalKey', () => {
        const base = new StandardRoom(deIndentWML(`<Room uuid=(001) key=(test)><Example key=(one) /></Room>`))
        const incoming = new StandardRoom(deIndentWML(`<Room key=(test)><Example key=(two) /></Room>`))
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('ROOM#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Room uuid=(001) key=(test)>
                    <Example key=(one) />
                    <Example key=(two) />
                </Room>
            `))
        }
    })

    it('should merge incoming component with universalKey', () => {
        const base = new StandardRoom(deIndentWML(`<Room key=(test)><Example key=(one) /></Room>`))
        const incoming = new StandardRoom(deIndentWML(`<Room uuid=(001) key=(test)><Example key=(two) /></Room>`))
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('ROOM#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Room uuid=(001) key=(test)>
                    <Example key=(one) />
                    <Example key=(two) />
                </Room>
            `))
        }
    })

    it('should merge identical universalKeys', () => {
        const base = new StandardRoom(deIndentWML(`<Room uuid=(001) key=(test)><Example key=(one) /></Room>`))
        const incoming = new StandardRoom(deIndentWML(`<Room uuid=(001) key=(test)><Example key=(two) /></Room>`))
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('ROOM#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Room uuid=(001) key=(test)>
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
            components: [],
            metaData: []
        })
    })

    describe('diff method', () => {
        it('should return an empty diff for identical forms', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset key=(Test) />`)
        })

        it('should return the incoming form when base is empty', () => {
            const base = new StandardForm(`<Asset key=(Test) />`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
        })

        it('should remove the base form components when incoming is empty', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test) />`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Remove><Room uuid=(testRoom) key=(testRoom) /></Remove>
                </Asset>
            `))
        })

        it('should return the diff for added components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom) /><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset key=(Test)><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
        })

        it('should return the diff for removed components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom) /><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Remove><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Remove>
                </Asset>
            `))
        })

        it('should return the diff for modified components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom)><Example uuid=(base) key=(base)><Name>Old Name</Name></Example></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom)><Example uuid=(base) key=(base)><Name>New Name</Name></Example></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Replace>
                            <Example uuid=(base) key=(base)><Name>Old Name</Name></Example>
                        </Replace>
                        <With>
                            <Example uuid=(base) key=(base)><Name>New Name</Name></Example>
                        </With>
                    </Room>
                </Asset>
            `))
        })

        it('should return the diff for added and removed components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Remove><Room uuid=(testRoom) key=(testRoom) /></Remove>
                    <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                </Asset>
            `))
        })

        it('should return the diff for nested feature components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /><Feature uuid=(testFeatureTwo) key=(testFeatureTwo) /></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature uuid=(testFeatureTwo) key=(testFeatureTwo) />
                    </Room>
                </Asset>
            `))
        })

        it('should return the diff for nested example components', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom)><Example uuid=(Example1) key=(Example1) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom)><Example uuid=(Example1) key=(Example1) /><Example uuid=(Example2) key=(Example2) /></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Example uuid=(Example2) key=(Example2) />
                    </Room>
                </Asset>
            `))
        })

        it('should remove nested components properly', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Remove><Feature uuid=(testFeature) key=(testFeature) /></Remove>
                    </Room>
                </Asset>
            `))
        })

        it('should remove components with nested components properly', () => {
            const base = new StandardForm(`<Asset key=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset key=(Test) />`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset key=(Test)>
                    <Remove>
                        <Room uuid=(testRoom) key=(testRoom)>
                            <Feature uuid=(testFeature) key=(testFeature) />
                        </Room>
                    </Remove>
                </Asset>
            `))
        })

        // xit('should diff a rename correctly', () => {
        //     const base = new StandardForm(`
        //         <Asset key=(test)>
        //             <Room uuid=(Room1) key=(Room1)><Exit to=(Room2)>text</Exit></Room>
        //             <Room uuid=(Room2) key=(Room2)>
        //                 <Example uuid=(Room2Base) key=(base)><Name>Garden</Name></Example>
        //             </Room>
        //         </Asset>
        //     `)
        //     const incoming = base.renameKey([{ fromKey: 'Room2', toKey: 'garden' }])
        //     const diff = base.diff(incoming)
        //     expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
        //         <Asset key=(test)>
        //             <Room uuid=(Room2) key=(garden)>
        //                 <Example uuid=(Room2Base) key=(base)><Name>Garden</Name></Example>
        //             </Room>
        //             <Room uuid=(Room1) key=(Room1)>
        //                 <Remove><Exit to=(Room2)>text</Exit></Remove>
        //                 <Exit to=(garden)>text</Exit>
        //             </Room>
        //             <Remove>
        //                 <Room uuid=(Room2) key=(Room2)>
        //                     <Example uuid=(Room2Base) key=(base)><Name>Garden</Name></Example>
        //                 </Room>
        //             </Remove>
        //         </Asset>
        //     `))
        // })

        // it('should diff an import change correctly', () => {
        //     const base = new StandardForm(`
        //         <Asset key=(test)>
        //             <Import from=(base)><Room uuid=(Room1) key=(Room1) /></Import>
        //         </Asset>
        //     `)
        //     const incoming = base._clone()
        //     incoming._byId['Room1'] = incoming._byId['Room1'].withImport(new ImportItemContent('base', 'testRoom'))
        //     const diff = base.diff(incoming)
        //     expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
        //         <Asset key=(test)>
        //             <Import from=(base)>
        //                 <Replace><Room key=(Room1) /></Replace>
        //                 <With><Room key=(testRoom) as=(Room1) /></With>
        //             </Import>
        //             <Room key=(Room1) />
        //         </Asset>
        //     `))
        // })

    })

    describe('subset method', () => {
        it('should properly subset an asset with full content without cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Knowledge key=(testKnowledge) />
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Example uuid=(001)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Example>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                    <Feature uuid=(testFeature) key=(testFeature) />
                </Asset>
            `)
            const subset = test.subset([{ requestType: 'Full', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }])
            expect(schemaToWML([subset.schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Feature uuid=(testFeature) key=(testFeature) />
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Example uuid=(001)>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Example>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                </Asset>
            `))
        })    

        it('should properly subset an asset with exit content without cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Example key=(base)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Example>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                    <Feature uuid=(testFeature) key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Exit', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
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
            expect(schemaToWML([test.subset([{ requestType: 'ShortName', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }]).schema])).toEqual(deIndentWML(`
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
            expect(schemaToWML([test.subset([{ requestType: 'Stub', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)><Room key=(testRoom) /></Asset>
            `))
        })    

        it('should properly subset an asset with link cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <Example uuid=(testRoomBase)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Example>
                    </Room>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Example uuid=(testFeatureBase)>
                            <Description><Link to=(FEATURE#testFeatureTwo)>link</Link></Description>
                        </Example>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })], cascadeConditions: [{ conditionType: 'Link', cascadeType: 'Stub' }] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Feature uuid=(testFeature) key=(testFeature) />
                    <Room key=(testRoom)>
                        <Example uuid=(testRoomBase)>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Example>
                    </Room>
                </Asset>
            `))
        })

        it('should properly subset a chained cascade', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <Example uuid=(roomExample)>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Example>
                    </Room>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Example uuid=(featureExample)>
                            <Description>
                                <Link to=(FEATURE#testFeatureTwo)>link</Link>
                            </Description>
                        </Example>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })], cascadeConditions: [{ conditionType: 'Link', cascadeType: 'Full', chainCascade: true }] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Example uuid=(featureExample)>
                            <Description>
                                <Link to=(FEATURE#testFeatureTwo)>link</Link>
                            </Description>
                        </Example>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo) />
                    <Room key=(testRoom)>
                        <Example uuid=(roomExample)>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Example>
                    </Room>
                </Asset>
            `))
        })    

        it('should subset a looping chained cascade without error', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Example uuid=(exampleOne)>
                            <Description><Link to=(FEATURE#testFeatureTwo)>link</Link></Description>
                        </Example>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                        <Example uuid=(exampleTwo)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Example>
                    </Feature>
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: [new StandardKey({ key: 'testFeature', tag: 'Feature' })], cascadeConditions: [{ conditionType: 'Link', cascadeType: 'Full', chainCascade: true }] }]).schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Example uuid=(exampleOne)>
                            <Description>
                                <Link to=(FEATURE#testFeatureTwo)>link</Link>
                            </Description>
                        </Example>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                        <Example uuid=(exampleTwo)>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
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
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: [new StandardKey({ key: 'testMap', tag: 'Map' })], cascadeConditions: [{ conditionType: 'Position', cascadeType: 'Stub' }] }]).schema])).toEqual(deIndentWML(`
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
            expect(schemaToWML([test.subset([{ requestType: 'Exit', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })], cascadeConditions: [{ conditionType: 'Exit', cascadeType: 'Exit' }] }]).schema])).toEqual(deIndentWML(`
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
                <Feature uuid=(003) key=(testFeature)>
                    <Example uuid=(0035)>
                        <Name>Clocktower</Name>
                        <Description>
                            A tower built of white sandstone blocks, with an ornate clock
                            set on the northern face.
                        </Description>
                    </Example>
                </Feature>
                <Knowledge uuid=(004) key=(testKnowledge)>
                    <Example uuid=(0045)>
                        <Name>Learn</Name>
                        <Description>There is so much to know!</Description>
                    </Example>
                </Knowledge>
                <Room uuid=(002) key=(testRoom)>
                    <ShortName>Vortex</ShortName>
                    <Example uuid=(025)>
                        <Name>Vortex</Name>
                        <Description>Vortex Desc</Description>
                    </Example>
                </Room>
                <Map uuid=(005) key=(testMap)>
                    <Image key=(testBackground) />
                    <Room key=(testRoom)><Position x="0" y="100" /></Room>
                </Map>
                <Message uuid=(006) key=(openDoor)>
                    <Room key=(testRoom) />The door opens!
                </Message>
                <Moment uuid=(007) key=(openDoorMoment)><Message key=(openDoor) /></Moment>
                <Variable uuid=(008) key=(open) default={false} />
                <Computed uuid=(009) key=(closed) src={!open} />
                <Action uuid=(010) key=(toggleOpen) src={open = !open} />
            </Asset>
        `)
        const testSource = new StandardForm(testWML)

        const ndjson = testSource.toNDJSON()
        const test = new StandardForm(ndjson)
        expect(schemaToWML([test.schema])).toEqual(testWML)
        expect(test.byId.testRoom.universalKey).toEqual('ROOM#002')
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
                <Feature uuid=(003) key=(testGlobal)>
                    <Example uuid=(003b)>
                        <Description>Global</Description>
                    </Example>
                </Feature>
                <Room uuid=(001) key=(testRoom)>
                    <Feature uuid=(004) key=(testLocal)>
                        <Example uuid=(004b)>
                            <Name>Clocktower</Name>
                            <Description>
                                A tower built of white sandstone blocks, with an ornate clock set on
                                the northern face.
                            </Description>
                        </Example>
                    </Feature>
                    <Feature uuid=(003) key=(testGlobal) />
                    <Example uuid=(001b)>
                        <Name>Vortex</Name>
                    </Example>
                </Room>
                <Room uuid=(002) key=(testRoomTwo) />
            </Asset>
        `)
        const testSource = new StandardForm(testWML)

        const ndjson = testSource.toNDJSON()
        expect(ndjson).toEqual([
            { tag: 'Asset', key: 'test', universalKey: 'ASSET#test' },
            {
                tag: 'Feature',
                key: 'testGlobal',
                universalKey: 'FEATURE#003',
                examples: ['EXAMPLE#003b']
            },
            {
                tag: 'Example',
                universalKey: 'EXAMPLE#003b',
                context: [{ key: 'testGlobal', tag: 'Feature', universalKey: 'FEATURE#003' }],
                description: ['Global']
            },
            {
                tag: 'Room',
                key: 'testRoom',
                universalKey: 'ROOM#001',
                features: [{ key: 'testLocal', tag: 'Feature', universalKey: 'FEATURE#004' }, { key: 'testGlobal', tag: 'Feature', universalKey: 'FEATURE#003' }],
                examples: ['EXAMPLE#001b'],
                exits: []
            },
            {
                tag: 'Example',
                universalKey: 'EXAMPLE#001b',
                context: [{ key: 'testRoom', tag: 'Room', universalKey: 'ROOM#001' }],
                name:['Vortex']
            },
            {
                tag: 'Feature',
                key: 'testLocal',
                examples: ['EXAMPLE#004b'],
                universalKey: 'FEATURE#004',
                context: [{ key: 'testRoom', tag: 'Room', universalKey: 'ROOM#001' }]
            },
            {
                tag: 'Example',
                universalKey: 'EXAMPLE#004b',
                context: [{ key: 'testRoom', tag: 'Room', universalKey: 'ROOM#001' }, { key: 'testLocal', tag: 'Feature', universalKey: 'FEATURE#004' }],
                description: ['A tower built of white sandstone blocks, with an ornate clock set on the northern face.'],
                name: ['Clocktower']
            },
            { tag: 'Room', key: 'testRoomTwo', universalKey: 'ROOM#002', exits: [] }
        ])
    })

    it('should round-trip nested subcomponents', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Feature uuid=(003) key=(testGlobal)>
                    <Example uuid=(003b)><Description>Global</Description></Example>
                </Feature>
                <Room uuid=(001) key=(testRoom)>
                    <Feature uuid=(004) key=(testLocal)>
                        <Example uuid=(004b)>
                            <Name>Clocktower</Name>
                            <Description>
                                A tower built of white sandstone blocks, with an ornate
                                clock set on the northern face.
                            </Description>
                        </Example>
                    </Feature>
                    <Feature key=(testGlobal) />
                    <Example uuid=(001b)><Name>Vortex</Name></Example>
                </Room>
                <Room uuid=(002) key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(testWML)

        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    it('should round-trip imports through NDJSON', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoom) from=(ASSET#testImport)>
                    <ShortName>Test</ShortName>
                </Room>
            </Asset>
        `)
        const testSource = new StandardForm(testWML)
        const test = new StandardForm(testSource.toNDJSON())
        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    xdescribe('renameKey', () => {
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

    describe('assureComponent', () => {
        it('should return unchanged if component exists', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            expect(test.assureComponent(new StandardKey({ key: 'testRoom', tag: 'Room' })).toJSON()).toEqual(test.toJSON())
        })

        it('should add component if it does not exist', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            const assured = test.assureComponent(new StandardKey({ key: 'testFeature', tag: 'Feature' }))
            expect(schemaToWML([assured.schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Feature key=(testFeature) />
                    <Room key=(testRoom) />
                </Asset>
            `))
        })

        it('should add component but not context if it does not exist and context does', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            const assured = test.assureComponent(new StandardKey({ key: 'testFeature', tag: 'Feature', context: [{ key: 'testRoom', tag: 'Room' }] }))
            expect(schemaToWML([assured.schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoom)><Feature key=(testFeature) /></Room>
                </Asset>
            `))
        })

        it('should add component context if needed', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            const assured = test.assureComponent(new StandardKey({ key: 'testExample', tag: 'Example', context: [{ key: 'testRoom', tag: 'Room' }, { key: 'testFeature', tag: 'Feature' }] }))
            expect(schemaToWML([assured.schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoom)>
                        <Feature key=(testFeature)><Example key=(testExample) /></Feature>
                    </Room>
                </Asset>
            `))
        })

    })

    describe('finalize', () => {
        it('should add UUID on finalize', () => {
            const test = new StandardForm(`
                <Asset key=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset key=(test)><Room key=(testRoom) /></Asset>
            `))
            const finalized = test.finalize()
            expect(schemaToWML([finalized.schema])).toEqual(deIndentWML(`
                <Asset key=(test)><Room uuid=(mock-uuid-1) key=(testRoom) /></Asset>
            `))
            expect(finalized.byId.testRoom.universalKey).toEqual('ROOM#mock-uuid-1')
        })

        it('should rebuild context on finalize', () => {
            const testWML = deIndentWML(`
                <Asset key=(test)>
                    <Feature uuid=(testFeature) key=(testFeature) />
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature key=(testFeature)>
                            <Example uuid=(testFeatureBase)>
                                <Description>Test Feature</Description>
                            </Example>
                        </Feature>
                    </Room>
                </Asset>
            `)
            const test = new StandardForm(testWML)
            const findBaseExample = test._lookup('EXAMPLE#testFeatureBase')
            expect((findBaseExample?._key?.context ?? []).map((context) => (context.plain.toJSON()))).toEqual([
                { key: 'testRoom', tag: 'Room', universalKey: 'ROOM#testRoom' },
                { key: 'testFeature', tag: 'Feature' }
            ])
            const finalized = test.finalize()
            const findFinalizedExample = finalized._lookup('EXAMPLE#testFeatureBase')
            expect((findFinalizedExample?._key?.context ?? []).map((context) => (context.plain.toJSON()))).toEqual([
                'FEATURE#testFeature'
            ])
            expect(schemaToWML([finalized.schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Example uuid=(testFeatureBase)>
                            <Description>Test Feature</Description>
                        </Example>
                    </Feature>
                    <Room uuid=(testRoom) key=(testRoom)><Feature key=(testFeature) /></Room>
                </Asset>
            `))
        })

        it('should remap references to UUIDs on finalize', () => {
            const testWML = deIndentWML(`
                <Asset key=(test)>
                    <Feature uuid=(testFeature) key=(testFeature) />
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature key=(testFeature) />
                    </Room>
                </Asset>
            `)
            const test = new StandardForm(testWML).finalize()
            const findRoom = test._lookup('ROOM#testRoom')
            expect(findRoom).toBeInstanceOf(StandardRoom)
            expect((findRoom as StandardRoom).features.map((feature) => feature.toJSON())).toEqual([
                'FEATURE#testFeature'
            ])
        })

        it('should remap context to UUIDs on finalize', () => {
            const testWML = deIndentWML(`
                <Asset key=(test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature)>
                            <Example uuid=(testExample) />
                        </Feature>
                    </Room>
                </Asset>
            `)
            const test = new StandardForm(testWML).finalize()
            const findExample = test._lookup('EXAMPLE#testExample')
            expect(findExample?._key?.context?.map((context) => context.plain.toJSON())).toEqual([
                'ROOM#testRoom',
                'FEATURE#testFeature'
            ])
            const findFeature = test._lookup('FEATURE#testFeature')
            expect(findFeature?._key?.context?.map((context) => context.plain.toJSON())).toEqual([
                'ROOM#testRoom'
            ])
        })

        it('should assure components are correctly placed in hierarchy', () => {
            const testWML = deIndentWML(`
                <Asset key=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            const test = new StandardForm(testWML)
            test._components = [...test._components, new StandardFeature(`<Feature uuid=(testFeature) key=(testFeature) />`).withLeastCommonContext([new StandardKey({ key: 'testRoom', tag: 'Room' })])]
            const finalized = test.finalize()
            expect(schemaToWML([finalized.schema])).toEqual(deIndentWML(`
                <Asset key=(test)>
                    <Room uuid=(mock-uuid-1) key=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature) />
                    </Room>
                </Asset>
            `))
        })
    })

})
