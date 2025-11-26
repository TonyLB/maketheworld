import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardFeatureData } from "./dataTypes/feature"
import StandardFeature from './feature'
import { mergeTest } from "./utils/testing"
import StandardReference, { StandardKey } from "./reference"

describe('StandardFeature class', () => {

    it('should construct StandardFeature from WML', () => {
        const testSource = deIndentWML(`
            <Feature key=(test)><Example key=(base) /></Feature>
        `)
        const testFeature = new StandardFeature(testSource)
        expect(testFeature.key).toEqual('test')
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from WML with ShortName', () => {
        const testSource = deIndentWML(`
            <Feature key=(test)>
                <ShortName>Test Feature</ShortName>
                <Example key=(base) />
            </Feature>
        `)
        const testFeature = new StandardFeature(testSource)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.shortName?.toJSON()).toEqual('Test Feature')
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

    it('should construct StandardFeature from StandardFeatureData with shortName', () => {
        const testFeatureData: StandardFeatureData = {
            key: 'test',
            tag: 'Feature',
            shortName: 'Test Feature',
            examples: [{ key: 'Example1', tag: 'Example' }]
        }
        const testFeature = new StandardFeature(testFeatureData)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.shortName?.toJSON()).toEqual('Test Feature')
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

    it('should merge shortName correctly', () => {
        expect(mergeTest(
            `<Feature key=(testFeature)>
                <ShortName>Original</ShortName>
            </Feature>`,
            StandardFeature,
            `<Feature key=(testFeature)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Feature>`
        )).toEqual(deIndentWML(`
            <Feature key=(testFeature)><ShortName>Updated</ShortName></Feature>
        `))
    })


    it('should correctly add an example reference to a feature', () => {
        const test = new StandardFeature(`
            <Feature key=(testFeature)>
                <Example uuid=(Example1) />
            </Feature>
        `)
        const example = new StandardKey("EXAMPLE#Example2")
        const added = test.withChild(new StandardReference(example))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Feature key=(testFeature)>
                <Example uuid=(Example1) />
                <Example uuid=(Example2) />
            </Feature>
        `))
    })

    it('should diff shortName correctly', () => {
        const testFeature = new StandardFeature(`
            <Feature key=(test)>
                <ShortName>Original</ShortName>
            </Feature>
        `)
        const testFeature2 = new StandardFeature(`
            <Feature key=(test)>
                <ShortName>Updated</ShortName>
            </Feature>
        `)
        const diff = testFeature.diff(testFeature2)
        expect(diff).toBeDefined()
        expect(schemaToWML([diff!.schema])).toEqual(deIndentWML(`
            <Feature key=(test)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Feature>
        `))
    })
    
})