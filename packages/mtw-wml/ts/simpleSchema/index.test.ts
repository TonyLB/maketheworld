import parse from '../simpleParser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'

import { schemaFromParse } from '.'

describe('schemaFromParse', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should make a schema from parse elements correctly', () => {
        const testParse = parse(tokenizer(new SourceStream(`
            <Asset key=(Test)>
                <Import from=(BASE)>
                    <Use key=(basePower) type="Variable" as=(power) />
                    <Use key=(overview) type="Room" />
                    <Use key=(baseInfo) type="Knowledge" />
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
            </Asset>
        `)))
        expect(schemaFromParse(testParse)).toEqual([{
            Story: undefined,
            contents: [
                {
                    from: "BASE",
                    mapping: {
                        baseInfo: { key: "baseInfo", type: "Knowledge" },
                        overview: { key: "overview", type: "Room" },
                        power: { key: "basePower", type: "Variable" }
                    },
                    tag: "Import",
                },
                {
                    contents: [{
                        contents: [
                            { tag: "Space" },
                            { tag: "String", value: "Vortex" },
                            {
                                conditions: [{
                                    dependencies: ["open"],
                                    if: "open",
                                }],
                                contents: [{ tag: "String", value: ": Open" }],
                                contextTag: "Description",
                                tag: "If",
                            },
                            {
                                conditions: [
                                    {
                                        dependencies: ["open"],
                                        if: "open",
                                        not: true,
                                    },
                                    {
                                        dependencies: ["closed"],
                                        if: "!closed",
                                    },
                                ],
                                contents: [{ tag: "String", value: ": Indeterminate" }],
                                contextTag: "Description",
                                tag: "If",
                            },
                            {
                                conditions: [
                                    {
                                        dependencies: ["open"],
                                        if: "open",
                                        not: true,
                                    },
                                    {
                                        dependencies: ["closed"],
                                        if: "!closed",
                                        not: true,
                                    },
                                ],
                                contents: [{ tag: "String", value: ": Closed" }],
                                contextTag: "Description",
                                tag: "If",
                            },
                            {
                                tag: "String",
                                value: " ",
                            },
                            {
                                tag: "Link",
                                text: "(toggle)",
                                to: "toggleOpen",
                            },
                        ],
                        tag: "Description",
                    }],
                    display: undefined,
                    key: "ABC",
                    name: [{ tag: "String", value: "Vortex" }],
                    render: [
                        { tag: "Space" },
                        { tag: "String", value: "Vortex" },
                        {
                            conditions: [{
                                dependencies: ["open"],
                                if: "open"
                            }],
                            contents: [{ tag: "String", value: ": Open" }],
                            contextTag: "Description",
                            tag: "If"
                        },
                        {
                            conditions: [
                                {
                                    dependencies: ["open"],
                                    if: "open",
                                    not: true
                                },
                                {
                                    dependencies: ["closed"],
                                    if: "!closed"
                                }
                            ],
                            contents: [{
                                tag: "String",
                                value: ": Indeterminate",
                            }],
                            contextTag: "Description",
                            tag: "If",
                        },
                        {
                            conditions: [
                                {
                                    dependencies: ["open"],
                                    if: "open",
                                    not: true,
                                },
                                {
                                    dependencies: ["closed"],
                                    if: "!closed",
                                    not: true,
                                },
                            ],
                            contents: [{ tag: "String", value: ": Closed" }],
                            contextTag: "Description",
                            tag: "If",
                        },
                        {
                            tag: "String",
                            value: " ",
                        },
                        {
                            tag: "Link",
                            text: "(toggle)",
                            to: "toggleOpen",
                        },
                    ],
                    tag: "Room"
                },
                {
                    conditions: [{
                        dependencies: ["open"],
                        if: "open",
                    }],
                    contents: [{
                        contents: [{
                            contents: [{ tag: "String", value: "welcome" }],
                            from: "ABC",
                            key: "ABC#DEF",
                            name: "welcome",
                            tag: "Exit",
                            to: "DEF",
                        }],
                        display: undefined,
                        key: "ABC",
                        name: [],
                        render: [],
                        tag: "Room"
                    }],
                    contextTag: "Asset",
                    tag: "If",
                },
                {
                    contents: [{
                        contents: [{ tag: "String", value: "vortex" }],
                        from: "DEF",
                        key: "DEF#DEF",
                        name: "vortex",
                        tag: "Exit",
                        to: "DEF",
                    }],
                    display: undefined,
                    key: "DEF",
                    name: [{ tag: "String", value: "Welcome" }],
                    render: [],
                    tag: "Room",
                },
                {
                    contents: [],
                    key: "GHI",
                    name: [{ tag: "String", value: "Learn" }],
                    render: [{ tag: "String", value: "There is so much to know!" }],
                    tag: "Knowledge",
                },
                {
                    default: "false",
                    key: "open",
                    tag: "Variable",
                },
                {
                    key: "toggleOpen",
                    src: "open = !open",
                    tag: "Action",
                },
                {
                    dependencies: ["open"],
                    key: "closed",
                    src: "!open",
                    tag: "Computed",
                },
                {
                    contents: [{
                        contents: [{
                            contents: [],
                            display: undefined,
                            key: "ABC",
                            name: [],
                            render: [],
                            tag: "Room",
                        }],
                        key: "openDoor",
                        render: [{ tag: "String", value: "The door opens!" }],
                        rooms: [{ key: "ABC" }],
                        tag: "Message",
                    }],
                    key: "openDoorMoment",
                    tag: "Moment",
                },
            ],
            key: "Test",
            tag: "Asset"
        }])
    })

    // it('should combine conditional elements at every level', () => {
    //     const testParse = parse(tokenizer(new SourceStream(`
    //     <Asset key=(Test) fileName="test">
    //         <Room key=(ABC)>
    //             <Description>
    //                 Test One
    //                 <If {open}>Test Two</If>
    //             </Description>
    //             <If {open}>
    //                 <Description>
    //                     Test Three
    //                 </Description>
    //             </If>
    //         </Room>
    //         <If {open}>
    //             <Room key=(ABC)>
    //                 <Description>Test Four</Description>
    //             </Room>
    //         </If>
    //         <Variable key=(open) default={false} />
    //     </Asset>
    // `)))
    //     expect(schemaFromParse(testParse)).toMatchSnapshot()

    // })

    // it('should make a schema for a character correctly', () => {
    //     const testParse = parse(tokenizer(new SourceStream(`
    //     <Character key=(TESS) fileName="Tess" player="TonyLB">
    //     <Name>Tess</Name>
    //     <FirstImpression>Frumpy Goth</FirstImpression>
    //     <OneCoolThing>Fuchsia eyes</OneCoolThing>
    //     <Pronouns
    //         subject="she"
    //         object="her"
    //         possessive="her"
    //         adjective="hers"
    //         reflexive="herself"
    //     ></Pronouns>
    //     <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
    //     <Image key=(testIcon) />
    // </Character>
    // `)))
    //     expect(schemaFromParse(testParse)).toMatchSnapshot()

    // })

    // it('should correctly extract map rooms', () => {
    //     const testParse = parse(tokenizer(new SourceStream(`
    //     <Asset key=(Test) fileName="test">
    //         <Map key=(testMap)>
    //             <Name>Test Map</Name>
    //             <Room key=(ABC) x="100" y="0" />
    //             <If {open}>
    //                 <Room key=(DEF) x="-100" y="0" />
    //             </If>
    //         </Map>
    //         <Variable key=(open) default={false} />
    //     </Asset>
    // `)))
    //     expect(schemaFromParse(testParse)).toMatchSnapshot()

    // })

    // it('should correctly schematize bookmarks', () => {
    //     const testParse = parse(tokenizer(new SourceStream(`
    //     <Story key=(Test) instance fileName="test">
    //         <Bookmark key=(postFix)>
    //             <Space />(awesome!)
    //         </Bookmark>
    //         <Room key=(ABC)>
    //             <Name>Vortex</Name>
    //             <Description>Vortex<Bookmark key=(postFix) /></Description>
    //         </Room>
    //     </Story>
    // `)))
    //     expect(schemaFromParse(testParse)).toMatchSnapshot()

    // })

})

