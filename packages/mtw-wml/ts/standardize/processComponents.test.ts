import { objectMap } from "../lib/objects"
import { Schema, schemaToWML } from "../schema"
import { deIndentWML } from "../schema/utils"
import processComponents, { ComponentProcessingTemplate } from "./processComponents"
import StandardRoom from "./components/room"
import { StandardKey } from "./components/reference"

const componentTemplates: ComponentProcessingTemplate[] = [
    { 
        key: 'Character',
        legalParents: ['Room']
    },
    { key: 'Image' },
    {
        key: 'Room',
        legalParents: ['Map', 'Message']
    },
    {
        key: 'Feature',
        legalParents: ['Room']
    },
    { key: 'Knowledge' },
    { key: 'Map' },
    {
        key: 'Message',
        legalParents: ['Moment']
    },
    { key: 'Moment' },
    {
        key: 'Example',
        legalParents: ['Room', 'Feature', 'Knowledge']
    }
]

describe("processComponents", () => {
    it('should return an empty object when given an empty object', () => {
        const schema = new Schema()
        schema.loadWML(`<Asset uuid=(test) />`)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })
        expect(result.components).toEqual([])
        expect(result.topLevel).toEqual([])
    })

    it('should parse a provided schema', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Example uuid=(testRoomExample)>
                        <Name>Test Room</Name>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Example>
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
            componentTemplates,
            schema: schema.schema
        })

        expect(result.components.find(({ key }) => (key === 'test')) instanceof StandardRoom).toBe(true)
        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            '<Room key=(test)><Example uuid=(testRoomExample) /></Room>',
            deIndentWML(`
                <Example uuid=(testRoomExample)>
                    <Name>Test Room</Name>
                    <Summary>One<br />Two</Summary>
                    <Description>Three</Description>
                </Example>
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
                    <Example uuid=(testRoomExample)>
                        <Name>Test Room</Name>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Example>
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
            componentTemplates,
            schema: schema.schema,
        })
        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(test)>
                    <Feature key=(testLocal) />
                    <Feature key=(testGlobal) />
                    <Example uuid=(testRoomExample) />
                </Room>
            `),
            deIndentWML(`
                <Example uuid=(testRoomExample)>
                    <Name>Test Room</Name>
                    <Summary>One<br />Two</Summary>
                    <Description>Three</Description>
                </Example>
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
            `)
        ])
        //
        // TODO: Test that context is correctly applied to local components
        //
    })

    it('should combine descriptions in rooms and features', () => {
        const test = `
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Example uuid=(testRoomExample)>
                        <Summary>
                            One
                            <br />
                        </Summary>
                        <Description>Three</Description>
                    </Example>
                </Room>
                <Room key=(test)>
                    <Example uuid=(testRoomExample)>
                        <Summary>
                            Two
                        </Summary>
                    </Example>
                </Room>
                <Feature key=(testFeature)>
                    <Example uuid=(testFeatureExample)>
                        <Description>
                            Four
                        </Description>
                    </Example>
                </Feature>
                <Room key=(test)>
                    <Example uuid=(testRoomExample)>
                        <Name>Test Room</Name>
                    </Example>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(test)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })

        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            `<Room key=(test)><Example uuid=(testRoomExample) /></Room>`,
            deIndentWML(`
                <Example uuid=(testRoomExample)>
                    <Summary>One<br /></Summary>
                    <Description>Three</Description>
                </Example>
            `),
            `<Room key=(test)><Example uuid=(testRoomExample) /></Room>`,
            `<Example uuid=(testRoomExample)><Summary>Two</Summary></Example>`,
            `<Feature key=(testFeature)><Example uuid=(testFeatureExample) /></Feature>`,
            `<Example uuid=(testFeatureExample)><Description>Four</Description></Example>`,
            `<Room key=(test)><Example uuid=(testRoomExample) /></Room>`,
            `<Example uuid=(testRoomExample)><Name>Test Room</Name></Example>`
        ])
    })

    it('should combine exits in rooms', () => {
        const test = `
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Example uuid=(testRoomExample)>
                        <Description>
                            One
                            <br />
                        </Description>
                    </Example>
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
            componentTemplates,
            schema: schema.schema,
        })

        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            `<Room key=(test)><Example uuid=(testRoomExample) /></Room>`,
            `<Example uuid=(testRoomExample)><Description>One<br /></Description></Example>`,
            `<Room key=(testTwo) />`,
            `<Room key=(test)><Exit to=(testTwo)>Test Exit</Exit></Room>`,
            `<Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>`
        ])
    })

    it('should combine render in nested rooms', () => {
        const test = `
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Example uuid=(testRoomExample)>
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
                        <Example uuid=(testRoomExample)>
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
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(test)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })

        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            `<Room key=(test)><Example uuid=(testRoomExample) /></Room>`,
            `<Example uuid=(testRoomExample)><Description>One<br /></Description></Example>`,
            `<Room key=(testTwo) />`,
            `<Message key=(testMessage)><Room key=(test) />Test message</Message>`,
            deIndentWML(`
                <Room key=(test)>
                    <Example uuid=(testRoomExample) />
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            `),
            `<Example uuid=(testRoomExample)><Description>Two</Description></Example>`,
            `<Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>`
        ])
    })

    it('should render features and links correctly', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Example uuid=(testRoomExample)>
                        <Description>
                            <Link to=(testFeatureOne)>test</Link>
                        </Description>
                    </Example>
                </Room>
                <Feature key=(testFeatureOne)>
                    <Example uuid=(testFeatureOneExample)>
                        <Name>TestOne</Name>
                        <Description><Link to=(testFeatureTwo)>two</Link></Description>
                    </Example>
                </Feature>
                <Feature key=(testFeatureTwo)>
                    <Example uuid=(testFeatureTwoExample)>
                        <Name>TestTwo</Name>
                        <Description>Test</Description>
                    </Example>
                </Feature>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })

        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(test)><Example uuid=(testRoomExample) /></Room>
            `),
            deIndentWML(`
                <Example uuid=(testRoomExample)>
                    <Description><Link to=(testFeatureOne)>test</Link></Description>
                </Example>
            `),
            deIndentWML(`
                <Feature key=(testFeatureOne)>
                    <Example uuid=(testFeatureOneExample) />
                </Feature>
            `),
            deIndentWML(`
                <Example uuid=(testFeatureOneExample)>
                    <Name>TestOne</Name>
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
                    <Name>TestTwo</Name>
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
                        <Example uuid=(testRoomExample)><Description>Test</Description></Example>
                        <Position x="0" y="100" />
                        <Exit to=(testTwo)>Test Exit</Exit>
                    </Room>
                </Map>
                <Room key=(testTwo) />
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })
        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Map key=(testMap)><Room key=(testRoom)><Position x="0" y="100" /></Room></Map>
            `),
            deIndentWML(`
                <Room key=(testRoom)>
                    <Example uuid=(testRoomExample) />
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            `),
            deIndentWML(`
                <Example uuid=(testRoomExample)><Description>Test</Description></Example>
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
                        <Example uuid=(testRoomExample)><Description>Test</Description></Example>
                    </Room>
                </Remove>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })
        expect(result.components.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(test)><Remove><Example uuid=(testRoomExample) /></Remove></Room>
            `),
            deIndentWML(`
                <Example uuid=(testRoomExample)>
                    <Remove><Description>Test</Description></Remove>
                </Example>
            `)
        ])
    })

    it('should allow Characters as legal sub-components of Room', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Room key=(testRoom)>
                    <Character key=(testCharacter)>
                        <Name>Test Character</Name>
                    </Character>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })
        
        const roomComponent = result.components.find(({ key }) => (key === 'testRoom'))
        expect(roomComponent).toBeDefined()        
        expect(schemaToWML([roomComponent!.schema])).toBe('<Room key=(testRoom)><Character key=(testCharacter) /></Room>')
    })

    describe('referenceCollection', () => {
        it('should return empty referenceCollection when no components', () => {
            const schema = new Schema()
            schema.loadWML(`<Asset uuid=(test) />`)
            const result = processComponents({
                componentTemplates,
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
                componentTemplates,
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
                componentTemplates,
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
                componentTemplates,
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
                componentTemplates,
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