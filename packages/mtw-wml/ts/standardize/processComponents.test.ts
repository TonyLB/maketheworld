import { objectMap } from "../lib/objects"
import { Schema, schemaToWML } from "../schema"
import { deIndentWML } from "../schema/utils"
import processComponents, { ComponentProcessingTemplate } from "./processComponents"
import StandardRoom from "./components/room"

const componentTemplates: ComponentProcessingTemplate[] = [
    { key: 'Character' },
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
    { key: 'Variable' },
    { key: 'Computed' },
    { key: 'Action' },
    {
        key: 'Example',
        legalParents: ['Room', 'Feature', 'Knowledge']
    }
]

describe("processComponents", () => {
    it('should return an empty object when given an empty object', () => {
        const schema = new Schema()
        schema.loadWML(`<Asset key=(test) />`)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })
        expect(result).toEqual([])
    })

    it('should parse a provided schema', () => {
        const testSource = `
            <Asset key=(Test)>
                <Room key=(test)>
                    <Example uuid=(testRoomExample)>
                        <Name>Test Room</Name>
                        <Summary>One<br /><If {false}>Two</If></Summary>
                        <Description>Three</Description>
                    </Example>
                </Room>
                <Feature key=(testFeature)>
                    <Example uuid=(testFeatureExample)>
                        <Description><If {false}>Four</If></Description>
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

        expect(result.find(({ key }) => (key === 'test')) instanceof StandardRoom).toBe(true)
        expect(result.map((component) => (schemaToWML([component.schema])))).toEqual([
            '<Room key=(test)><Example uuid=(testRoomExample) /></Room>',
            deIndentWML(`
                <Example uuid=(testRoomExample)>
                    <Name>Test Room</Name>
                    <Summary>One<br /><If {false}>Two</If></Summary>
                    <Description>Three</Description>
                </Example>
            `),
            '<Feature key=(testFeature)><Example uuid=(testFeatureExample) /></Feature>',
            deIndentWML(`
                <Example uuid=(testFeatureExample)>
                    <Description><If {false}>Four</If></Description>
                </Example>
            `)
        ])
    })

    it('should correctly localize subcomponents', () => {
        const testSource = `
            <Asset key=(Test)>
                <Room key=(test)>
                    <Example uuid=(testRoomExample)>
                        <Name>Test Room</Name>
                        <Summary>One<br /><If {false}>Two</If></Summary>
                        <Description>Three</Description>
                    </Example>
                    <Feature key=(testLocal)>
                        <Example uuid=(testLocalExample)><Description>Local</Description></Example>
                    </Feature>
                    <Feature global key=(testGlobal)>
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
        expect(result.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(test)>
                    <Feature key=(testLocal) />
                    <Feature global key=(testGlobal) />
                    <Example uuid=(testRoomExample) />
                </Room>
            `),
            deIndentWML(`
                <Example uuid=(testRoomExample)>
                    <Name>Test Room</Name>
                    <Summary>One<br /><If {false}>Two</If></Summary>
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
                <Feature global key=(testGlobal)><Example uuid=(testGlobalExample) /></Feature>
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
            <Asset key=(Test)>
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

        expect(result.map((component) => (schemaToWML([component.schema])))).toEqual([
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
            <Asset key=(Test)>
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

        expect(result.map((component) => (schemaToWML([component.schema])))).toEqual([
            `<Room key=(test)><Example uuid=(testRoomExample) /></Room>`,
            `<Example uuid=(testRoomExample)><Description>One<br /></Description></Example>`,
            `<Room key=(testTwo) />`,
            `<Room key=(test)><Exit to=(testTwo)>Test Exit</Exit></Room>`,
            `<Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>`
        ])
    })

    it('should combine render in nested rooms', () => {
        const test = `
            <Asset key=(Test)>
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

        expect(result.map((component) => (schemaToWML([component.schema])))).toEqual([
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
            <Asset key=(Test)>
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

        expect(result.map((component) => (schemaToWML([component.schema])))).toEqual([
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
            <Asset key=(Test)>
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
        expect(result.map((component) => (schemaToWML([component.schema])))).toEqual([
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
            <Asset key=(Test)>
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
        expect(result.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Remove><Room key=(test)><Example uuid=(testRoomExample) /></Room></Remove>
            `),
            deIndentWML(`
                <Remove>
                    <Example uuid=(testRoomExample)><Description>Test</Description></Example>
                </Remove>
            `)
        ])
    })

    it('should parse a replace tag', () => {
        const testSource = `
            <Asset key=(Test)>
                <Replace>
                    <Room key=(test)>
                        <Example uuid=(testRoomExample)>
                            <Description>Test</Description>
                        </Example>
                    </Room>
                    <Feature key=(toRemove)>
                        <Example uuid=(testFeatureExample)>
                            <Description>Test</Description>
                        </Example>
                    </Feature>
                </Replace>
                <With>
                    <Room key=(test)>
                        <Example uuid=(testRoomExample)>
                            <Description>Changed</Description>
                        </Example>
                    </Room>
                    <Feature key=(toAdd)>
                        <Example uuid=(testFeatureExample)>
                            <Description>Added</Description>
                        </Example>
                    </Feature>
                </With>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })
        expect(result.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Replace><Room key=(test)><Example uuid=(testRoomExample) /></Room></Replace>
                <With><Room key=(test)><Example uuid=(testRoomExample) /></Room></With>
            `),
            deIndentWML(`
                <Replace>
                    <Example uuid=(testRoomExample)><Description>Test</Description></Example>
                </Replace>
                <With>
                    <Example uuid=(testRoomExample)>
                        <Description>Changed</Description>
                    </Example>
                </With>
            `),
            deIndentWML(`
                <Remove>
                    <Feature key=(toRemove)><Example uuid=(testFeatureExample) /></Feature>
                </Remove>
            `),
            deIndentWML(`
                <Replace>
                    <Example uuid=(testFeatureExample)>
                        <Description>Test</Description>
                    </Example>
                </Replace>
                <With>
                    <Example uuid=(testFeatureExample)>
                        <Description>Added</Description>
                    </Example>
                </With>
            `),
            deIndentWML(`
                <Feature key=(toAdd)><Example uuid=(testFeatureExample) /></Feature>
            `)
        ])
    })

    it('should correctly process context', () => {
        const testSource = `
            <Asset key=(Test)>
                <Room key=(testRoom)>
                    <Feature key=(testFeatureLocal) />
                </Room>
                <Feature key=(testFeatureGlobal) />
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })
        expect(result.map((component) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(testRoom)><Feature key=(testFeatureLocal) /></Room>
            `),
            deIndentWML(`
                <Feature key=(testFeatureLocal) />
            `),
            deIndentWML(`
                <Feature key=(testFeatureGlobal) />
            `),
        ])
        expect((result[1]._key?.context ?? []).map((reference) => (reference.toJSON()))).toEqual([{ key: 'testRoom', tag: 'Room' }])
        expect(result[2]._key?.context).toBeUndefined()
    })
})