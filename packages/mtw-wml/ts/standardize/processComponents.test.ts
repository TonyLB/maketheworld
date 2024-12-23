import { objectMap } from "../lib/objects"
import { Schema, schemaToWML } from "../schema"
import { deIndentWML } from "../schema/utils"
import SchemaTagTree from "../tagTree/schema"
import processComponents, { ComponentProcessingTemplate } from "./processComponents"
import { ImportItemContent } from "./components/metaData"

const componentTemplates: ComponentProcessingTemplate[] = [
    { key: 'Character' },
    { key: 'Image' },
    { key: 'Bookmark' },
    { key: 'Room' },
    { key: 'Feature' },
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
        const tagTree = new SchemaTagTree(schema.schema)
        const result = processComponents({
            componentTemplates,
            tagTree,
            schema: schema.schema,
            importItemById: {},
            exportItemById: {}
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
        const tagTree = new SchemaTagTree(schema.schema)
        const result = processComponents({
            componentTemplates,
            tagTree,
            schema: schema.schema,
            importItemById: {},
            exportItemById: {}
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
        const tagTree = new SchemaTagTree(schema.schema)
        const result = processComponents({
            componentTemplates,
            tagTree,
            schema: schema.schema,
            importItemById: {},
            exportItemById: {}
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
        const tagTree = new SchemaTagTree(schema.schema)
        const result = processComponents({
            componentTemplates,
            tagTree,
            schema: schema.schema,
            importItemById: {},
            exportItemById: {}
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
        const tagTree = new SchemaTagTree(schema.schema)
        const result = processComponents({
            componentTemplates,
            tagTree,
            schema: schema.schema,
            importItemById: {},
            exportItemById: {}
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
        const tagTree = new SchemaTagTree(schema.schema)
        const result = processComponents({
            componentTemplates,
            tagTree,
            schema: schema.schema,
            importItemById: {},
            exportItemById: {}
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

    it('should correctly extract data from imports with dynamic rename', () => {
        const testSource = `
            <Asset key=(Test)>
                <Import from=(testImport)>
                    <Room key=(base) as =(testRoom)>
                        <Description>Test</Description>
                    </Room>
                </Import>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const tagTree = new SchemaTagTree(schema.schema)
        const result = processComponents({
            componentTemplates,
            tagTree,
            schema: schema.schema,
            importItemById: {
                'testRoom': new ImportItemContent('testImport', 'base')
            },
            exportItemById: {}
        })
        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'testRoom': deIndentWML(`
                <Room key=(testRoom)><Description>Test</Description></Room>
            `)
        })
    })
    
})