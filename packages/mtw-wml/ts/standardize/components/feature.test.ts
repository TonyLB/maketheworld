import { Schema, schemaToWML } from "../../schema"
import { isSchemaString } from "../../schema/baseClasses"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardFeatureData } from "./dataTypes/feature"
import StandardFeature from './feature'
import { mergeTest } from "./utils/testing"

describe('StandardFeature class', () => {

    it('should construct StandardFeature from WML', () => {
        const testSource = deIndentWML(`
            <Feature global key=(test)><Example key=(base) /></Feature>
        `)
        const testFeature = new StandardFeature(testSource)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.global).toBe(true)
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Feature key=(test)><Example key=(base) /></Feature>
        `)
        schema.loadWML(testSource)
        const testFeature = new StandardFeature(schema.schema[0])
        expect(testFeature.key).toEqual('test')
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from StandardFeatureData', () => {
        const testFeatureData: StandardFeatureData = {
            key: 'test',
            tag: 'Feature',
            examples: [{ key: 'Example1', tag: 'Example' }]
        }
        const testFeature = new StandardFeature(testFeatureData)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.toJSON()).toEqual(testFeatureData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Feature key=(testFeature)>
                <Example key=(Example1) />
            </Feature>`,
            StandardFeature,
            `<Feature key=(testFeature)>
                <Example key=(Example2) />
            </Feature>`
        )).toEqual(deIndentWML(`
            <Feature key=(testFeature)>
                <Example key=(Example1) />
                <Example key=(Example2) />
            </Feature>
        `))
    })

})