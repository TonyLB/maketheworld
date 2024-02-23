import parse from '../simpleParser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'

import { schemaFromParse, schemaToWML } from '.'
import { deIndentWML } from './utils'

describe('schemaFromParse', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should make a schema from parse elements correctly', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset key=(Test)>
                <Import from=(BASE)>
                    <Variable key=(power) from=(basePower) />
                    <Room key=(overview) />
                    <Knowledge key=(baseInfo) />
                </Import>
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    <Description>
                        <Space />
                        Vortex<If {open}>
                            : Open
                        </If><ElseIf {!closed}>
                            : Indeterminate
                        </ElseIf><Else>
                            : Closed
                        </Else>
                        <Link to=(toggleOpen)>(toggle)</Link>
                    </Description>
                </Room>
                <If {open}>
                    <Room key=(ABC)>
                        <Exit to=(DEF)>welcome</Exit>
                    </Room>
                </If>
                <Room key=(DEF)>
                    <Name>Welcome</Name>
                    <Exit to=(DEF)>vortex</Exit>
                </Room>
                <Knowledge key=(GHI)>
                    <Name>Learn</Name>
                    <Description>
                        There is so much to know!
                    </Description>
                </Knowledge>
                <Variable key=(open) default={false} />
                <Action key=(toggleOpen) src={open = !open} />
                <Computed key=(closed) src={!open} />
                <Moment key=(openDoorMoment)>
                    <Message key=(openDoor)>
                        The door opens!
                        <Room key=(ABC) />
                    </Message>
                </Moment>
                <Export>
                    <Room key=(ABC) as=(QRS) />
                    <Room key=(DEF) />
                    <Knowledge key=(GHI) />
                </Export>
            </Asset>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                Story: undefined,
                key: "Test",
                tag: "Asset"
            },
            children: [
                {
                    data: {
                        from: "BASE",
                        mapping: {
                            baseInfo: { key: "baseInfo", type: "Knowledge" },
                            overview: { key: "overview", type: "Room" },
                            power: { key: "basePower", type: "Variable" }
                        },
                        tag: "Import"
                    },
                    children: [
                        { data: { tag: 'Variable', key: 'power', from: 'basePower' }, children: [] },
                        { data: { tag: 'Room', key: 'overview' }, children: [] },
                        { data: { tag: 'Knowledge', key: 'baseInfo' }, children: [] }
                    ]
                },
                {
                    data: {
                        tag: "Room",
                        key: "ABC",
                        display: undefined
                    },
                    children: [{
                        data: { tag: 'Name' },
                        children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }]
                    },
                    {
                        data: { tag: "Description" },
                        children: [
                            { data: { tag: "Space" }, children: [] },
                            { data: { tag: "String", value: "Vortex" }, children: [] },
                            {
                                data: { tag: "If" },
                                children: [
                                    { data: { tag: "Statement", if: "open" }, children: [{ data: { tag: "String", value: ": Open" }, children: [] }] },
                                    { data: { tag: "Statement", if: "!closed" }, children: [{ data: { tag: "String", value: ": Indeterminate" }, children: [] }] },
                                    { data: { tag: "Fallthrough" }, children: [{ data: { tag: "String", value: ": Closed" }, children: [] }] }
                                ],
                            },
                            {
                                data: {
                                    tag: "String",
                                    value: " "    
                                },
                                children: []
                            },
                            {
                                data: {
                                    tag: "Link",
                                    text: "(toggle)",
                                    to: "toggleOpen"    
                                },
                                children: [{ data: { tag: 'String', value: '(toggle)' }, children: [] }]
                            },
                        ],
                    }],
                },
                {
                    data: { tag: "If" },
                    children: [{
                        data: { tag: 'Statement', if: "open" },
                        children: [{
                            data: {
                                tag: "Room",
                                display: undefined,
                                key: "ABC"
                            },
                            children: [{
                                data: {
                                    tag: "Exit",
                                    key: "ABC#DEF",
                                    from: "ABC",
                                    to: "DEF"
                                },
                                children: [{ data: { tag: "String", value: "welcome" }, children: [] }],
                            }],
                        }],
                    }]
                },
                {
                    data: {
                        tag: "Room",
                        display: undefined,
                        key: "DEF"
                    },
                    children: [{
                        data: { tag: 'Name' },
                        children: [{ data: { tag: 'String', value: 'Welcome' }, children: [] }]
                    },
                    {
                        data: {
                            tag: "Exit",
                            key: "DEF#DEF",
                            from: "DEF",
                            to: "DEF"
                        },
                        children: [{ data: { tag: "String", value: "vortex" }, children: [] }],
                    }],
                },
                {
                    data: {
                        tag: "Knowledge",
                        key: "GHI"
                    },
                    children: [
                        { data: { tag: 'Name' }, children : [{ data: { tag: 'String', value: 'Learn' }, children: [] }] },
                        {
                            data: { tag: 'Description' },
                            children: [{ data: { tag: 'String', value: 'There is so much to know!' }, children: [] }]
                        }
                    ],
                },
                {
                    data: {
                        tag: "Variable",    
                        default: "false",
                        key: "open",
                    },
                    children: []
                },
                {
                    data: {
                        key: "toggleOpen",
                        src: "open = !open",
                        tag: "Action",
                    },
                    children: []
                },
                {
                    data: {
                        key: "closed",
                        src: "!open",
                        tag: "Computed",
                    },
                    children: []
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
                },
                {
                    data: {
                        tag: "Export",
                        mapping: {
                            QRS: { key: 'ABC', type: 'Room' },
                            DEF: { key: 'DEF', type: 'Room' },
                            GHI: { key: 'GHI', type: 'Knowledge' }
                        },
                    },
                    children: [
                        { data: { tag: 'Room', key: 'ABC', as: 'QRS' }, children: [] },
                        { data: { tag: 'Room', key: 'DEF' }, children: [] },
                        { data: { tag: 'Knowledge', key: 'GHI' }, children: [] }
                    ]
                }
            ]
        }])
    })

    it('should combine conditional elements at every level', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <Description>
                        Test One
                        <If {open}>Test Two</If>
                    </Description>
                    <If {open}>
                        <Description>
                            Test Three
                        </Description>
                    </If>
                </Room>
                <If {open}>
                    <Room key=(ABC)>
                        <Description>Test Four</Description>
                    </Room>
                </If>
                <Variable key=(open) default={false} />
            </Asset>
        `)))
        expect(schemaFromParse(testParse)).toEqual([
            {
                data: {
                    tag: "Asset",
                    key: "Test"
                },
                children: [
                    {
                        data: {
                            tag: "Room",    
                            key: "ABC"
                        },
                        children: [{
                            data: { tag: "Description" },
                            children: [
                                { data: { tag: "String", value: "Test One " }, children: [] },
                                {
                                    data: { tag: "If" },
                                    children: [{
                                        data: { tag: "Statement", if: "open" },
                                        children: [{ data: { tag: "String", value: "Test Two" }, children: [] }],
                                    }]
                                },
                            ],
                        },
                        {
                            data: { tag: "If" },
                            children: [{
                                data: { tag: "Statement", if: "open" },
                                children: [{
                                    data: { tag: "Description" },
                                    children: [{ data: { tag: "String", value: "Test Three" }, children: [] }],
                                }],
                            }]    
                        }]
                    },
                    {
                        data: { tag: "If" },
                        children: [{
                            data: { tag: "Statement", if: "open" },
                            children: [{
                                data: {
                                    tag: "Room",
                                    key: "ABC"
                                },
                                children: [{
                                    data: { tag: "Description" },
                                    children: [{ data: { tag: "String", value: "Test Four" }, children: [] }],
                                }]
                            }]
                        }]
                    },
                    {
                        data: {
                            default: "false",
                            key: "open",
                            tag: "Variable"    
                        },
                        children: []
                    }
                ]
            }
        ])
    })

    it('should make a schema for a character correctly', () => {
        const testParse = parse(tokenizer(new SourceStream(`
        <Character key=(TESS)>
            <Name>Tess</Name>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Pronouns
                subject="she"
                object="her"
                possessive="her"
                adjective="hers"
                reflexive="herself"
            ></Pronouns>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
            <Image key=(testIcon) />
        </Character>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Character",
                key: "TESS",
                Pronouns: {
                    adjective: "hers",
                    object: "her",
                    possessive: "her",
                    reflexive: "herself",
                    subject: "she",
                }
            },
            children: [
                { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Tess' }, children: [] } ] },
                { data: { tag: 'FirstImpression', value: 'Frumpy Goth' }, children: [] },
                { data: { tag: 'OneCoolThing', value: 'Fuchsia eyes' }, children: [] },
                {
                    data: {
                        tag: "Pronouns",    
                        adjective: "hers",
                        object: "her",
                        possessive: "her",
                        reflexive: "herself",
                        subject: "she",
                    },
                    children: []
                },
                {
                    data: { tag: 'Outfit', value: 'A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.' },
                    children: []
                },
                { data: { tag: 'Image', key: 'testIcon' }, children: [] }
            ]
        }])

    })

    it('should correctly extract map rooms', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset key=(Test)>
                <Map key=(testMap)>
                    <Image key=(image1) />
                    <Name>Test Map</Name>
                    <Room key=(ABC)><Position x="100" y="0" /></Room>
                    <If {open}>
                        <Room key=(DEF)><Position x="-100" y="0" /></Room>
                    </If>
                </Map>
                <Variable key=(open) default={false} />
            </Asset>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Asset",
                key: "Test"
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
                            data: { tag: 'Name' },
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
                            data: { tag: 'If' },
                            children: [{
                                data: { tag: "Statement", if: "open" },
                                children: [{
                                    data: {
                                        tag: "Room",
                                        key: "DEF"
                                    },
                                    children: [{ data: { tag: 'Position', x: -100, y: 0 }, children: [] }]
                                }]
                            }]
                        }
                    ]
                },
                {
                    data: { tag: 'Variable', key: 'open', default: 'false' },
                    children: []
                }
            ]
        }])

    })

    it('should correctly schematize bookmarks', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Story key=(Test) instance>
                <Bookmark key=(postFix)>
                    <Space />(awesome!)
                </Bookmark>
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    <Description>Vortex<Bookmark key=(postFix) /></Description>
                </Room>
            </Story>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            data: {
                tag: "Story",
                key: "Test",
                Story: true,
                instance: true
            },
            children: [
                {
                    data: {
                        tag: "Bookmark",
                        key: "postFix"
                    },
                    children: [
                        { data: { tag: 'Space' }, children: [] },
                        { data: { tag: 'String', value: '(awesome!)' }, children: [] }
                    ]
                },
                {
                    data: {
                        tag: "Room",    
                        key: "ABC"
                    },
                    children: [{
                        data: { tag: 'Name' },
                        children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }]
                    },
                    {
                        data: { tag: 'Description' },
                        children: [
                            { data: { tag: 'String', value: 'Vortex' }, children: [] },
                            { data: { tag: 'Bookmark', key: 'postFix' }, children: [] }
                        ]
                    }]
                }
            ],
        }])

    })

})

