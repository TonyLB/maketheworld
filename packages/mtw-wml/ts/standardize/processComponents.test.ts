import { objectMap } from "../lib/objects"
import { Schema, schemaToWML } from "../schema"
import { deIndentWML } from "../schema/utils"
import SchemaTagTree from "../tagTree/schema"
import processComponents, { ComponentProcessingTemplate } from "./processComponents"
import { ImportItemContent, ExportItemContent } from "./components/metaData"
import StandardRoom from "./components/room"

const componentTemplates: ComponentProcessingTemplate[] = [
    { key: 'Character' },
    { key: 'Image' },
    { key: 'Bookmark' },
    { key: 'Room' },
    {
        key: 'Feature',
        legalParents: ['Room']
    },
    { key: 'Knowledge' },
    { key: 'Map' },
    { key: 'Theme' },
    { key: 'Message' },
    { key: 'Moment' },
    { key: 'Variable' },
    { key: 'Computed' },
    { key: 'Action' }
]

describe("processComponents", () => {
    it('should return an empty object when given an empty object', () => {
        const schema = new Schema()
        schema.loadWML(`<Asset key=(test) />`)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })
        expect(result).toEqual({})
    })

    it('should parse a provided schema', () => {
        const testSource = `
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
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema
        })

        expect(result.test instanceof StandardRoom).toBe(true)
        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': deIndentWML(`
                <Room key=(test)>
                    <Name>Test Room</Name>
                    <Summary>One<br /><If {false}>Two</If></Summary>
                    <Description>Three</Description>
                </Room>
            `),
            'testFeature': deIndentWML(`
                <Feature key=(testFeature)>
                    <Description><If {false}>Four</If></Description>
                </Feature>
            `)
        })
    })

    it('should correctly localize subcomponents', () => {
        const testSource = `
            <Asset key=(Test)>
                <Room key=(test)>
                    <Name>Test Room</Name>
                    <Summary>One<br /><If {false}>Two</If></Summary>
                    <Description>Three</Description>
                    <Feature key=(testLocal)>
                        <Description>Local</Description>
                    </Feature>
                    <Feature global key=(testGlobal)>
                        <Description>Global</Description>
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
        expect((objectMap(result, (component) => (schemaToWML([component.schema]))))).toEqual({
            'test': deIndentWML(`
                <Room key=(test)>
                    <Feature key=(testLocal) />
                    <Feature global key=(testGlobal) />
                    <Name>Test Room</Name>
                    <Summary>One<br /><If {false}>Two</If></Summary>
                    <Description>Three</Description>
                </Room>
            `),
            'test.testLocal': deIndentWML(`
                <Feature key=(test.testLocal)><Description>Local</Description></Feature>
            `),
            'testGlobal': deIndentWML(`
                <Feature global key=(testGlobal)><Description>Global</Description></Feature>
            `)
        })
    })

    it('should combine descriptions in rooms and features', () => {
        const test = `
            <Asset key=(Test)>
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
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(test)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })

        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': deIndentWML(`
                <Room key=(test)>
                    <Name>Test Room</Name>
                    <Summary>One<br /><If {false}>Two</If></Summary>
                    <Description>Three</Description>
                </Room>
            `),
            'testFeature': deIndentWML(`
                <Feature key=(testFeature)>
                    <Description><If {false}>Four</If></Description>
                </Feature>
            `)
        })
    })

    it('should combine exits in rooms', () => {
        const test = `
            <Asset key=(Test)>
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
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(test)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })

        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': deIndentWML(`
                <Room key=(test)>
                    <Description>One<br /></Description>
                    <If {false}><Exit to=(testTwo)>Test Exit</Exit></If>
                </Room>
            `),
            'testTwo': deIndentWML(`
                <Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>
            `)
        })
    })

    it('should combine render in nested rooms', () => {
        const test = `
            <Asset key=(Test)>
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
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(test)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })

        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': deIndentWML(`
                <Room key=(test)>
                    <Description>One<br />Two</Description>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            `),
            'testTwo': deIndentWML(`
                <Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>
            `),
            'testMessage': deIndentWML(`
                <Message key=(testMessage)><Room key=(test) />Test message</Message>
            `)
        })
    })

    it('should render features and links correctly', () => {
        const testSource = `
            <Asset key=(Test)>
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
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })

        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': deIndentWML(`
                <Room key=(test)>
                    <Description><Link to=(testFeatureOne)>test</Link></Description>
                </Room>
            `),
            'testFeatureOne': deIndentWML(`
                <Feature key=(testFeatureOne)>
                    <Name>TestOne</Name>
                    <Description><Link to=(testFeatureTwo)>two</Link></Description>
                </Feature>
            `),
            'testFeatureTwo': deIndentWML(`
                <Feature key=(testFeatureTwo)>
                    <Name>TestTwo</Name>
                    <Description>Test</Description>
                </Feature>
            `)
        })
    })

    it('should correctly parse a map', () => {
        const testSource = `
            <Asset key=(Test)>
                <Map key=(testMap)>
                    <Room key=(testRoom)>
                        <Description>Test</Description>
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
        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'testMap': deIndentWML(`
                <Map key=(testMap)><Room key=(testRoom)><Position x="0" y="100" /></Room></Map>
            `),
            'testRoom': deIndentWML(`
                <Room key=(testRoom)>
                    <Description>Test</Description>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            `),
            'testTwo': deIndentWML(`
                <Room key=(testTwo) />
            `)
        })
    })

    it('should correctly extract data from imports with dynamic rename', () => {
        const testSource = `
            <Asset key=(Test)>
                <Import from=(testImport)>
                    <Room key=(base) as=(testRoom)>
                        <Description>Test</Description>
                    </Room>
                </Import>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })
        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'testRoom': deIndentWML(`
                <Room key=(testRoom)><Description>Test</Description></Room>
            `)
        })
    })

    it('should correctly extract data from exports with dynamic rename', () => {
        const testSource = `
            <Asset key=(Test)>
                <Export>
                    <Room key=(base) as =(testRoom)>
                        <Description>Test</Description>
                    </Room>
                </Export>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processComponents({
            componentTemplates,
            schema: schema.schema,
        })
        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'base': deIndentWML(`
                <Room key=(base)><Description>Test</Description></Room>
            `)
        })
    })

    it('should parse a remove tag', () => {
        const testSource = `
            <Asset key=(Test)>
                <Remove>
                    <Room key=(test)>
                        <Description>Test</Description>
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
        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': deIndentWML(`
                <Remove><Room key=(test)><Description>Test</Description></Room></Remove>
            `)
        })
    })

    it('should parse a replace tag', () => {
        const testSource = `
            <Asset key=(Test)>
                <Replace>
                    <Room key=(test)>
                        <Description>Test</Description>
                    </Room>
                    <Feature key=(toRemove)>
                        <Description>Test</Description>
                    </Feature>
                </Replace>
                <With>
                    <Room key=(test)>
                        <Description>Changed</Description>
                    </Room>
                    <Feature key=(toAdd)>
                        <Description>Added</Description>
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
        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': deIndentWML(`
                <Replace><Room key=(test)><Description>Test</Description></Room></Replace>
                <With><Room key=(test)><Description>Changed</Description></Room></With>
            `),
            'toRemove': deIndentWML(`
                <Remove>
                    <Feature key=(toRemove)><Description>Test</Description></Feature>
                </Remove>
            `),
            'toAdd': deIndentWML(`
                <Feature key=(toAdd)><Description>Added</Description></Feature>
            `)
        })
    })
})