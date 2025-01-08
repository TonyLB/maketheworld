import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardActionData } from "./dataTypes/action"
import StandardAction from './action'
import { mergeTest } from './utils/testing'

describe('StandardAction class', () => {

    it('should construct StandardAction from WML', () => {
        const testSource = deIndentWML(`
            <Action key=(test) src={testVar = false} />
        `)
        const testAction = new StandardAction(testSource)
        expect(testAction.key).toEqual('test')
        expect(testAction.src).toEqual('testVar = false')
        expect(schemaToWML([testAction.schema])).toEqual(testSource)
    })

    it('should construct StandardAction from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Action key=(test) src={testVar = false} />
        `)
        schema.loadWML(testSource)
        const testAction = new StandardAction(schema.schema[0])
        expect(testAction.key).toEqual('test')
        expect(testAction.src).toEqual('testVar = false')
        expect(schemaToWML([testAction.schema])).toEqual(testSource)
    })

    it('should construct StandardAction from StandardActionData', () => {
        const testComputedData: StandardActionData = {
            key: 'test',
            tag: 'Action',
            src: 'testVar = !testVar'
        }
        const testComputed = new StandardAction(testComputedData)
        expect(testComputed.src).toEqual('testVar = !testVar')
        expect(testComputed.toJSON()).toEqual(testComputedData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            '<Action key=(test) src={testVar = true} />',
            StandardAction,
            '<Action key=(test) src={testVar = false} />'
        )).toEqual(deIndentWML('<Action key=(test) src={testVar = false} />'))
    })

    it('should diff idential components correctly', () => {
        const testAction = new StandardAction({
            key: 'test',
            tag: 'Action',
            src: 'testVar = false'
        })
        expect(testAction.diff(testAction)).toBeUndefined()
    })

    it('should diff different components correctly', () => {
        const testAction = new StandardAction({
            key: 'test',
            tag: 'Action',
            src: 'testVar = false'
        })
        const testAction2 = new StandardAction({
            key: 'test',
            tag: 'Action',
            src: 'testVar = true'
        })
        expect(testAction.diff(testAction2)).toEqual({ action: 'Replace' })
    })
})
