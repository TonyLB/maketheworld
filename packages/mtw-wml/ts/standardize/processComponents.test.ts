import { Schema, schemaToWML } from "../schema"
import { deIndentWML } from "../schema/utils"
import processComponents from "./processComponents"
import StandardRoom from "./components/room"
import StandardReference from "./keys/reference"
import { StandardKey } from "./keys/key"

const componentOrder: string[] = [
    'Character',
    'Image',
    'Room',
    'Feature',
    'Knowledge',
    'Map',
    'Message',
    'Moment',
    'Example'
]

describe("processComponents", () => {
    it('should return an empty object when given an empty object', () => {
        const schema = new Schema()
        schema.loadWML(`<Asset uuid=(test) />`)
        const result = processComponents({
            componentOrder,
            schema: schema.schema,
        })
        expect(result.components).toEqual([])
        expect(result.topLevel.payload).toEqual([])
    })

    it('should parse a provided schema', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Test Room</DisplayName>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Situation>
                </Room>
                <Feature key=(testFeature)>
                    <Example uuid=(testFeatureExample)>
                        <Description>Four</Description>
                    </Example>
                </Feature>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentOrder,
            schema: schema.schema
        })

        expect(result.components.find(({ key }) => (key === 'test')) instanceof StandardRoom).toBe(true)
        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Test Room</DisplayName>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Situation>
                </Room>
            `),
            '<Feature key=(testFeature)><Example uuid=(testFeatureExample) /></Feature>',
            deIndentWML(`
                <Example uuid=(testFeatureExample)><Description>Four</Description></Example>
            `)
        ])
    })

    it('should correctly localize subcomponents', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Test Room</DisplayName>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Situation>
                    <Feature key=(testLocal)>
                        <Example uuid=(testLocalExample)><Description>Local</Description></Example>
                    </Feature>
                    <Feature key=(testGlobal)>
                        <Example uuid=(testGlobalExample)><Description>Global</Description></Example>
                    </Feature>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentOrder,
            schema: schema.schema,
        })
        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(test)>
                    <Feature key=(testLocal) />
                    <Feature key=(testGlobal) />
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Test Room</DisplayName>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Situation>
                </Room>
            `),
            deIndentWML(`
                <Feature key=(testLocal)><Example uuid=(testLocalExample) /></Feature>
            `),
            deIndentWML(`
                <Example uuid=(testLocalExample)><Description>Local</Description></Example>
            `),
            deIndentWML(`
                <Feature key=(testGlobal)><Example uuid=(testGlobalExample) /></Feature>
            `),
            deIndentWML(`
                <Example uuid=(testGlobalExample)><Description>Global</Description></Example>
            `),
        ])
        //
        // TODO: Test that context is correctly applied to local components
        //
    })

    it('should combine descriptions in rooms and features', () => {
        const test = `
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <Summary>
                            One
                            <br />
                        </Summary>
                        <Description>Three</Description>
                    </Situation>
                </Room>
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <Summary>
                            Two
                        </Summary>
                    </Situation>
                </Room>
                <Feature key=(testFeature)>
                    <Example uuid=(testFeatureExample)>
                        <Description>
                            Four
                        </Description>
                    </Example>
                </Feature>
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Test Room</DisplayName>
                    </Situation>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(test)
        const result = processComponents({
            componentOrder,
            schema: schema.schema,
        })

        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <Summary>One<br /></Summary>
                        <Description>Three</Description>
                    </Situation>
                </Room>
            `),
            deIndentWML(`
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)><Summary>Two</Summary></Situation>
                </Room>
            `),
            `<Feature key=(testFeature)><Example uuid=(testFeatureExample) /></Feature>`,
            `<Example uuid=(testFeatureExample)><Description>Four</Description></Example>`,
            deIndentWML(`
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)><DisplayName>Test Room</DisplayName></Situation>
                </Room>
            `),
        ])
    })

    it('should combine exits in rooms', () => {
        const test = `
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <Description>
                            One
                            <br />
                        </Description>
                    </Situation>
                </Room>
                <Room key=(testTwo) />
                <Room key=(test)>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
                <Room key=(testTwo)>
                    <Exit to=(test)>Test Return</Exit>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(test)
        const result = processComponents({
            componentOrder,
            schema: schema.schema,
        })

        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)><Description>One<br /></Description></Situation>
                </Room>
            `),
            `<Room key=(testTwo) />`,
            `<Room key=(test)><Exit to=(testTwo)>Test Exit</Exit></Room>`,
            `<Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>`
        ])
    })

    it('should combine render in nested rooms', () => {
        const test = `
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <Description>
                            One
                            <br />
                        </Description>
                    </Situation>
                </Room>
                <Room key=(testTwo) />
                <Message key=(testMessage)>
                    <Description>Test message</Description>
                    <Room key=(test)>
                        <Situation uuid=(DEFAULT)>
                            <Description>
                                Two
                            </Description>
                        </Situation>
                        <Exit to=(testTwo)>Test Exit</Exit>
                    </Room>
                </Message>
                <Room key=(testTwo)>
                    <Exit to=(test)>Test Return</Exit>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(test)
        const result = processComponents({
            componentOrder,
            schema: schema.schema,
        })

        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)><Description>One<br /></Description></Situation>
                </Room>
            `),
            `<Room key=(testTwo) />`,
            deIndentWML(`
                <Message key=(testMessage)>
                    <Room key=(test) />
                    <Description>Test message</Description>
                </Message>`
            ),
            deIndentWML(`
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)><Description>Two</Description></Situation>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            `),
            `<Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>`
        ])
    })

    it('should render features and links correctly', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <Description>
                            <Link to=(testFeatureOne)>test</Link>
                        </Description>
                    </Situation>
                </Room>
                <Feature key=(testFeatureOne)>
                    <Example uuid=(testFeatureOneExample)>
                        <DisplayName>TestOne</DisplayName>
                        <Description><Link to=(testFeatureTwo)>two</Link></Description>
                    </Example>
                </Feature>
                <Feature key=(testFeatureTwo)>
                    <Example uuid=(testFeatureTwoExample)>
                        <DisplayName>TestTwo</DisplayName>
                        <Description>Test</Description>
                    </Example>
                </Feature>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentOrder,
            schema: schema.schema,
        })

        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(test)>
                    <Situation uuid=(DEFAULT)>
                        <Description><Link to=(testFeatureOne)>test</Link></Description>
                    </Situation>
                </Room>
            `),
            deIndentWML(`
                <Feature key=(testFeatureOne)>
                    <Example uuid=(testFeatureOneExample) />
                </Feature>
            `),
            deIndentWML(`
                <Example uuid=(testFeatureOneExample)>
                    <DisplayName>TestOne</DisplayName>
                    <Description><Link to=(testFeatureTwo)>two</Link></Description>
                </Example>
            `),
            deIndentWML(`
                <Feature key=(testFeatureTwo)>
                    <Example uuid=(testFeatureTwoExample) />
                </Feature>
            `),
            deIndentWML(`
                <Example uuid=(testFeatureTwoExample)>
                    <DisplayName>TestTwo</DisplayName>
                    <Description>Test</Description>
                </Example>
            `)
        ])
    })

    it('should correctly parse a map', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Map key=(testMap)>
                    <Room key=(testRoom)>
                        <Situation uuid=(DEFAULT)><Description>Test</Description></Situation>
                        <Position {0, 100} />
                        <Exit to=(testTwo)>Test Exit</Exit>
                    </Room>
                </Map>
                <Room key=(testTwo) />
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentOrder,
            schema: schema.schema,
        })
        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Map key=(testMap)><Room key=(testRoom)><Position {0, 100} /></Room></Map>
            `),
            deIndentWML(`
                <Room key=(testRoom)>
                    <Situation uuid=(DEFAULT)><Description>Test</Description></Situation>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            `),
            deIndentWML(`
                <Room key=(testTwo) />
            `)
        ])
    })

    it('should parse a remove tag', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Remove>
                    <Room key=(test)>
                        <Situation uuid=(DEFAULT)><Description>Test</Description></Situation>
                    </Room>
                </Remove>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentOrder,
            schema: schema.schema,
        })
        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            `<Room key=(test)><Remove><Description>Test</Description></Remove></Room>`,
        ])
    })

    it('should allow Characters as legal sub-components of Room', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Room key=(testRoom)>
                    <Character key=(testCharacter)>
                        <DisplayName>Test Character</DisplayName>
                    </Character>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentOrder,
            schema: schema.schema,
        })
        
        const roomComponent = result.components.find(({ key }) => (key === 'testRoom'))
        expect(roomComponent).toBeDefined()        
        expect(schemaToWML([roomComponent!.schema])).toBe('<Room key=(testRoom)><Character key=(testCharacter) /></Room>')
    })

    describe('topLevel ReferenceList', () => {
        it('should populate topLevel with asset-level components', () => {
            const testSource = `
                <Asset uuid=(Test)>
                    <Room key=(room1) />
                    <Room key=(room2) />
                    <Feature key=(feature1) />
                </Asset>
            `
            const schema = new Schema()
            schema.loadWML(testSource)
            const result = processComponents({
                componentOrder,
                schema: schema.schema,
                assetUUID: 'ASSET#Test'
            })
            
            // Should have 3 top-level components
            expect(result.topLevel.payload.length).toBe(3)
            
            // Check that all are StandardReference (not Remove)
            const topLevelKeys = result.topLevel.payload.map(ref => {
                expect(ref).toBeInstanceOf(StandardReference)
                return ref.standardKey.toJSON()
            })
            
            expect(topLevelKeys).toContainEqual({ key: 'room1' })
            expect(topLevelKeys).toContainEqual({ key: 'room2' })
            expect(topLevelKeys).toContainEqual({ key: 'feature1' })
        })

        it('should not include nested components in topLevel', () => {
            const testSource = `
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Feature key=(feature1) />
                        <Example uuid=(example1) />
                    </Room>
                </Asset>
            `
            const schema = new Schema()
            schema.loadWML(testSource)
            const result = processComponents({
                componentOrder,
                schema: schema.schema,
                assetUUID: 'ASSET#Test'
            })
            
            // Should only have Room in topLevel, not Feature or Example
            expect(result.topLevel.payload.length).toBe(1)
            const topLevelKey = result.topLevel.payload[0].standardKey.toJSON()
            expect(topLevelKey).toEqual({ key: 'room1' })
        })

        it('should create Remove references in topLevel for components in Remove context', () => {
            const testSource = `
                <Asset uuid=(Test)>
                    <Room key=(room1) />
                    <Remove>
                        <Room key=(room2) />
                    </Remove>
                </Asset>
            `
            const schema = new Schema()
            schema.loadWML(testSource)
            const result = processComponents({
                componentOrder,
                schema: schema.schema,
                assetUUID: 'ASSET#Test'
            })
            
            // Should have room1 as Simple and room2 as Remove
            expect(result.topLevel.payload.length).toBe(2)
            
            const room1Ref = result.topLevel.payload.find(ref => ref.key === 'room1')
            expect(room1Ref).toBeInstanceOf(StandardReference)
            
            const room2Ref = result.topLevel.payload.find(ref => ref.key === 'room2')
            expect(room2Ref?.ref).toBe(-1)
        })

        it('should return empty ReferenceList when no assetUUID provided', () => {
            const testSource = `
                <Asset uuid=(Test)>
                    <Room key=(room1) />
                </Asset>
            `
            const schema = new Schema()
            schema.loadWML(testSource)
            const result = processComponents({
                componentOrder,
                schema: schema.schema
                // No assetUUID
            })
            
            // Should be empty since no assetUUID means components aren't top-level
            expect(result.topLevel.payload.length).toBe(0)
        })
    })

    describe('referenceCollection', () => {
        it('should return empty referenceCollection when no components', () => {
            const schema = new Schema()
            schema.loadWML(`<Asset uuid=(test) />`)
            const result = processComponents({
                componentOrder,
                schema: schema.schema,
            })
            expect(result.referenceCollection.references.length).toBe(0)
        })

        it('should build referenceCollection from simple flat schema', () => {
            const testSource = `
                <Asset uuid=(Test)>
                    <Room key=(room1) />
                    <Room key=(room2) />
                    <Feature key=(feature1) />
                </Asset>
            `
            const schema = new Schema()
            schema.loadWML(testSource)
            const result = processComponents({
                componentOrder,
                schema: schema.schema,
                assetUUID: 'ASSET#Test'
            })
            
            expect(result.referenceCollection.references.length).toBe(3)
            
            const room1 = result.referenceCollection.lookup(new StandardKey({ key: 'room1' }))
            expect(room1?.key).toBe('room1')
            expect(room1?.tag).toBe('Room')
            
            const room2 = result.referenceCollection.lookup(new StandardKey({ key: 'room2' }))
            expect(room2?.key).toBe('room2')
            expect(room2?.tag).toBe('Room')
            
            const feature1 = result.referenceCollection.lookup(new StandardKey({ key: 'feature1' }))
            expect(feature1?.key).toBe('feature1')
            expect(feature1?.tag).toBe('Feature')
        })

        it('should include all components in referenceCollection from nested schema', () => {
            const testSource = `
                <Asset uuid=(Test)>
                    <Room key=(room1)>
                        <Feature key=(feature1) />
                        <Example uuid=(example1) />
                    </Room>
                    <Feature key=(feature2) />
                </Asset>
            `
            const schema = new Schema()
            schema.loadWML(testSource)
            const result = processComponents({
                componentOrder,
                schema: schema.schema,
                assetUUID: 'ASSET#Test'
            })
            
            // Should include Room, Feature (nested), Example, and Feature (top-level)
            expect(result.referenceCollection.references.length).toBeGreaterThanOrEqual(3)
            
            const room1 = result.referenceCollection.lookup(new StandardKey({ key: 'room1' }))
            expect(room1?.tag).toBe('Room')
            
            const feature1 = result.referenceCollection.lookup(new StandardKey({ key: 'feature1' }))
            expect(feature1?.tag).toBe('Feature')
            
            const feature2 = result.referenceCollection.lookup(new StandardKey({ key: 'feature2' }))
            expect(feature2?.tag).toBe('Feature')
        })

        it('should merge duplicate component appearances in referenceCollection', () => {
            const testSource = `
                <Asset uuid=(Test)>
                    <Room key=(room1) />
                    <Room key=(room1) uuid=(uuid1) />
                </Asset>
            `
            const schema = new Schema()
            schema.loadWML(testSource)
            const result = processComponents({
                componentOrder,
                schema: schema.schema,
                assetUUID: 'ASSET#Test'
            })
            
            // Should merge the two room1 appearances into one
            const room1Refs = result.referenceCollection.references.filter(ref => ref.key === 'room1')
            expect(room1Refs.length).toBe(1)
            
            const room1 = result.referenceCollection.lookup(new StandardKey({ key: 'room1' }))
            expect(room1?.key).toBe('room1')
            expect(room1?.universalKey).toBe('ROOM#uuid1')
            expect(room1?.tag).toBe('Room')
        })

        it('should handle components with universalKey in referenceCollection', () => {
            const testSource = `
                <Asset uuid=(Test)>
                    <Room uuid=(room1) />
                    <Room key=(room2) />
                </Asset>
            `
            const schema = new Schema()
            schema.loadWML(testSource)
            const result = processComponents({
                componentOrder,
                schema: schema.schema,
                assetUUID: 'ASSET#Test'
            })
            
            // Find the room with uuid - it should have a universalKey set
            const roomWithUUID = result.referenceCollection.references.find(ref => ref.universalKey === 'ROOM#room1')
            expect(roomWithUUID).toBeDefined()
            expect(roomWithUUID?.tag).toBe('Room')
            
            const room2 = result.referenceCollection.lookup(new StandardKey({ key: 'room2' }))
            expect(room2?.key).toBe('room2')
            expect(room2?.tag).toBe('Room')
        })
    })
})