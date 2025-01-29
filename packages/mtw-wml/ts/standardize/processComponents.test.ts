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
    { key: 'Theme' },
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
        expect(result).toEqual({})
    })

    it('should parse a provided schema', () => {
        const testSource = `
            <Asset key=(Test)>
                <Room key=(test)>
                    <Example key=(base)>
                        <Name>Test Room</Name>
                        <Summary>One<br /><If {false}>Two</If></Summary>
                        <Description>Three</Description>
                    </Example>
                </Room>
                <Feature key=(testFeature)>
                    <Example key=(base)>
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

        expect(result.test instanceof StandardRoom).toBe(true)
        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': '<Room key=(test)><Example key=(base) /></Room>',
            'test.base': deIndentWML(`
                <Example key=(test.base)>
                    <Name>Test Room</Name>
                    <Summary>One<br /><If {false}>Two</If></Summary>
                    <Description>Three</Description>
                </Example>
            `),
            'testFeature': '<Feature key=(testFeature)><Example key=(base) /></Feature>',
            'testFeature.base': deIndentWML(`
                <Example key=(testFeature.base)>
                    <Description><If {false}>Four</If></Description>
                </Example>
            `)
        })
    })

    it('should correctly localize subcomponents', () => {
        const testSource = `
            <Asset key=(Test)>
                <Room key=(test)>
                    <Example key=(base)>
                        <Name>Test Room</Name>
                        <Summary>One<br /><If {false}>Two</If></Summary>
                        <Description>Three</Description>
                    </Example>
                    <Feature key=(testLocal)>
                        <Example key=(base)><Description>Local</Description></Example>
                    </Feature>
                    <Feature global key=(testGlobal)>
                        <Example key=(base)><Description>Global</Description></Example>
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
                    <Example key=(base) />
                </Room>
            `),
            'test.base': deIndentWML(`
                <Example key=(test.base)>
                    <Name>Test Room</Name>
                    <Summary>One<br /><If {false}>Two</If></Summary>
                    <Description>Three</Description>
                </Example>
            `),
            'test.testLocal': deIndentWML(`
                <Feature key=(test.testLocal)><Example key=(base) /></Feature>
            `),
            'test.testLocal.base': deIndentWML(`
                <Example key=(test.testLocal.base)><Description>Local</Description></Example>
            `),
            'testGlobal': deIndentWML(`
                <Feature global key=(testGlobal)><Example key=(base) /></Feature>
            `),
            'testGlobal.base': deIndentWML(`
                <Example key=(testGlobal.base)><Description>Global</Description></Example>
            `)
        })
    })

    it('should combine descriptions in rooms and features', () => {
        const test = `
            <Asset key=(Test)>
                <Room key=(test)>
                    <Example key=(base)>
                        <Summary>
                            One
                            <br />
                        </Summary>
                        <Description>Three</Description>
                    </Example>
                </Room>
                <If {false}>
                    <Room key=(test)>
                        <Example key=(base)>
                            <Summary>
                                Two
                            </Summary>
                        </Example>
                    </Room>
                    <Feature key=(testFeature)>
                        <Example key=(base)>
                            <Description>
                                Four
                            </Description>
                        </Example>
                    </Feature>
                </If>
                <Room key=(test)>
                    <Example key=(base)>
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

        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': deIndentWML(`
                <Room key=(test)><Example key=(base) /></Room>
            `),
            'test.base': deIndentWML(`
                <Example key=(test.base)>
                    <Name>Test Room</Name>
                    <Summary>One<br /><If {false}>Two</If></Summary>
                    <Description>Three</Description>
                </Example>
            `),
            'testFeature': deIndentWML(`
                <Feature key=(testFeature)><Example key=(base) /></Feature>
            `),
            'testFeature.base': deIndentWML(`
                <Example key=(testFeature.base)>
                    <Description><If {false}>Four</If></Description>
                </Example>
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
                    <Example key=(base)>
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
                        <Example key=(base)>
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

        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': deIndentWML(`
                <Room key=(test)>
                    <Example key=(base) />
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            `),
            'test.base': deIndentWML(`
                <Example key=(test.base)><Description>One<br />Two</Description></Example>
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
                    <Example key=(base)>
                        <Description>
                            <Link to=(testFeatureOne)>test</Link>
                        </Description>
                    </Example>
                </Room>
                <Feature key=(testFeatureOne)>
                    <Example key=(base)>
                        <Name>TestOne</Name>
                        <Description><Link to=(testFeatureTwo)>two</Link></Description>
                    </Example>
                </Feature>
                <Feature key=(testFeatureTwo)>
                    <Example key=(base)>
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

        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': deIndentWML(`
                <Room key=(test)><Example key=(base) /></Room>
            `),
            'test.base': deIndentWML(`
                <Example key=(test.base)>
                    <Description><Link to=(testFeatureOne)>test</Link></Description>
                </Example>
            `),
            'testFeatureOne': deIndentWML(`
                <Feature key=(testFeatureOne)><Example key=(base) /></Feature>
            `),
            'testFeatureOne.base': deIndentWML(`
                <Example key=(testFeatureOne.base)>
                    <Name>TestOne</Name>
                    <Description><Link to=(testFeatureTwo)>two</Link></Description>
                </Example>
            `),
            'testFeatureTwo': deIndentWML(`
                <Feature key=(testFeatureTwo)><Example key=(base) /></Feature>
            `),
            'testFeatureTwo.base': deIndentWML(`
                <Example key=(testFeatureTwo.base)>
                    <Name>TestTwo</Name>
                    <Description>Test</Description>
                </Example>
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
                        <Example key=(base)>
                            <Description>Test</Description>
                        </Example>
                    </Room>
                    <Feature key=(toRemove)>
                        <Example key=(base)>
                            <Description>Test</Description>
                        </Example>
                    </Feature>
                </Replace>
                <With>
                    <Room key=(test)>
                        <Example key=(base)>
                            <Description>Changed</Description>
                        </Example>
                    </Room>
                    <Feature key=(toAdd)>
                        <Example key=(base)>
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
        expect(objectMap(result, (component) => (schemaToWML([component.schema])))).toEqual({
            'test': deIndentWML(`
                <Replace><Room key=(test)><Example key=(base) /></Room></Replace>
                <With><Room key=(test)><Example key=(base) /></Room></With>
            `),
            'test.base': deIndentWML(`
                <Replace>
                    <Example key=(test.base)><Description>Test</Description></Example>
                </Replace>
                <With>
                    <Example key=(test.base)><Description>Changed</Description></Example>
                </With>
            `),
            'toRemove': deIndentWML(`
                <Remove><Feature key=(toRemove)><Example key=(base) /></Feature></Remove>
            `),
            'toRemove.base': deIndentWML(`
                <Remove>
                    <Example key=(toRemove.base)><Description>Test</Description></Example>
                </Remove>
            `),
            'toAdd': deIndentWML(`
                <Feature key=(toAdd)><Example key=(base) /></Feature>
            `),
            'toAdd.base': deIndentWML(`
                <Example key=(toAdd.base)><Description>Added</Description></Example>
            `)
        })
    })
})