//
// NOTE: Unit testing of schemaToWML contains a fair number of round-trip integration tests
// that confirm that you can take a standard WML string, parse and schematize it, then use
// schemaToWML to return the original standard form
//
// describe('schemaToWML', () => {
//     it('should correctly round-trip the simplest asset', () => {
//         const testWML = `<Asset key=(Test)><Room key=(VORTEX) /></Asset>`
//         expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
//     })

//     it('should correctly round-trip complicated rooms', () => {
//         const testWML = `<Asset key=(Test)>
//     <Room key=(VORTEX)>
//         <Name>Vortex</Name>
//         <Description>
//             You float in a swirling mass of energy and debris.
//             <Link to=(doors)>Doors</Link>
//             to other realms drift around you.
//         </Description>
//         <Exit to=(welcome)>Welcome room</Exit>
//     </Room>
//     <Feature key=(doors)>
//         <Name>Drifting doors</Name>
//         <Description>Doors drifting in space</Description>
//     </Feature>
//     <Room key=(welcome)>
//         <Name>Welcome room</Name>
//         <Description>
//             A clean and sterile welcome room. The lights are
//             <If {lights}>on</If><Else>off</Else>.
//         </Description>
//         <Exit to=(VORTEX)>vortex</Exit>
//     </Room>
//     <Variable key=(lights) default={true} />
// </Asset>`
//         expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
//     })

