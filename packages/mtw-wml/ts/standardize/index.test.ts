import { Schema, schemaToWML } from '../schema'
import { StandardForm } from '.'
import { deIndentWML } from '../schema/utils'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardForm', () => {
    it('should return an empty wrapper unchanged', () => {
        const test = new StandardForm(`<Asset uuid=(Test) />`)
        expect(test.header).toEqual({ tag: 'Asset', universalKey: 'ASSET#Test', topLevel: [] })
        expect(schemaToWML([test.schema])).toEqual(`<Asset uuid=(Test) />`)
    })

    it('should accept parsed schema', () => {
        const testSource = deIndentWML(`
            <Asset uuid=(Test)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Situation uuid=(testFeatureBase)>
                        <Description>Four</Description>
                    </Situation>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Situation uuid=(DEFAULT) ref={0} />
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Test Room</DisplayName>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Situation>
                </Room>
            </Asset>
        `)
        const schema = new Schema()
        schema.loadWML(testSource)
        const test = new StandardForm(schema.schema[0])
        const roomStubByIdWML = deIndentWML(`
            <Room uuid=(test) key=(test)>
                <Situation uuid=(DEFAULT)>
                    <DisplayName>Test Room</DisplayName>
                    <Summary>One<br />Two</Summary>
                    <Description>Three</Description>
                </Situation>
            </Room>
        `)
        expect(schemaToWML([test.byId.test.schema])).toEqual(roomStubByIdWML)
        expect(schemaToWML([test.byUniversalId['ROOM#test'].schema])).toEqual(roomStubByIdWML)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })
})
