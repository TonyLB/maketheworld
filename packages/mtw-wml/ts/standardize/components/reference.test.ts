import { StandardKey, StandardReference, StandardReferenceRemove } from './reference';
import { deIndentWML } from '../../schema/utils';
import { Schema, schemaToWML } from '../../schema';
import { StandardReferenceData } from './dataTypes/reference';
import StandardRoom from './room';

describe('StandardKey', () => {
    it('should return a clone for format "both"', () => {
        const refData: StandardReferenceData = { key: 'test', tag: 'Variable', universalKey: 'VARIABLE#1234' }
        const key = new StandardKey(refData)
        const clone = key.toFormat('both')
        expect(clone).not.toBe(key)
        expect(clone.toJSON()).toEqual(key.toJSON())
    })

    it('should strip universalKey for format "key"', () => {
        const refData: StandardReferenceData = { key: 'test', tag: 'Variable', universalKey: 'VARIABLE#1234' }
        const key = new StandardKey(refData)
        const formatted = key.toFormat('key')
        expect(formatted.key).toBe('test')
        expect(formatted.universalKey).toBeUndefined()
        expect(formatted._tag).toBe('Variable')
    })

    it('should strip key for format "universalKey"', () => {
        const refData: StandardReferenceData = { key: 'test', tag: 'Variable', universalKey: 'VARIABLE#1234' }
        const key = new StandardKey(refData)
        const formatted = key.toFormat('universal')
        expect(formatted.key).toBeUndefined()
        expect(formatted.universalKey).toBe('VARIABLE#1234')
        expect(formatted._tag).toBeUndefined()
    })

    it('should not throw if key is missing for format "key"', () => {
        const refData: StandardReferenceData = 'VARIABLE#1234'
        const key = new StandardKey(refData)
        const formatted = key.toFormat('key')
        expect(formatted.key).toBeUndefined()
        expect(formatted.universalKey).toBe('VARIABLE#1234')
    })

    it('should not throw if universalKey is missing for format "universalKey"', () => {
        const refData: StandardReferenceData = { tag: 'Variable', key: 'test' }
        const key = new StandardKey(refData)
        const formatted = key.toFormat('universal')
        expect(formatted.key).toBe('test')
        expect(formatted.tag).toBe('Variable')
        expect(formatted.universalKey).toBeUndefined()
    })
})

describe('StandardReference', () => {
    it('should construct StandardReference from WML', () => {
        const testSource = deIndentWML(`
            <Variable key=(test) />
        `)
        const testVariable = new StandardReference(testSource)
        expect(testVariable.key).toEqual('test')
        expect(testVariable.tag).toEqual('Variable')
        expect(schemaToWML(testVariable.schema)).toEqual(testSource)
    })

    it('should construct StandardReference from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Variable key=(test) />
        `)
        schema.loadWML(testSource)
        const testVariable = new StandardReference(schema.schema)
        expect(testVariable.key).toEqual('test')
        expect(testVariable.tag).toEqual('Variable')
        expect(schemaToWML(testVariable.schema)).toEqual(testSource)
    })

    it('should construct StandardReference from StandardReferenceData', () => {
        const testReferenceData: StandardReferenceData = {
            key: 'test',
            tag: 'Variable'
        }
        const testVariable = new StandardReference(testReferenceData)
        expect(testVariable.toJSON()).toEqual(testReferenceData)
    })

    it('should correctly return schema for universalKey-only references', () => {
        const testVariable = new StandardReference('EXAMPLE#1234')
        expect(schemaToWML(testVariable.schema)).toEqual(deIndentWML(`
            <Example uuid=(1234) />
        `))
    })

    it('should merge correctly', () => {
        expect(schemaToWML(new StandardReference('<Variable key=(test) />')?.merge(new StandardReference('<Variable key=(test) />'))?.schema ?? [])).toEqual(deIndentWML('<Variable key=(test) />'))
    })

    it('should correctly parse a StandardReferenceRemove', () => {
        const testReferenceData = {
            tag: 'Remove',
            match: {
                tag: 'Variable',
                key: 'test'
            }
        }
        const testVariableRemove = new StandardReference(testReferenceData)
        expect(testVariableRemove.tag).toEqual('Variable')
        expect(testVariableRemove._payload).toBeInstanceOf(StandardReferenceRemove)
    })

    it('should correctly judge equality when only key specified', () => {
        const testReferenceData = {
            tag: 'Variable',
            key: 'test',
            universalKey: 'VARIABLE#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Variable', key: 'test' }))).toBe(true)
    })

    it('should correctly judge equality when only universalKey specified', () => {
        const testReferenceData = {
            tag: 'Variable',
            key: 'test',
            universalKey: 'VARIABLE#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Variable', universalKey: 'VARIABLE#1234' }))).toBe(true)
    })

    it('should correct judge inequality when key differs', () => {
        const testReferenceData = {
            tag: 'Variable',
            key: 'test',
            universalKey: 'VARIABLE#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Variable', key: 'test2', universalKey: 'VARIABLE#1234' }))).toBe(false)
    })

    it('should correct judge inequality when universalKey differs', () => {
        const testReferenceData = {
            tag: 'Variable',
            key: 'test',
            universalKey: 'VARIABLE#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Variable', key: 'test', universalKey: 'VARIABLE#5678' }))).toBe(false)
    })

    it('should correctly judge inequality when tags differ', () => {
        const testReferenceData = {
            tag: 'Variable',
            key: 'test',
            universalKey: 'VARIABLE#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ key: 'test', tag: 'Example' }))).toBe(false)
    })

    it('should correctly lookup keys in reference material', () => {
        const callback = jest.fn((key: StandardKey) => {
            const keys: StandardKey[] = [
                { key: 'room1', universalKey: 'ROOM#Room1' as const },
                { key: 'room2', universalKey: 'ROOM#Room2' as const },
                { key: 'room3', universalKey: 'ROOM#Room3' as const }
            ].map(({ key, universalKey }) => new StandardKey({ key, universalKey, tag: 'Room' }))
            const returnKey = keys.find((check) => (check.equals(key)))
            return returnKey ? new StandardRoom(returnKey.universalKey ?? '').withStandardKey(returnKey) : undefined
        })

        const testSimple = new StandardReference('<Room key=(room1) />')
        expect(testSimple.lookup(callback).toJSON()).toEqual({ key: 'room1', tag: 'Room', universalKey: 'ROOM#Room1'})
        const testRemove = new StandardReference('<Remove><Room key=(room2) /></Remove>')
        expect(testRemove.lookup(callback).toJSON()).toEqual({ tag: 'Remove', match: { key: 'room2', tag: 'Room', universalKey: 'ROOM#Room2' } })
        const testReplace = new StandardReference('<Replace><Room key=(room2) /></Replace><With><Room key=(room3) /></With>')
        expect(testReplace.lookup(callback).toJSON()).toEqual({
            tag: 'Replace',
            match: { key: 'room2', tag: 'Room', universalKey: 'ROOM#Room2' },
            payload: { key: 'room3', tag: 'Room', universalKey: 'ROOM#Room3' }
        })
    })

})
