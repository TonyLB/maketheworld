import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardVariableData } from "./dataTypes/variable"
import { StandardActionRefactored as StandardVariable } from './variable'
import { mergeTest } from './utils/testing'

describe('StandardVariable class', () => {

    it('should construct StandardVariable from WML', () => {
        const testSource = deIndentWML(`
            <Variable key=(test) default={true} />
        `)
        const testVariable = new StandardVariable(testSource)
        expect(testVariable.key).toEqual('test')
        expect(testVariable.default).toEqual('true')
        expect(schemaToWML([testVariable.schema])).toEqual(testSource)
    })

    it('should construct StandardVariable from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Variable key=(test) default={true} />
        `)
        schema.loadWML(testSource)
        const testVariable = new StandardVariable(schema.schema[0])
        expect(testVariable.key).toEqual('test')
        expect(testVariable.default).toEqual('true')
        expect(schemaToWML([testVariable.schema])).toEqual(testSource)
    })

    it('should construct StandardMoment from StandardMomentData', () => {
        const testVariableData: StandardVariableData = {
            key: 'test',
            tag: 'Variable',
            default: 'true'
        }
        const testVariable = new StandardVariable(testVariableData)
        expect(testVariable.default).toEqual('true')
        expect(testVariable.toJSON()).toEqual(testVariableData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            '<Variable key=(test) default={true} />',
            StandardVariable,
            '<Variable key=(test) default={false} />'
        )).toEqual(deIndentWML('<Variable key=(test) default={false} />'))
    })
})
