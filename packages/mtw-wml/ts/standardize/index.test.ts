import { Schema, schemaToWML } from '../schema'
import { Standardizer } from '.'
import { deIndentWML } from '../schema/utils'
import { GenericTree } from '../tree/baseClasses'
import { SchemaTag } from '../schema/baseClasses'

const schemaTestStandarized = (wml: string): Standardizer => {
    const schema = new Schema()
    schema.loadWML(wml)
    const standardized = new Standardizer(schema.schema)
    return standardized
}

describe('standardizeSchema', () => {

    it('should return an empty wrapper unchanged', () => {
        const test = schemaTestStandarized(`<Asset key=(Test) />`)
        expect(schemaToWML(test.schema)).toEqual(`<Asset key=(Test) />`)
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
                    <Room key=(testRoomTwo)>
                        <Position x="-100" y="0" />
                        <Description>Test Room Two</Description>
                        <Exit to=(testRoomOne)>one</Exit>
                    </Room>
                </If>
                <Image key=(mapBackground) />
            </Map>
        </Asset>`)
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room key=(testRoomTwo)>
                    <Description><If {false}>Test Room Two</If></Description>
                    <If {false}><Exit to=(testRoomOne)>one</Exit></If>
                </Room>
                <Map key=(testMap)>
                    <Name>Test map</Name>
                    <Image key=(mapBackground) />
                    <Room key=(testRoomOne)><Position x="0" y="0" /></Room>
                    <Room key=(testRoomTwo)>
                        <If {false}><Position x="-100" y="0" /></If>
                    </Room>
                </Map>
            </Asset>
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
                <Theme key=(testTheme)>
                    <Name>Spooky shenanigans</Name>
                    <Prompt>Spooky</Prompt>
                    <Room key=(testRoomOne) />
                    <Map key=(testMap) />
                </Theme>
                <Room key=(testRoomOne) />
                <Map key=(testMap)>
                    <Room key=(testRoomOne)><Position x="0" y="0" /></Room>
                </Map>
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
            </Import>
            <Variable key=(testVar) />
        </Asset>`)
        expect(schemaToWML(test.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Import from=(vanishingPoint)>
                    <Variable key=(testVar) from=(power) />
                    <Room key=(testRoomOne) />
                </Import>
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
            </Asset>
        `))
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

    it('should preserve tree IDs on combination', () => {
        const inheritedSchema: GenericTree<SchemaTag, { inherited: boolean; id: string }> = [{
            data: { tag: 'Asset', key: 'Test', Story: undefined },
            id: 'Asset',
            inherited: true,
            children: [{
                data: { tag: 'Inherited' },
                id: 'Inherited',
                inherited: true,
                children: [{
                    data: { tag: 'Room', key: 'testRoomOne' },
                    id: 'Room',
                    inherited: true,
                    children: [{
                        data: { tag: 'Description' },
                        id: 'Description',
                        inherited: true,
                        children: [{
                            data: { tag: 'String', value: 'A plain lobby.' },
                            id: 'String',
                            inherited: true,
                            children: []
                        }]
                    }]
                }]
            }]
        }]
        const testSchema: GenericTree<SchemaTag, { id: string }> = [{
            data: { tag: 'Asset', key: 'Test', Story: undefined },
            id: 'ABC',
            children: [{
                data: { tag: 'Room', key: 'testRoomOne' },
                id: 'DEF',
                children: [{
                    data: { tag: 'Name' },
                    id: 'GHI',
                    children: [{
                        data: { tag: 'String', value: 'Lobby' },
                        id: 'JKL',
                        children: []
                    }]
                },
                {
                    data: { tag: 'Description' },
                    id: 'MNO',
                    children: [{
                        data: { tag: 'String', value: 'In darkness.' },
                        id: 'QRS',
                        children: []
                    }]
                }]
            }]
        }]
        const standardizer = new Standardizer(inheritedSchema, testSchema)
        expect(standardizer.schema).toEqual([{
            data: { tag: 'Asset', key: 'Test', Story: undefined },
            id: 'ABC',
            children: [{
                data: { tag: 'Room', key: 'testRoomOne' },
                id: 'DEF',
                children: [{
                    data: { tag: 'Name' },
                    id: 'GHI',
                    children: [{
                        data: { tag: 'String', value: 'Lobby' },
                        id: 'JKL',
                        children: []
                    }]
                },
                {
                    data: { tag: 'Description' },
                    id: 'MNO',
                    children: [{
                        data: { tag: 'Inherited' },
                        id: 'Inherited',
                        children: [{
                            data: { tag: 'String', value: 'A plain lobby.'},
                            id: 'String',
                            children: []
                        }]
                    },
                    {
                        data: { tag: 'String', value: 'In darkness.' },
                        id: 'QRS',
                        children: []
                    }]
                }]
            }]
        }])
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
            id: expect.any(String),
            shortName: { data: { tag: 'ShortName' }, id: '', children: [] },
            name: {
                data: { tag: 'Name' },
                id: expect.any(String),
                children: [
                    { data: { tag: 'String', value: 'Unconditioned' }, id: expect.any(String), children: [] },
                    {
                        data: { tag: 'If' },
                        id: expect.any(String),
                        children: [{
                            data: { tag: 'Statement', if: 'testVar', dependencies: ['Test'] },
                            id: expect.any(String),
                            children: [{ data: { tag: 'String', value: 'Conditioned' }, id: expect.any(String), children: [] }]
                        }]
                    }
                ]
            },
            summary: { data: { tag: 'Summary' }, id: '', children: [] },
            description: { data: { tag: 'Description' }, id: '', children: [] },
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
        expect(test.stripped.byId).toEqual({
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
                <Prompt>Spooky</Prompt>
                <Room key=(test) />
                <Map key=(testMap) />
            </Theme>
        </Asset>`)
        expect(test.stripped.byId).toEqual({
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
                name: { data: { tag: 'Name' }, children: [] },
                prompts: [{ data: { tag: 'Prompt', value: 'Spooky' }, children: [] }],
                rooms: [{ data: { tag: 'Room', key: 'test' }, children: [] }],
                maps: [{ data: { tag: 'Map', key: 'testMap' }, children: [] }]
            }
        })

    })

})
