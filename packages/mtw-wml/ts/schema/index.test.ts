import parse from '../simpleParser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'

import { schemaFromParse, schemaToWML } from '.'
import { deIndentWML } from './utils'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'

describe('schemaFromParse', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should reject Asset key property', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset uuid=(Test) key=(invalidKey)>
                <Room uuid=(test) />
            </Asset>
        `)))
        expect(() => schemaFromParse(testParse)).toThrow("Property 'key' is not allowed in 'Asset' items.")
    })

    it('should make a schema from parse elements correctly', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset uuid=(Test)>
                <Import from=(BASE)>
                    <Room key=(overview) />
                    <Knowledge key=(baseInfo) />
                </Import>
                <Room uuid=(123-abc) key=(ABC)>
                    <ShortName>Vortex</ShortName>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Vortex</DisplayName>
                        <Description>
                            <Space />
                            Vortex
                            <Link to=(GHI)>(knowledge)</Link>
                        </Description>
                    </Situation>
                </Room>
                <Room key=(DEF)>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Welcome</DisplayName>
                    </Situation>
                    <Exit to=(ABC)>vortex</Exit>
                </Room>
                <Knowledge key=(GHI)>
                    <Situation uuid=(123-GHI-example)>
                        <DisplayName>Learn</DisplayName>
                        <Description>
                            There is so much to know!
                        </Description>
                    </Situation>
                </Knowledge>
                <Moment key=(openDoorMoment)>
                    <Message key=(openDoor)>
                        The door opens!
                        <Room key=(ABC) />
                    </Message>
                </Moment>
            </Asset>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                Story: undefined,
                uuid: "ASSET#Test",
                tag: "Asset"
            },
            children: [
                {
                    data: {
                        from: "BASE",
                        mapping: {
                            baseInfo: { key: "baseInfo", type: "Knowledge" },
                            overview: { key: "overview", type: "Room" }
                        },
                        tag: "Import"
                    },
                    children: [
                        { data: { tag: 'Room', key: 'overview' }, children: [] },
                        { data: { tag: 'Knowledge', key: 'baseInfo' }, children: [] }
                    ]
                },
                {
                    data: {
                        tag: "Room",
                        uuid: "ROOM#123-abc",
                        key: "ABC",
                        display: undefined
                    },
                    children: [{
                        data: { tag: 'ShortName' },
                        children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }]
                    },
                    {
                        data: { tag: 'Situation', uuid: 'SITUATION#DEFAULT' },
                        children: [{
                            data: { tag: 'DisplayName' },
                            children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }]
                        },
                        {
                            data: { tag: "Description" },
                            children: [
                                { data: { tag: "Space" }, children: [] },
                                { data: { tag: "String", value: "Vortex " }, children: [] },
                                {
                                    data: {
                                        tag: "Link",
                                        text: "(knowledge)",
                                        to: "GHI"    
                                    },
                                    children: [{ data: { tag: 'String', value: '(knowledge)' }, children: [] }]
                                },
                            ],
                        }]
                    }],
                },
                {
                    data: {
                        tag: "Room",
                        key: "DEF"
                    },
                    children: [{
                        data: { tag: 'Situation', uuid: 'SITUATION#DEFAULT' },
                        children: [{ data: { tag: 'DisplayName' }, children: [{ data: { tag: 'String', value: 'Welcome' }, children: [] }] }]
                    },
                    {
                        data: { tag: "Exit", to: "ABC" },
                        children: [{ data: { tag: "String", value: "vortex" }, children: [] }],
                    }],
                },
                {
                    data: {
                        tag: "Knowledge",
                        key: "GHI"
                    },
                    children: [{
                        data: { tag: 'Situation', uuid: 'SITUATION#123-GHI-example' },
                        children: [
                            { data: { tag: 'DisplayName' }, children : [{ data: { tag: 'String', value: 'Learn' }, children: [] }] },
                            {
                                data: { tag: 'Description' },
                                children: [{ data: { tag: 'String', value: 'There is so much to know!' }, children: [] }]
                            }
                        ]
                    }],
                },
                {
                    data: {
                        tag: "Moment",
                        key: "openDoorMoment"
                    },
                    children: [{
                        data: {
                            tag: "Message",    
                            key: "openDoor"
                        },
                        children: [{
                            data: { tag: 'String', value: 'The door opens!' }, children: []
                        },
                        {
                            data: {
                                tag: "Room",    
                                key: "ABC"
                            },
                            children: [],
                        }],
                    }],
                }
            ]
        }])
    })

    it('should parse room with feature included', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset uuid=(Test)>
                <Room key=(ABC)>
                    <Feature key=(DEF) />
                </Room>
            </Asset>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Asset",
                uuid: "ASSET#Test",
                Story: undefined
            },
            children: [
                {
                    data: {
                        tag: "Room",
                        key: "ABC"
                    },
                    children: [
                        { data: { tag: 'Feature', key: 'DEF' }, children: [] }
                    ]
                }
            ]
        }])
    })

    it('should correctly parse property replace tags', () => {
        const testWML = `
            <Asset uuid=(test)>
                <Room key=(room1)>
                    <Situation uuid=(DEFAULT)>
                        <Replace><DisplayName>Lobby</DisplayName></Replace>
                        <With><DisplayName>Foyer</DisplayName></With>
                    </Situation>
                </Room>
            </Asset>
        `
        const testParse = parse(tokenizer(new SourceStream(testWML)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Asset",
                uuid: "ASSET#test",
                Story: undefined
            },
            children: [
                {
                    data: { tag: 'Room', key: 'room1' },
                    children: [{
                        data: { tag: 'Situation', uuid: 'SITUATION#DEFAULT' },
                        children: [{
                            data: { tag: 'Replace' },
                            children: [
                                {
                                    data: { tag: 'ReplaceMatch' },
                                    children: [{ data: { tag: 'DisplayName' }, children: [{ data: { tag: 'String', value: 'Lobby' }, children: [] }] }]
                                },
                                {
                                    data: { tag: 'ReplacePayload' },
                                    children: [{ data: { tag: 'DisplayName' }, children: [{ data: { tag: 'String', value: 'Foyer' }, children: [] }] }]
                                }
                            ]
                        }]
                    }]
                }
            ]
        }])
    })

    it('should correctly parse component replace tags', () => {
        const testWML = `
            <Replace><Room key=(room1)><Situation uuid=(DEFAULT)><DisplayName>Lobby</DisplayName></Situation></Room></Replace>
            <With><Room key=(room1)><Situation uuid=(DEFAULT)><DisplayName>Foyer</DisplayName></Situation></Room></With>
        `
        const testParse = parse(tokenizer(new SourceStream(testWML)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: { tag: 'Replace' },
            children: [
                {
                    data: { tag: 'ReplaceMatch' },
                    children: [{
                        data: { tag: 'Room', key: 'room1' },
                        children: [{ data: { tag: 'Situation', uuid: 'SITUATION#DEFAULT' }, children: [{ data: { tag: 'DisplayName' }, children: [{ data: { tag: 'String', value: 'Lobby' }, children: [] }] }] }]
                    }]
                },
                {
                    data: { tag: 'ReplacePayload' },
                    children: [{
                        data: { tag: 'Room', key: 'room1' },
                        children: [{ data: { tag: 'Situation', uuid: 'SITUATION#DEFAULT' }, children: [{ data: { tag: 'DisplayName' }, children: [{ data: { tag: 'String', value: 'Foyer' }, children: [] }] }] }]
                    }]
                }
            ]
        }])
    })

    it('should correctly parse property remove tags', () => {
        const testWML = `
            <Asset uuid=(test)>
                <Room key=(room1)>
                    <Remove><Exit to=(room2)>out</Exit></Remove>
                </Room>
            </Asset>
        `
        const testParse = parse(tokenizer(new SourceStream(testWML)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Asset",
                uuid: "ASSET#test",
                Story: undefined
            },
            children: [
                {
                    data: { tag: 'Room', key: 'room1' },
                    children: [{
                        data: { tag: 'Remove' },
                        children: [{ data: { tag: 'Exit', to: 'room2' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }]
                    }]
                }
            ]
        }])
    })

    it('should correctly parse component remove tags', () => {
        const testWML = `
            <Asset uuid=(test)>
                <Remove>
                    <Room key=(room1)><Exit to=(room2)>out</Exit></Room>
                </Remove>
            </Asset>
        `
        const testParse = parse(tokenizer(new SourceStream(testWML)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Asset",
                uuid: "ASSET#test",
                Story: undefined
            },
            children: [{
                data: { tag: 'Remove' },
                children: [{
                    data: { tag: 'Room', key: 'room1' },
                    children: [{ data: { tag: 'Exit', to: 'room2' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }]
                }]
            }]
        }])
    })

    it('should make a schema for a character correctly', () => {
        const testParse = parse(tokenizer(new SourceStream(`
        <Character key=(TESS)>
            <DisplayName>Tess</DisplayName>
            <Image key=(testIcon) />
        </Character>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Character",
                key: "TESS",
            },
            children: [
                { data: { tag: 'DisplayName' }, children: [{ data: { tag: 'String', value: 'Tess' }, children: [] } ] },
                { data: { tag: 'Image', key: 'testIcon' }, children: [] }
            ]
        }])

    })

    it('should correctly extract map rooms', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset uuid=(Test)>
                <Map key=(testMap)>
                    <Image key=(image1) />
                    <ShortName>Test Map</ShortName>
                    <Room key=(ABC)><Position {100, 0} /></Room>
                    <Room key=(DEF)><Position {-100, 0} /></Room>
                </Map>
            </Asset>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Asset",
                uuid: "ASSET#Test",
                Story: undefined
            },
            children: [
                {
                    data: {
                        tag: "Map",
                        key: "testMap"
                    },
                    children: [
                        { data: { tag: 'Image', key: 'image1' }, children: [] },
                        {
                            data: { tag: 'ShortName' },
                            children: [{ data: { tag: 'String', value: 'Test Map' }, children: [] }]
                        },
                        {
                            data: {
                                tag: 'Room',
                                key: 'ABC'
                            },
                            children: [{ data: { tag: 'Position', x: 100, y: 0 }, children: [] }]
                        },
                        {
                            data: {
                                tag: "Room",
                                key: "DEF"
                            },
                            children: [{ data: { tag: 'Position', x: -100, y: 0 }, children: [] }]
                        }
                    ]
                }
            ]
        }])

    })

    it('should correctly parse Asset-level ShortName', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset uuid=(nakatomiPlaza)>
                <ShortName>Nakatomi Plaza</ShortName>
                <Room key=(lobby)>
                    <Situation uuid=(DEFAULT)>
                        <Description>A gleaming marble lobby</Description>
                    </Situation>
                </Room>
            </Asset>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Asset",
                uuid: "ASSET#nakatomiPlaza",
                Story: undefined
            },
            children: [
                {
                    data: { tag: 'ShortName' },
                    children: [{ data: { tag: 'String', value: 'Nakatomi Plaza' }, children: [] }]
                },
                {
                    data: { tag: 'Room', key: 'lobby' },
                    children: [{
                        data: { tag: 'Situation', uuid: 'SITUATION#DEFAULT' },
                        children: [{
                            data: { tag: 'Description' },
                            children: [{ data: { tag: 'String', value: 'A gleaming marble lobby' }, children: [] }]
                        }]
                    }]
                }
            ]
        }])
    })

    it('should correctly parse Asset-level Summary', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset uuid=(nakatomiPlaza)>
                <Summary>A high-rise office building in downtown Los Angeles</Summary>
                <Room key=(lobby)>
                    <Situation uuid=(DEFAULT)>
                        <Description>A gleaming marble lobby</Description>
                    </Situation>
                </Room>
            </Asset>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Asset",
                uuid: "ASSET#nakatomiPlaza",
                Story: undefined
            },
            children: [
                {
                    data: { tag: 'Summary' },
                    children: [{ data: { tag: 'String', value: 'A high-rise office building in downtown Los Angeles' }, children: [] }]
                },
                {
                    data: { tag: 'Room', key: 'lobby' },
                    children: [{
                        data: { tag: 'Situation', uuid: 'SITUATION#DEFAULT' },
                        children: [{
                            data: { tag: 'Description' },
                            children: [{ data: { tag: 'String', value: 'A gleaming marble lobby' }, children: [] }]
                        }]
                    }]
                }
            ]
        }])
    })

    it('should correctly parse both Asset-level ShortName and Summary', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset uuid=(underworldCaverns)>
                <ShortName>The Sunless Depths</ShortName>
                <Summary>Ancient cavern system beneath the mountain</Summary>
                <Room key=(entrance)>
                    <ShortName>Crystal Grotto</ShortName>
                    <Situation uuid=(DEFAULT)>
                        <Description>Luminescent crystals cast an eerie blue glow</Description>
                    </Situation>
                </Room>
            </Asset>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Asset",
                uuid: "ASSET#underworldCaverns",
                Story: undefined
            },
            children: [
                {
                    data: { tag: 'ShortName' },
                    children: [{ data: { tag: 'String', value: 'The Sunless Depths' }, children: [] }]
                },
                {
                    data: { tag: 'Summary' },
                    children: [{ data: { tag: 'String', value: 'Ancient cavern system beneath the mountain' }, children: [] }]
                },
                {
                    data: { tag: 'Room', key: 'entrance' },
                    children: [
                        {
                            data: { tag: 'ShortName' },
                            children: [{ data: { tag: 'String', value: 'Crystal Grotto' }, children: [] }]
                        },
                        {
                            data: { tag: 'Situation', uuid: 'SITUATION#DEFAULT' },
                            children: [{
                                data: { tag: 'Description' },
                                children: [{ data: { tag: 'String', value: 'Luminescent crystals cast an eerie blue glow' }, children: [] }]
                            }]
                        }
                    ]
                }
            ]
        }])
    })

    it('should parse Situation tag with key and uuid', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset uuid=(Test)>
                <Situation key=(bright) uuid=(my-sit) />
            </Asset>
        `)))
        const schema = schemaFromParse(testParse)
        const asset = schema[0]
        expect(asset.data.tag).toBe('Asset')
        const situationNode = asset.children.find((node) => node.data.tag === 'Situation')
        expect(situationNode).toBeDefined()
        expect(situationNode!.data).toMatchObject({
            tag: 'Situation',
            key: 'bright',
            uuid: 'SITUATION#my-sit'
        })
    })

})

//
// NOTE: Unit testing of schemaToWML contains a fair number of round-trip integration tests
// that confirm that you can take a standard WML string, parse and schematize it, then use
// schemaToWML to return the original standard form
//
describe('schemaToWML', () => {
    it('should correctly round-trip the simplest asset', () => {
        const testWML = `<Asset uuid=(Test)><Room key=(VORTEX) /></Asset>`
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip Situation', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Situation key=(bright) uuid=(my-sit) />
            </Asset>
        `)
        const roundTripped = schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))
        const schemaAgain = schemaFromParse(parse(tokenizer(new SourceStream(roundTripped))))
        const situationAgain = schemaAgain[0]?.children?.find((n) => n.data.tag === 'Situation')
        expect(situationAgain?.data).toMatchObject({ tag: 'Situation', key: 'bright', uuid: 'SITUATION#my-sit' })
    })

    it('should correctly round-trip all components with uuid', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(123-VORTEX) key=(VORTEX)>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Vortex</DisplayName>
                        <Description>Test Room</Description>
                    </Situation>
                </Room>
                <Feature uuid=(123-doors) key=(doors)>
                    <Situation uuid=(456-example2) key=(example2)>
                        <DisplayName>Drifting doors</DisplayName>
                        <Description>Doors drifting in space</Description>
                    </Situation>
                </Feature>
                <Knowledge uuid=(123-knowledge) key=(knowledge1)>
                    <Situation uuid=(456-example3) key=(example3)>
                        <DisplayName>Learning is power!</DisplayName>
                        <Description>
                            There is so very much to see and discover!
                        </Description>
                    </Situation>
                </Knowledge>
                <Map uuid=(123-map) key=(map1)>
                    <ShortName>Test Map</ShortName>
                    <Room key=(ABC)><Position {100, 0} /></Room>
                </Map>
                <Moment uuid=(123-moment) key=(moment1)>
                    <Message uuid=(123-message) key=(message1)>
                        <Room key=(VORTEX) />Something happened
                    </Message>
                </Moment>
                <Lens uuid=(123-lens) key=(lens1)>
                    <ShortName>Test Lens</ShortName>
                    <Description>A test lens for parsing validation</Description>
                    <Mark uuid=(123-mark) key=(mark1)>
                        <ShortName>Test Mark</ShortName>
                        <Description>A test mark inside the lens</Description>
                    </Mark>
                </Lens>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly rount-trip a top-level render item', () => {
        const testWML = 'Test'
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly render a component with only uuid', () => {
        const testSchema: GenericTree<SchemaTag> = [{
            data: { tag: 'Room', uuid: 'ROOM#test' },
            children: []
        }]
        expect(schemaToWML(testSchema)).toEqual('<Room uuid=(test) />'  )
    })

    it('should correctly join elements in Description context', () => {
        const testWML = `
            <Description>
                Test: <Link to=(diatribe)>lengthy philosophical argument</Link>
                <Link to=(rant)>equally lengthy and annoying discussion</Link>
            </Description>`
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(deIndentWML(testWML))
    })

    it('should correctly round-trip complicated rooms', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(VORTEX)>
                    <ShortName>Vortex</ShortName>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Vortex</DisplayName>
                        <Summary>
                            You float in a swirling mass of energy and debris.
                            <Link to=(doors)>Doors</Link> to other realms drift around you.
                        </Summary>
                        <Description>
                            You float in a swirling mass of energy and debris.
                            <Link to=(doors)>Doors</Link> to other realms drift around you.
                            Crackling bursts of energy snap through space in the distance.
                        </Description>
                    </Situation>
                    <Exit to=(welcome)>Welcome room</Exit>
                </Room>
                <Feature key=(doors)>
                    <Situation uuid=(123-doors-example)>
                        <DisplayName>Drifting doors</DisplayName>
                        <Description>Doors drifting in space</Description>
                    </Situation>
                </Feature>
                <Room key=(welcome)>
                    <ShortName>Welcome</ShortName>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Welcome room</DisplayName>
                        <Description>
                            A clean and sterile welcome room. The lights are on.
                        </Description>
                    </Situation>
                    <Exit to=(VORTEX)>vortex</Exit>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip edit tags', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room key=(room1)>
                    <Situation uuid=(DEFAULT)>
                        <Replace><DisplayName>Lobby</DisplayName></Replace>
                        <With><DisplayName>Foyer</DisplayName></With>
                    </Situation>
                    <Remove><Exit to=(room2)>out</Exit></Remove>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly not persist exits without targets', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(VORTEX)><Exit>Exit to nowhere</Exit></Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))), { persistentOnly: true })).toEqual(deIndentWML(`
            <Asset uuid=(Test)><Room key=(VORTEX) /></Asset>
        `))
    })

    it('should correctly parse exits with universalKey targets', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(VORTEX)><Exit to=(ROOM#target)>Exit to nowhere</Exit></Room>
                <Room uuid=(target)>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Nowhere</DisplayName>
                    </Situation>
                </Room>
            </Asset>
        `)
        const parsed = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(parsed)).toEqual(testWML)
    })

    it('should correctly round-trip knowledge items', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge key=(test)>
                    <Situation uuid=(123-knowledge-test-example)>
                        <DisplayName>Learning is power!</DisplayName>
                        <Description>
                            There is so very much to see and discover!
                        </Description>
                    </Situation>
                </Knowledge>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip a character', () => {
        const testWML = deIndentWML(`
            <Character key=(TESS)>
                <DisplayName>Tess</DisplayName>
                <Image key=(TESSIcon) />
                <Import from=(base) />
            </Character>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip nested remove tags', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(room1)><Remove><Situation uuid=(DEFAULT) /></Remove></Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip remove with nested tags', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Remove><Room key=(room1)><Situation uuid=(DEFAULT) /></Room></Remove>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })


    it('should correctly round-trip nested line-wrapped text', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Feature key=(doors)>
                    <Situation uuid=(123-doors-linewrapped-example)>
                        <DisplayName>Drifting doors</DisplayName>
                        <Description>
                            Testing a long text string that will require line wrapping to
                            render in its entirety
                        </Description>
                    </Situation>
                </Feature>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly escape special characters', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <Description>Test \\\\ \\< \\></Description>
                    </Situation>
                </Room>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(schema)).toEqual(testWML)
    })

    it('should correctly round-trip import', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Import from=(BASE)>
                    <Room uuid=(Room1) key=(test) />
                    <Room uuid=(testTwo) />
                </Import>
                <Room uuid=(test)>
                    <Situation uuid=(DEFAULT)><Description>Test</Description></Situation>
                </Room>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(schema)).toEqual(testWML)
    })

    it('should correctly round-trip mixes of freeText and non-freeText', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(test) />
                <Message key=(msg)>
                    <Room key=(test) />
                    <Description>Test</Description>
                </Message>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(schema)).toEqual(testWML)
    })

    it('should correctly round-trip free-text on a single line', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Lobby in the dark</DisplayName>
                        <Description>A dark and dusty lobby.</Description>
                    </Situation>
                </Room>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(schema)).toEqual(testWML)
    })

    it('should correctly round-trip Asset-level ShortName', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(hauntedMansion)>
                <ShortName>Ravencrest Manor</ShortName>
                <Room key=(foyer)>
                    <Situation uuid=(DEFAULT)>
                        <Description>A dust-covered entrance hall</Description>
                    </Situation>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip Asset-level Summary', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(hauntedMansion)>
                <Summary>Victorian mansion with a dark history</Summary>
                <Room key=(foyer)>
                    <Situation uuid=(DEFAULT)>
                        <Description>A dust-covered entrance hall</Description>
                    </Situation>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip Asset-level ShortName and Summary together', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(skyshipDock)>
                <ShortName>Aetherdock Seven</ShortName>
                <Summary>Floating docking station for airships</Summary>
                <Room key=(platform)>
                    <ShortName>Main Platform</ShortName>
                    <Situation uuid=(DEFAULT)>
                        <Description>A wooden platform swaying in the wind</Description>
                    </Situation>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip D29 Exit topology shape under Area', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Area key=(coyoteHighway)>
                    <Exit uuid=(straightawayToCliffbase)>
                        <From>ROOM#STRAIGHTAWAY</From>
                        <To>ROOM#VORTEX</To>
                        <Forward>east</Forward>
                        <Back>west</Back>
                    </Exit>
                </Area>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

})