//     it('should correctly round-trip variables and actions', () => {
//         const testWML = `<Asset key=(Test)>
//     <Variable key=(lights) default={true} />
//     <Variable key=(power) default={true} />
//     <Computed key=(illumination) src={lights && power} />
//     <Action key=(flipLightSwitch) src={
//         lights = !lights
//     } />
// </Asset>`
//         expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
//     })

//     it('should correctly round-trip knowledge items', () => {
//         const testWML = `<Asset key=(Test)>
//     <Knowledge key=(test)>
//         <Name>Learning is power!</Name>
//         <Description>There is so very much to see and discover!</Description>
//     </Knowledge>
// </Asset>`
//         expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
//     })

//     it('should correctly round-trip a character', () => {
//         const testWML = `<Character key=(TESS)>
//     <Name>Tess</Name>
//     <Pronouns
//         subject="she"
//         object="her"
//         possessive="hers"
//         adjective="her"
//         reflexive="herself"
//     />
//     <FirstImpression>Frumpy Goth</FirstImpression>
//     <Outfit>
//         A tattered frock-coat kitbashed out of a black hoodie and dyed lace.
//     </Outfit>
//     <OneCoolThing>Fuchsia Eyes</OneCoolThing>
//     <Image key=(TESSIcon) />
//     <Import from=(base) />
// </Character>`
//         expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
//     })

//     it('should correctly round-trip asset-level conditions', () => {
//         const testWML = `<Asset key=(Test)>
//     <Feature key=(doors)>
//         <Name>Drifting doors</Name>
//         <Description>Doors drifting in space</Description>
//     </Feature>
//     <If {lights}>
//         <Feature key=(doors)>
//             <Description>, lit from a distant star</Description>
//         </Feature>
//     </If>
//     <Else>
//         <Feature key=(doors)>
//             <Description>, dark and cold</Description>
//         </Feature>
//     </Else>
//     <Variable key=(lights) default={true} />
// </Asset>`
//         expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
//     })

//         it('should correctly round-trip nested description conditions', () => {
//         const testWML = `<Asset key=(Test)>
//     <Feature key=(doors)>
//         <Name>Drifting doors</Name>
//         <Description>
//             Doors drifting in space,
//             <If {lights}>
//                 <If {solar}>lit from a distant star</If>
//                 <Else>lit by a swelling moon</Else>
//             </If>
//             <Else>dark and cold</Else>
//         </Description>
//     </Feature>
//     <Variable key=(lights) default={true} />
//     <Variable key=(solar) default={true} />
// </Asset>`
//         expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
//     })

//     it('should correctly round-trip nested line-wrapped text', () => {
//         const testWML = `<Asset key=(Test)>
//     <Feature key=(doors)>
//         <Name>Drifting doors</Name>
//         <Description>
//             <If {lights}>
//                 Testing a long text string that will require line wrapping to
//                 render in its entirety
//             </If>
//         </Description>
//     </Feature>
//     <Variable key=(lights) default={true} />
// </Asset>`
//         expect(schemaToWML(schemaFromParse(parse(tokenizer(new SourceStream(testWML)))))).toEqual(testWML)
//     })

//     it('should correctly round-trip display tags', () => {
//         const testWML = `<Asset key=(Test)>
//     <Feature key=(doors)>
//         <Description>
//             <After>Dingy doors</After>
//             <Replace>portals</Replace>
//             <Before>Clean<Space /></Before>
//         </Description>
//     </Feature>
// </Asset>`
//         const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
//         expect(schemaToWML(schema)).toEqual(testWML)
//     })

//     it('should correctly round-trip space tags in connected conditionals', () => {
//         const testWML = `<Asset key=(Test)>
//     <Variable key=(testVar) default={false} />
//     <Room key=(test)>
//         <Description>
//             Test
//             <If {testVar}>
//                 <Space />
//                 TestTwo
//             </If><If {!testVar}>
//                 <Space />
//                 TestThree
//             </If><Bookmark key=(testBookmark) />
//         </Description>
//     </Room>
// </Asset>`
//         const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
//         expect(schemaToWML(schema)).toEqual(testWML)
//     })

//     it('should correctly escape special characters', () => {
//         const testWML = `<Asset key=(Test)>
//     <Room key=(test)>
//         <Description>
//             Test \\\\ \\< \\>
//         </Description>
//     </Room>
// </Asset>`
//         const schema = schemaFromParse(parse(tokenizer(new SourceStream(testWML))))
//         expect(schemaToWML(schema)).toMatchSnapshot()
//     })

// })