//
// NOTE: Unit testing of schemaToWML contains a fair number of round-trip integration tests
// that confirm that you can take a standard WML string, parse and schematize it, then use
// schemaToWML to return the original standard form
//
describe('schemaToWML', () => {
    it('should correctly round-trip the simplest asset', () => {
        const testWML = `<Asset key=(Test)><Room key=(VORTEX) /></Asset>`
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly join elements in Description context', () => {
        const testWML = `
            <Description>
                Test: <If {true}>lengthy philosophical argument when true</If>
                <Else>equally lengthy and annoying discussion when false</Else>.
            </Description>`
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(deIndentWML(testWML))
    })

    it('should correctly round-trip complicated rooms', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(VORTEX)>
                    <Name>Vortex</Name>
                    <Description>
                        You float in a swirling mass of energy and debris.
                        <Link to=(doors)>Doors</Link> to other realms drift around you.
                    </Description>
                    <Exit to=(welcome)>Welcome room</Exit>
                </Room>
                <Feature key=(doors)>
                    <Name>Drifting doors</Name>
                    <Description>Doors drifting in space</Description>
                </Feature>
                <Room key=(welcome)>
                    <Name>Welcome room</Name>
                    <Description>
                        A clean and sterile welcome room. The lights are
                        <If {lights}>on</If><Else>off</Else>.
                    </Description>
                    <Exit to=(VORTEX)>vortex</Exit>
                </Room>
                <Variable key=(lights) default={true} />
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip variables and actions', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Variable key=(lights) default={true} />
                <Variable key=(power) default={true} />
                <Computed key=(illumination) src={lights && power} />
                <Action key=(flipLightSwitch) src={
                    lights = !lights
                } />
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip knowledge items', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Knowledge key=(test)>
                    <Name>Learning is power!</Name>
                    <Description>There is so very much to see and discover!</Description>
                </Knowledge>
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip a character', () => {
        const testWML = deIndentWML(`
            <Character key=(TESS)>
                <Name>Tess</Name>
                <Pronouns
                    subject="she"
                    object="her"
                    possessive="hers"
                    adjective="her"
                    reflexive="herself"
                />
                <FirstImpression>Frumpy Goth</FirstImpression>
                <Outfit>
                    A tattered frock-coat kitbashed out of a black hoodie and dyed lace.
                </Outfit>
                <OneCoolThing>Fuchsia Eyes</OneCoolThing>
                <Image key=(TESSIcon) />
                <Import from=(base) />
            </Character>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip asset-level conditions', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Feature key=(doors)>
                    <Name>Drifting doors</Name>
                    <Description>Doors drifting in space</Description>
                </Feature>
                <If {lights}>
                    <Feature key=(doors)>
                        <Description>, lit from a distant star</Description>
                    </Feature>
                </If>
                <Else>
                    <Feature key=(doors)>
                        <Description>, dark and cold</Description>
                    </Feature>
                </Else>
                <Variable key=(lights) default={true} />
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip nested description conditions', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Feature key=(doors)>
                    <Name>Drifting doors</Name>
                    <Description>
                        Doors drifting in space, <If {lights}>
                            <If {solar}>lit from a distant star</If>
                            <Else>lit by a swelling moon</Else>
                        </If>
                        <Else>
                            dark and cold
                        </Else>
                    </Description>
                </Feature>
                <Variable key=(lights) default={true} />
                <Variable key=(solar) default={true} />
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip nested line-wrapped text', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Feature key=(doors)>
                    <Name>Drifting doors</Name>
                    <Description>
                        <If {lights}>
                            Testing a long text string that will require line wrapping to
                            render in its entirety
                        </If>
                    </Description>
                </Feature>
                <Variable key=(lights) default={true} />
            </Asset>
        `)
        expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
    })

    it('should correctly round-trip display tags', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Feature key=(doors)>
                    <Description>
                        <After>Dingy doors</After> <Replace>portals</Replace>
                        <Before>Clean<Space /></Before>
                    </Description>
                </Feature>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(schema)).toEqual(testWML)
    })

    it('should correctly round-trip space tags in connected conditionals', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Variable key=(testVar) default={false} />
                <Room key=(test)>
                    <Description>
                        Test <If {testVar}>
                            <Space />TestTwo
                        </If><If {!testVar}>
                            <Space />TestThree
                        </If><Bookmark key=(testBookmark) />
                    </Description>
                </Room>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(schema)).toEqual(testWML)
    })

    it('should correctly escape special characters', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Description>
                        Test \\\\ \\< \\>
                    </Description>
                </Room>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(schema)).toEqual('<Asset key=(Test)>\n    <Room key=(test)><Description>Test \\\\ \\< \\></Description></Room>\n</Asset>')
    })

    it('should correctly round-trip import and export', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Import from=(BASE)>
                    <Room key=(test) from=(Room1) />
                    <Room key=(testTwo) />
                </Import>
                <Variable key=(testVar) default={false} />
                <Room key=(test)><Description>Test</Description></Room>
                <Export><Room key=(test) as=(Room2) /></Export>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(schema)).toEqual(testWML)
    })

    it('should correctly round-trip mixes of freeText and non-freeText', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test) />
                <Message key=(msg)><Room key=(test) />Test</Message>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(schema)).toEqual(testWML)
    })

    it('should correctly round-trip free-text on a single line', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Name>Lobby <If {true}>in the dark</If></Name>
                    <Description>A dark and dusty lobby.</Description>
                </Room>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(schema)).toEqual(testWML)
    })

    it('should correctly round-trip inherited tags', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Name><Inherited>Lobby</Inherited></Name>
                    <Description>A dark and dusty lobby.</Description>
                </Room>
            </Asset>
        `)
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
        expect(schemaToWML(schema)).toEqual(testWML)
    })

})
