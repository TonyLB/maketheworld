import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardVariableData } from "./dataTypes/variable"
import StandardVariable from './variable'
import { mergeTest } from './utils/testing'
import { StandardReplace } from "./edits"

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

    it('should diff identical components correctly', () => {
        const testVariable = new StandardVariable({
            key: 'test',
            tag: 'Variable',
            default: 'true'
        })
        expect(testVariable.diff(testVariable)).toBeUndefined()
    })

    it('should diff different components correctly', () => {
        const testVariable = new StandardVariable({
            key: 'test',
            tag: 'Variable',
            default: 'true'
        })
        const testVariable2 = new StandardVariable({
            key: 'test',
            tag: 'Variable',
            default: 'false'
        })
        expect(testVariable.diff(testVariable2)?.toJSON()).toEqual(new StandardReplace(testVariable, testVariable2).toJSON())
    })
})
