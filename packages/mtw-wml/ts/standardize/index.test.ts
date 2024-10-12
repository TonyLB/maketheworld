import { Schema, schemaToWML } from '../schema'
import { Standardizer, defaultSelected } from '.'
import { deIndentWML } from '../schema/utils'
import { GenericTree } from '../tree/baseClasses'
import { SchemaTag } from '../schema/baseClasses'
import { StandardizerAbstract } from './abstract'

const schemaTestStandarized = (wml: string): Standardizer => {
    const schema = new Schema()
    schema.loadWML(wml)
    const standardized = new Standardizer(schema.schema)
    return standardized
}

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

describe('standardizeSchema', () => {

    it('should return an empty wrapper unchanged', () => {
        const test = schemaTestStandarized(`<Asset key=(Test) />`)
        expect(schemaToWML(test.schema)).toEqual(`<Asset key=(Test) />`)
    })

    it('should accept edit tags', () => {
        const test: GenericTree<SchemaTag> = [{
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
                }
            ]
        }]

        const standardizer = new Standardizer(test)
        expect(standardizer.standardForm).toEqual({
            tag: 'Asset',
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
                    themes: [],
                    shortName: { data: { tag: 'ShortName' }, children: [] },
                    summary: { data: { tag: 'Summary' }, children: [] },
                    description: { data: { tag: 'Description' }, children: [] },
                }
            }
        })
    })

    it('should accept meta tags', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Meta key=(ABC) time="1234" />
            <Room key=(testRoom)>
                <Description>Test Description</Description>
            </Room>
        </Asset>`)

        expect(test.standardForm).toEqual({
            tag: 'Asset',
            key: 'Test',
            metaData: [{ data: { tag: 'Meta', key: 'ABC', time: 1234 }, children: [] }],
            byId: {
                testRoom: {
                    tag: 'Room',
                    key: 'testRoom',
                    name: { data: { tag: 'Name' }, children: [] },
                    themes: [],
                    shortName: { data: { tag: 'ShortName' }, children: [] },
                    summary: { data: { tag: 'Summary' }, children: [] },
                    description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Test Description' }, children: [] }] },
                    exits: [],
                }
            }
        })
    })

    it('should accept condition tags without including wrapperKey', () => {
        const standardizer = schemaTestStandarized(`<Asset key=(Test)>
            <Room key=(Room1)>
                <Description>
                    <If {true}>True</If><Else>False</Else>
                </Description>
            </Room>
        </Asset>`)

        expect(standardizer.standardForm).toEqual({
            tag: 'Asset',
            key: 'Test',
            metaData: [],
            byId: {
                "Room1": {
                    tag: 'Room',
                    key: 'Room1',
                    name: { data: { tag: 'Name' }, children: [] },
                    shortName: { data: { tag: 'ShortName' }, children: [] },
                    summary: { data: { tag: 'Summary' }, children: [] },
                    exits: [],
                    themes: [],
                    description: { data: { tag: 'Description' }, children: [{
                        data: { tag: 'If' },
                        children: [
                            {
                                data: { tag: 'Statement', if: 'true', selected: false },
                                children: [{ data: { tag: 'String', value: 'True' }, children: [] }]
                            },
                            {
                                data: { tag: 'Fallthrough', selected: true },
                                children: [{ data: { tag: 'String', value: 'False' }, children: [] }]
                            }
                        ]
                    }] },
                }
            }
        })
    })

    it('should combine descriptions in rooms and features', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Room key=(test)>
                <Summary>
                    One
                    <br />
                </Summary>
                <Description>Three</Description>
            </Room>
            <If {false}>
                <Room key=(test)>
                    <Summary>
                        Two
                    </Summary>
                </Room>
                <Feature key=(testFeature)>
                    <Description>
                        Four
                    </Description>
                </Feature>
            </If>
            <Room key=(test)>
                <Name>Test Room</Name>
            </Room>
        </Asset>`)
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Name>Test Room</Name>
                    <Summary>One<br /><If {false}>Two</If></Summary>
                    <Description>Three</Description>
                </Room>
                <Feature key=(testFeature)>
                    <Description><If {false}>Four</If></Description>
                </Feature>
            </Asset>
        `))
    })

    it('should combine exits in rooms', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
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
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Description>One<br /></Description>
                    <If {false}><Exit to=(testTwo)>Test Exit</Exit></If>
                </Room>
                <Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>
            </Asset>
        `))
    })

    it('should combine render in nested rooms', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
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
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
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
        const test = schemaTestStandarized(`<Asset key=(Test)>
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
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
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
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>
                    <Link to=(testKnowledgeOne)>test</Link>
                </Description>
            </Room>
            <Knowledge key=(testKnowledgeOne)>
                <Name>TestOne</Name>
                <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
            </Knowledge>
            <Knowledge key=(testKnowledgeTwo)>
                <Name>TestTwo</Name>
                <Description>Test</Description>
            </Knowledge>
        </Asset>`)
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Description><Link to=(testKnowledgeOne)>test</Link></Description>
                </Room>
                <Knowledge key=(testKnowledgeOne)>
                    <Name>TestOne</Name>
                    <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                </Knowledge>
                <Knowledge key=(testKnowledgeTwo)>
                    <Name>TestTwo</Name>
                    <Description>Test</Description>
                </Knowledge>
            </Asset>
        `))
    })

    it('should render bookmarks correctly', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
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
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Bookmark key=(testOne)>TestOne<Bookmark key=(testThree) /></Bookmark>
                <Bookmark key=(testThree)>TestThree</Bookmark>
                <Bookmark key=(testTwo)>TestTwo<Bookmark key=(testOne) /></Bookmark>
            </Asset>
        `))
    })

    it('should render maps correctly', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
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
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
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
                    <If {false}>
                        <Room key=(testRoomTwo)><Position x="-100" y="0" /></Room>
                    </If>
                    <If {true} />
                </Map>
            </Asset>
        `))
    })

    it('should render empty maps', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)><Map key=(testMap) /></Asset>`)
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)><Map key=(testMap) /></Asset>
        `))
    })

    it('should render themes correctly', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
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
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
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
        const test = schemaTestStandarized(`<Asset key=(Test)>
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
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
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
        const test = schemaTestStandarized(`<Asset key=(Test)>
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
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
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
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Variable key=(testVar) default={false} />
            <Room key=(testRoomOne)>
                <Description>Test Room One</Description>
                <Exit to=(testRoomTwo)>two</Exit>
            </Room>
        </Asset>`)
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
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
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Computed key=(computeOne) src={computeThree} />
            <Computed key=(computeTwo) src={!computeOne} />
            <Computed key=(computeThree) src={!testVar} />
            <Variable key=(testVar) default={false} />
        </Asset>`)
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Variable key=(testVar) default={false} />
                <Computed key=(computeOne) src={computeThree} />
                <Computed key=(computeThree) src={!testVar} />
                <Computed key=(computeTwo) src={!computeOne} />
            </Asset>
        `))
    })

    it('should render actions correctly', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Action key=(actionOne) src={testVar = !testVar} />
            <Computed key=(computeOne) src={!testVar} />
            <Variable key=(testVar) default={false} />
        </Asset>`)
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Variable key=(testVar) default={false} />
                <Computed key=(computeOne) src={!testVar} />
                <Action key=(actionOne) src={testVar = !testVar} />
            </Asset>
        `))
    })

    it('should render imports correctly', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Import from=(vanishingPoint)>
                <Variable key=(testVar) from=(power) />
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
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(vanishingPoint)>
                    <Variable key=(testVar) from=(power) />
                    <Room key=(testRoomOne) />
                    <Map key=(testMap) />
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
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Import from=(vanishingPoint)>
                <Room key=(testRoomOne) />
            </Import>
        </Asset>`)
        expect(test._byId.testRoomOne).toEqual({
            description: { data: { tag: 'Description' }, children: [] },
            exits: [],
            key: 'testRoomOne',
            name: { data: { tag: 'Name' }, children: [] },
            shortName: { data: { tag: 'ShortName' }, children: [] },
            summary: { data: { tag: 'Summary' }, children: [] },
            tag: 'Room',
            themes: []
        })
        const mapTest = schemaTestStandarized(`<Asset key=(Test)>
            <Map key=(testMap)>
                <Room key=(testRoomOne)><Position x="0" y="100" /></Room>
            </Map>
        </Asset>`)
        expect(mapTest._byId.testRoomOne).toEqual({
            description: { data: { tag: 'Description' }, children: [] },
            exits: [],
            key: 'testRoomOne',
            name: { data: { tag: 'Name' }, children: [] },
            shortName: { data: { tag: 'ShortName' }, children: [] },
            summary: { data: { tag: 'Summary' }, children: [] },
            tag: 'Room',
            themes: []
        })
    })

    it('should render unedited imports correctly', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Import from=(vanishingPoint)>
                <Room key=(testRoomOne) />
            </Import>
        </Asset>`)
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(vanishingPoint)><Room key=(testRoomOne) /></Import>
            </Asset>
        `))
    })

    it('should render renamed imports correctly', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Import from=(vanishingPoint)>
                <Room key=(testRoomOne) as=(testRoomTwo)>
                    <ShortName>Test</ShortName>
                </Room>
            </Import>
        </Asset>`)
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
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
        const test = schemaTestStandarized(testSource)
        expect(schemaToWML(test.schema)).toEqual(testSource)
    })

    it('should render Remove tags correctly', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Remove><Room key=(testRoomTwo)><Name>Test To Delete</Name></Room></Remove>
            </Asset>
        `)
        const test = schemaTestStandarized(testSource)
        expect(schemaToWML(test.schema)).toEqual(testSource)
    })

    it('should render Replace tags correctly', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Replace><Variable key=(testVariable) default={true} /></Replace>
                <With><Variable key=(testVariable) default={false} /></With>
            </Asset>
        `)
        const test = schemaTestStandarized(testSource)
        expect(schemaToWML(test.schema)).toEqual(testSource)
    })

    it('should handle characters correctly', () => {
        const testSource = deIndentWML(`
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
                <Import from=(primitives) />
            </Character>
        `)
        const test = schemaTestStandarized(testSource)
        expect(schemaToWML(test.schema)).toEqual(testSource)
    })

    it('should combine multiple schemata correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Inherited>
                    <Room key=(testRoomOne)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Room>
                </Inherited>
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name><Space />(at night)</Name>
                    <Description><Space />Shadows cling to the corners of the room.</Description>
                </Room>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const standardizer = new Standardizer(inheritedSchema.schema, testSchema.schema)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name><Inherited>Lobby</Inherited><Space />(at night)</Name>
                    <Description>
                        <Inherited>A plain lobby.</Inherited><Space />Shadows cling to the
                        corners of the room.
                    </Description>
                </Room>
            </Asset>
        `))
    })

    it('should merge edit value tags correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Lobby</Name>
                    <Description>A plain lobby.</Description>
                </Room>
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Replace><Name>Lobby</Name></Replace>
                    <With><Name>Darkened lobby</Name></With>
                </Room>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new Standardizer(testSchema.schema)
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Darkened lobby</Name>
                    <Description>A plain lobby.</Description>
                </Room>
            </Asset>
        `))
    })

    it('should merge edit component remove of plain base component correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Lobby</Name>
                    <Description>A plain lobby.</Description>
                </Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Remove>
                    <Room key=(testRoomOne)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Room>
                </Remove>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new Standardizer(testSchema.schema)
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)><Room key=(testRoomTwo) /></Asset>
        `))
    })

    it('should merge edit component remove of replace base component correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Lobby</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed</Name></Room></With>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Remove>
                    <Room key=(testRoomOne)><Name>Changed</Name></Room>
                </Remove>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new Standardizer(testSchema.schema)
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Remove><Room key=(testRoomOne)><Name>Lobby</Name></Room></Remove>
                <Room key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component remove of empty base component correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Remove>
                    <Room key=(testRoomOne)><Name>Lobby</Name></Room>
                </Remove>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new Standardizer(testSchema.schema)
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomTwo) />
                <Remove><Room key=(testRoomOne)><Name>Lobby</Name></Room></Remove>
            </Asset>
        `))
    })

    it('should merge edit component replace of plain base component correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>                
                <Room key=(testRoomOne)><Name>Test</Name></Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Test</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed</Name></Room></With>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new Standardizer(testSchema.schema)
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)><Name>Changed</Name></Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component replace of replace base component correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Lobby</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed</Name></Room></With>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Changed</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed again</Name></Room></With>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new Standardizer(testSchema.schema)
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Lobby</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed again</Name></Room></With>
                <Room key=(testRoomTwo) />
            </Asset>
        `))
    })

    it('should merge edit component replace of empty base component correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Replace><Room key=(testRoomOne)><Name>Lobby</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed</Name></Room></With>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new Standardizer(testSchema.schema)
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomTwo) />
                <Replace><Room key=(testRoomOne)><Name>Lobby</Name></Room></Replace>
                <With><Room key=(testRoomOne)><Name>Changed</Name></Room></With>
            </Asset>
        `))
    })

    it('should apply edits on merge', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Room key=(testRoomTwo)>
                    <Exit to=(testRoomOne)>out</Exit>
                </Room>
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomTwo)>
                    <Remove><Exit to=(testRoomOne)>out</Exit></Remove>
                    <Exit to=(testRoomOne)>depart</Exit>
                </Room>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new Standardizer(testSchema.schema)
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Room key=(testRoomTwo)><Exit to=(testRoomOne)>depart</Exit></Room>
            </Asset>
        `))
    })

    it('should merge multiple standardComponents correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Inherited>
                    <Room key=(testRoomOne)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Room>
                    <Room key=(testRoomTwo)><Name>Test Two</Name></Room>
                </Inherited>
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name><Space />(at night)</Name>
                    <Description><Space />Shadows cling to the corners of the room.</Description>
                </Room>
                <Room key=(testRoomThree)><Name>Test Three</Name></Room>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new Standardizer(testSchema.schema)
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name><Inherited>Lobby</Inherited><Space />(at night)</Name>
                    <Description>
                        <Inherited>A plain lobby.</Inherited><Space />Shadows cling to the
                        corners of the room.
                    </Description>
                </Room>
                <Room key=(testRoomTwo)><Name><Inherited>Test Two</Inherited></Name></Room>
                <Room key=(testRoomThree)><Name>Test Three</Name></Room>
            </Asset>
        `))
    })

    it('should merge metadata correctly', () => {
        const inheritedSource = deIndentWML(`
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
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testSource = deIndentWML(`
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
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new Standardizer(testSchema.schema)
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(primitives)>
                    <Room key=(testRoomOne) />
                    <Room key=(testRoomThree) />
                </Import>
                <Room key=(testRoomOne)>
                    <Name>Lobby<Space />(at night)</Name>
                    <Description>
                        A plain lobby.<Space />Shadows cling to the corners of the room.
                    </Description>
                </Room>
                <Room key=(testRoomTwo)><Name>Test Two</Name></Room>
                <Room key=(testRoomThree)><Name>Test Three</Name></Room>
            </Asset>
        `))
    })

    it('should merge edited metadata correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Import from=(primitives)>
                    <Room key=(testRoomOne) />
                </Import>
                <Room key=(testRoomOne)><Name>Test</Name></Room>
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Replace>
                    <Import from=(primitives)>
                        <Room key=(testRoomOne) />
                    </Import>
                </Replace>
                <With>
                    <Import from=(test)>
                        <Room key=(testRoomOne) />
                    </Import>
                </With>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new Standardizer(testSchema.schema)
        console.log(`testStandard: ${JSON.stringify(testStandard._byId, null, 4)}`)
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(test)><Room key=(testRoomOne) /></Import>
                <Room key=(testRoomOne)><Name>Test</Name></Room>
            </Asset>
        `))
    })

    it('should merge multiple serializable standardComponents correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Inherited>
                    <Room key=(testRoomOne)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Room>
                    <Room key=(testRoomTwo)><Name>Test Two</Name></Room>
                </Inherited>
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        const testStandard = new StandardizerAbstract()
        testStandard.loadStandardForm({
            key: 'Test',
            tag: 'Asset',
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
        const standardizer = inheritedStandard.merge(testStandard)
        expect(schemaToWML(standardizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name><Inherited>Lobby</Inherited>: Night</Name>
                    <Description><Inherited>A plain lobby.</Inherited></Description>
                </Room>
                <Room key=(testRoomTwo)><Name><Inherited>Test Two</Inherited></Name></Room>
            </Asset>
        `))
    })

    it('should filter correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Inherited>
                    <Room key=(testRoomOne)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Room>
                </Inherited>
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name><Space />(at night)</Name>
                    <Description><Space />Shadows cling to the corners of the room.</Description>
                </Room>
            </Asset>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const standardizer = new Standardizer(inheritedSchema.schema, testSchema.schema)
        expect(schemaToWML(standardizer.filter({ not: { match: 'Inherited' }}).schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name><Space />(at night)</Name>
                    <Description>
                        <Space />Shadows cling to the corners of the room.
                    </Description>
                </Room>
            </Asset>
        `))
        expect(schemaToWML(standardizer.filter({ match: 'Inherited' }).schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name><Inherited>Lobby</Inherited></Name>
                    <Description><Inherited>A plain lobby.</Inherited></Description>
                </Room>
            </Asset>
        `))
    })

    it('should prune correctly', () => {
        const inheritedSource = deIndentWML(`
            <Asset key=(Test)>
                <Inherited>
                    <Room key=(testRoomOne)>
                        <Name>Lobby</Name>
                        <Description>A plain lobby.</Description>
                    </Room>
                </Inherited>
            </Asset>
        `)
        const inheritedSchema = new Schema()
        inheritedSchema.loadWML(inheritedSource)
        const inheritedStandard = new Standardizer(inheritedSchema.schema)
        expect(schemaToWML(inheritedStandard.prune({ match: 'Inherited' }).schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Lobby</Name>
                    <Description>A plain lobby.</Description>
                </Room>
            </Asset>
        `))
    })

    it('should assign dependencies correctly', () => {
        const extract = () => ['Test']
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Name>Unconditioned<If {testVar}>Conditioned</If></Name>
                </Room>
                <Variable key=(testVar) default={true} />
            </Asset>
        `)
        const test = schemaTestStandarized(testSource)
        test.assignDependencies(extract)
        expect(test.standardForm.byId.testRoomOne).toEqual({
            tag: 'Room',
            key: 'testRoomOne',
            shortName: { data: { tag: 'ShortName' }, children: [] },
            name: {
                data: { tag: 'Name' },
                children: [
                    { data: { tag: 'String', value: 'Unconditioned' }, children: [] },
                    {
                        data: { tag: 'If' },
                        children: [{
                            data: { tag: 'Statement', if: 'testVar', dependencies: ['Test'], selected: false },
                            children: [{ data: { tag: 'String', value: 'Conditioned' }, children: [] }]
                        }]
                    }
                ]
            },
            summary: { data: { tag: 'Summary' }, children: [] },
            description: { data: { tag: 'Description' }, children: [] },
            exits: [],
            themes: []
        })
    })

    it('should produced a serializable format stripped of UUIDs', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>
                    One
                    <br />
                </Description>
            </Room>
            <Room key=(testTwo) />
            <Map key=(testMap)>
                <Room key=(test)><Position x="0" y="0" /></Room>
                <Room key=(testTwo)><Position x="100" y="0" /></Room>
            </Map>
        </Asset>`)
        expect(test.standardForm.byId).toEqual({
            test: {
                key: 'test',
                tag: 'Room',
                shortName: { data: { tag: 'ShortName' }, children: [] },
                name: { data: { tag: 'Name' }, children: [] },
                summary: { data: { tag: 'Summary' }, children: [] },
                description: {
                    data: { tag: 'Description' },
                    children: [
                        { data: { tag: 'String', value: 'One' }, children: [] },
                        { data: { tag: 'br' }, children: [] }
                    ]
                },
                exits: [],
                themes: []
            },
            testTwo: {
                key: 'testTwo',
                tag: 'Room',
                shortName: { data: { tag: 'ShortName' }, children: [] },
                name: { data: { tag: 'Name' }, children: [] },
                summary: { data: { tag: 'Summary' }, children: [] },
                description: { data: { tag: 'Description' }, children: [] },
                exits: [],
                themes: []
            },
            testMap: {
                key: 'testMap',
                tag: 'Map',
                name: { data: { tag: 'Name' }, children: [] },
                images: [],
                positions: [
                    { data: { tag: 'Room', key: 'test' }, children: [{ data: { tag: 'Position', x: 0, y: 0 }, children: [] }] },
                    { data: { tag: 'Room', key: 'testTwo' }, children: [{ data: { tag: 'Position', x: 100, y: 0 }, children: [] }] }
                ],
                themes: []
            }
        })

    })

    it('should correctly denormalize Theme references', () => {
        const test = schemaTestStandarized(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>
                    One
                    <br />
                </Description>
            </Room>
            <Room key=(testTwo) />
            <Map key=(testMap)>
                <Room key=(test)><Position x="0" y="0" /></Room>
                <Room key=(testTwo)><Position x="100" y="0" /></Room>
            </Map>
            <Theme key=(theme1)>
                <Name>Spooky</Name>
                <Prompt>Spooky</Prompt>
                <Room key=(test) />
                <Map key=(testMap) />
            </Theme>
        </Asset>`)
        expect(test.standardForm.byId).toEqual({
            test: {
                key: 'test',
                tag: 'Room',
                shortName: { data: { tag: 'ShortName' }, children: [] },
                name: { data: { tag: 'Name' }, children: [] },
                summary: { data: { tag: 'Summary' }, children: [] },
                description: {
                    data: { tag: 'Description' },
                    children: [
                        { data: { tag: 'String', value: 'One' }, children: [] },
                        { data: { tag: 'br' }, children: [] }
                    ]
                },
                exits: [],
                themes: [{ data: { tag: 'Theme', key: 'theme1' }, children: [{ data: { tag: 'Room', key: 'test' }, children: [] }] }]
            },
            testTwo: {
                key: 'testTwo',
                tag: 'Room',
                shortName: { data: { tag: 'ShortName' }, children: [] },
                name: { data: { tag: 'Name' }, children: [] },
                summary: { data: { tag: 'Summary' }, children: [] },
                description: { data: { tag: 'Description' }, children: [] },
                exits: [],
                themes: []
            },
            testMap: {
                key: 'testMap',
                tag: 'Map',
                name: { data: { tag: 'Name' }, children: [] },
                images: [],
                positions: [
                    { data: { tag: 'Room', key: 'test' }, children: [{ data: { tag: 'Position', x: 0, y: 0 }, children: [] }] },
                    { data: { tag: 'Room', key: 'testTwo' }, children: [{ data: { tag: 'Position', x: 100, y: 0 }, children: [] }] }
                ],
                themes: [{ data: { tag: 'Theme', key: 'theme1' }, children: [{ data: { tag: 'Map', key: 'testMap' }, children: [] }] }]
            },
            theme1: {
                key: 'theme1',
                tag: 'Theme',
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Spooky' }, children: [] }] },
                prompts: [{ data: { tag: 'Prompt', value: 'Spooky' }, children: [] }],
                rooms: [{ data: { tag: 'Room', key: 'test' }, children: [] }],
                maps: [{ data: { tag: 'Map', key: 'testMap' }, children: [] }]
            }
        })

    })

})
