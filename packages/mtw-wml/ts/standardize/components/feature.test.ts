import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardFeatureData } from "./dataTypes/feature"
import { StandardFeature } from './feature'

describe('StandardFeature class', () => {
    it('should construct StandardFeature from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Feature key=(test)>
                <Name>Name Test</Name>
                <Description>Description Test</Description>
            </Feature>
        `)
        schema.loadWML(testSource)
        const testFeature = new StandardFeature(schema.schema[0])
        expect(testFeature.key).toEqual('test')
        expect(testFeature.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testFeature.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from StandardFeatureData', () => {
        const testFeatureData: StandardFeatureData = {
            key: 'test',
            tag: 'Feature',
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] },
        }
        const testFeature = new StandardFeature(testFeatureData)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testFeature.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(testFeature.toJSON()).toEqual(testFeatureData)
    })

    it('should merge correctly', () => {
        const baseSource = deIndentWML(`
            <Feature key=(testFeature)>
                <Name>Lobby</Name>
                <Description>A plain lobby.</Description>
            </Feature>
        `)
        const baseSchema = new Schema()
        baseSchema.loadWML(baseSource)
        const baseStandard = new StandardFeature(baseSchema.schema[0])
        const testSource = deIndentWML(`
            <Feature key=(testFeature)>
                <Replace><Name>Lobby</Name></Replace><With><Name>Spooky Lobby</Name></With>
                <Description><Space />Shadows cling to the corners of the room.</Description>
            </Feature>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new StandardFeature(testSchema.schema[0])
        const mergedStandard = baseStandard.merge(testStandard)
        expect(schemaToWML([mergedStandard.schema])).toEqual(deIndentWML(`
            <Feature key=(testFeature)>
                <Name>Spooky Lobby</Name>
                <Description>
                    A plain lobby.<Space />Shadows cling to the corners of the room.
                </Description>
            </Feature>
        `))
    })
})