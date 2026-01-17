import { deIndentWML } from '../../schema/utils'
import { Schema, schemaToWML } from '../../schema'
import { StandardExit, StandardExitData, StandardExitRemove } from './exit'
import StandardReference from '../keys/reference'

describe('StandardExit', () => {
    it('should construct StandardExit from WML', () => {
        const testSource = deIndentWML(`
            <Exit to=(test)>Test Exit</Exit>
        `)
        const testExit = StandardExit.create(testSource)
        expect(testExit.toJSON()).toEqual({ to: { key: 'test' }, description: 'Test Exit' })
        expect(schemaToWML(testExit.schema)).toEqual(testSource)
    })

    it('should construct StandardExit from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Exit to=(test)>Test Exit</Exit>
        `)
        schema.loadWML(testSource)
        const testExit = StandardExit.create(schema.schema)
        expect(testExit.toJSON()).toEqual({ to: { key: 'test' }, description: 'Test Exit' })
        expect(schemaToWML(testExit.schema)).toEqual(testSource)
    })

    it('should construct StandardExit from StandardExitData', () => {
        const testExitData: StandardExitData = {
            to: { key: 'test' },
            description: 'Test Exit'
        }
        const testExit = StandardExit.create(testExitData)
        expect(testExit.toJSON()).toEqual(testExitData)
    })

    it('should merge correctly', () => {
        expect(schemaToWML(StandardExit.create('<Exit to=(test)>One</Exit>')?.merge(StandardExit.create('<Exit to=(test)>Two</Exit>'))?.schema ?? [])).toEqual(deIndentWML('<Exit to=(test)>OneTwo</Exit>'))
    })

    it('should correctly parse a StandardExitRemove', () => {
        const testExitData = {
            tag: 'Remove',
            match: {
                to: { key: 'test' },
                description: 'Test Exit'
            }
        } as const
        const testExitRemove = StandardExit.create(testExitData)
        expect(testExitRemove).toBeInstanceOf(StandardExitRemove)
    })

    it('should correctly remap references', () => {
        const testExit = StandardExit.create(`<Exit to=(test)>Test Exit</Exit>`)
        const remappedExit = testExit.remapReferences({ mapTo: 'universal', mappings: [new StandardReference({ key: 'test', tag: 'Room', universalKey: 'ROOM#universalTest' })] })
        expect(schemaToWML(remappedExit.schema)).toEqual(`<Exit to=(ROOM#universalTest)>Test Exit</Exit>`)
    })
})