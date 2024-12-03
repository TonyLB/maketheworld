import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardMomentData } from "./dataTypes/moment"
import { StandardMessageRefactored as StandardMoment } from './moment'
import { mergeTest } from './utils/testing'

describe('StandardMoment class', () => {

    it('should construct StandardMoment from WML', () => {
        const testSource = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /></Moment>
        `)
        const testMoment = new StandardMoment(testSource)
        expect(testMoment.key).toEqual('test')
        expect(testMoment.messages).toEqual([{ data: { tag: 'Message', key: 'testMessage' }, children: [] }])
        expect(schemaToWML([testMoment.schema])).toEqual(testSource)
    })

    it('should construct StandardMoment from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /></Moment>
        `)
        schema.loadWML(testSource)
        const testMoment = new StandardMoment(schema.schema[0])
        expect(testMoment.key).toEqual('test')
        expect(testMoment.messages).toEqual([{ data: { tag: 'Message', key: 'testMessage' }, children: [] }])
        expect(schemaToWML([testMoment.schema])).toEqual(testSource)
    })

    it('should construct StandardMoment from StandardMomentData', () => {
        const testMomentData: StandardMomentData = {
            key: 'test',
            tag: 'Moment',
            messages: [{ data: { tag: 'Message', key: 'testMessage' }, children: [] }]
        }
        const testMoment = new StandardMoment(testMomentData)
        expect(testMoment.messages).toEqual([{ data: { tag: 'Message', key: 'testMessage' }, children: [] }])
        expect(testMoment.toJSON()).toEqual(testMomentData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            '<Moment key=(test)><Message key=(testMessage) /></Moment>',
            StandardMoment,
            '<Moment key=(test)><Message key=(testMessageTwo) /></Moment>'
        )).toEqual(deIndentWML(`
            <Moment key=(test)>
                <Message key=(testMessage) />
                <Message key=(testMessageTwo) />
            </Moment>
        `))
    })
})
