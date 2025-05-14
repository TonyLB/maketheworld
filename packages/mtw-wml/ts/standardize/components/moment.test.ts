import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardMomentData } from "./dataTypes/moment"
import StandardMoment from './moment'
import { mergeTest } from './utils/testing'

describe('StandardMoment class', () => {

    it('should construct StandardMoment from WML', () => {
        const testSource = deIndentWML(`
            <Moment uuid=(001) key=(test)><Message key=(testMessage) /></Moment>
        `)
        const testMoment = new StandardMoment(testSource)
        expect(testMoment.universalKey).toEqual('MOMENT#001')
        expect(testMoment.key).toEqual('test')
        expect(testMoment.messages.map((reference) => (reference.toJSON()))).toEqual([{ tag: 'Message', key: 'testMessage' }])
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
        expect(testMoment.messages.map((reference) => (reference.toJSON()))).toEqual([{ tag: 'Message', key: 'testMessage' }])
        expect(schemaToWML([testMoment.schema])).toEqual(testSource)
    })

    it('should construct StandardMoment from StandardMomentData', () => {
        const testMomentData: StandardMomentData = {
            key: 'test',
            tag: 'Moment',
            messages: [{ tag: 'Message', key: 'testMessage' }]
        }
        const testMoment = new StandardMoment(testMomentData)
        expect(testMoment.messages.map((reference) => (reference.toJSON()))).toEqual([{ tag: 'Message', key: 'testMessage' }])
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

    it('should correctly merge removing a message', () => {
        expect(mergeTest(
            '<Moment key=(test)><Message key=(testMessage) /><Message key=(testMessageTwo) /></Moment>',
            StandardMoment,
            '<Moment key=(test)><Remove><Message key=(testMessageTwo) /></Remove></Moment>'
        )).toEqual(deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /></Moment>
        `))
    })

    it('should correctly no-op on diff of identical objects', () => {
        const testSource = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /></Moment>
        `)
        const testMoment = new StandardMoment(testSource)
        expect(testMoment.diff(testMoment)).toBeUndefined()
    })

    it('should correctly diff adding a message', () => {
        const testSource = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /></Moment>
        `)
        const testMoment = new StandardMoment(testSource)
        const testSource2 = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /><Message key=(testMessageTwo) /></Moment>
        `)
        const testMoment2 = new StandardMoment(testSource2)
        expect(testMoment.diff(testMoment2)?.schema).toEqual((new StandardMoment(`
            <Moment key=(test)><Message key=(testMessageTwo) /></Moment>
        `)).schema)
    })

    it('should correctly diff removing a message', () => {
        const testSource = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /><Message key=(testMessageTwo) /></Moment>
        `)
        const testMoment = new StandardMoment(testSource)
        const testSource2 = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /></Moment>
        `)
        const testMoment2 = new StandardMoment(testSource2)
        expect(testMoment.diff(testMoment2)?.schema).toEqual((new StandardMoment(`
            <Moment key=(test)><Remove><Message key=(testMessageTwo) /></Remove></Moment>
        `)).schema)
    })
})
