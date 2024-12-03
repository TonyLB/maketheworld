import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardComputedData } from "./dataTypes/computed"
import { StandardComputedRefactored as StandardComputed } from './computed'
import { mergeTest } from './utils/testing'

describe('StandardComputed class', () => {

    it('should construct StandardComputed from WML', () => {
        const testSource = deIndentWML(`
            <Computed key=(test) src={true} />
        `)
        const testComputed = new StandardComputed(testSource)
        expect(testComputed.key).toEqual('test')
        expect(testComputed.src).toEqual('true')
        expect(schemaToWML([testComputed.schema])).toEqual(testSource)
    })

    it('should construct StandardComputed from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Computed key=(test) src={true} />
        `)
        schema.loadWML(testSource)
        const testComputed = new StandardComputed(schema.schema[0])
        expect(testComputed.key).toEqual('test')
        expect(testComputed.src).toEqual('true')
        expect(schemaToWML([testComputed.schema])).toEqual(testSource)
    })

    it('should construct StandardComputed from StandardComputedData', () => {
        const testComputedData: StandardComputedData = {
            key: 'test',
            tag: 'Computed',
            src: '!testVariable',
            dependencies: ['testVariable']
        }
        const testComputed = new StandardComputed(testComputedData)
        expect(testComputed.src).toEqual('!testVariable')
        expect(testComputed.dependencies).toEqual(['testVariable'])
        expect(testComputed.toJSON()).toEqual(testComputedData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            '<Computed key=(test) src={true} />',
            StandardComputed,
            '<Computed key=(test) src={false} />'
        )).toEqual(deIndentWML('<Computed key=(test) src={false} />'))
    })
})
