import { Schema, schemaToWML } from "../../schema"
import { isSchemaString } from "../../schema/baseClasses"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardFeatureData } from "./dataTypes/feature"
import StandardFeature from './feature'
import { mergeTest } from "./utils/testing"
import { StandardReferenceSimple } from "./reference"

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

    it('should properly merge leastCommonContext on two nested features', () => {
        const testOne = new StandardFeature(`<Feature key=(testFeature1)><Example key=(Example1) /></Feature>`).withLeastCommonContext([new StandardReferenceSimple('ROOM#testRoom')])
        const testTwo = new StandardFeature(`<Feature key=(testFeature1)><Example key=(Example2) /></Feature>`).withLeastCommonContext([new StandardReferenceSimple('ROOM#testRoom')])

        const merged = testOne.merge(testTwo)
        if (!merged) {
            expect(true).toBe(false)
            return
        }
        expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
            <Feature key=(testFeature1)>
                <Example key=(Example1) />
                <Example key=(Example2) />
            </Feature>
        `))
        expect(merged.leastCommonContext.map((ref) => ref.toJSON())).toEqual(['ROOM#testRoom'])
    })

    it('should properly reduce leastCommonContext on two nested features without common context', () => {
        const testOne = new StandardFeature(`<Feature key=(testFeature1)><Example key=(Example1) /></Feature>`).withLeastCommonContext([new StandardReferenceSimple('ROOM#testRoom')])
        const testTwo = new StandardFeature(`<Feature key=(testFeature1)><Example key=(Example2) /></Feature>`).withLeastCommonContext([new StandardReferenceSimple('ROOM#testRoomTwo')])

        const merged = testOne.merge(testTwo)
        if (!merged) {
            expect(true).toBe(false)
            return
        }
        expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
            <Feature key=(testFeature1)>
                <Example key=(Example1) />
                <Example key=(Example2) />
            </Feature>
        `))
        expect(merged.leastCommonContext.map((ref) => ref.toJSON())).toEqual([])
    })

    it('should properly retain leastCommonContext on merging a non-nested feature', () => {
        const testOne = new StandardFeature(`<Feature key=(testFeature1)><Example key=(Example1) /></Feature>`).withLeastCommonContext([new StandardReferenceSimple('ROOM#testRoom')])
        const testTwo = new StandardFeature(`<Feature key=(testFeature1)><Example key=(Example2) /></Feature>`)

        const merged = testOne.merge(testTwo)
        if (!merged) {
            expect(true).toBe(false)
            return
        }
        expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
            <Feature key=(testFeature1)>
                <Example key=(Example1) />
                <Example key=(Example2) />
            </Feature>
        `))
        expect(merged.leastCommonContext.map((ref) => ref.toJSON())).toEqual([])
    })

})