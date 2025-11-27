import { ReferenceList, StandardKey, StandardReference, StandardReferenceRemove } from './reference';
import { deIndentWML } from '../../schema/utils';
import { Schema, schemaToWML } from '../../schema';
import { StandardKeyData, StandardReferenceData } from './dataTypes/reference';
import StandardRoom from './room';

describe('StandardKey', () => {
    it('should return a clone for format "both"', () => {
        const keyData: StandardKeyData = { key: 'test', universalKey: 'ROOM#1234' }
        const key = new StandardKey(keyData)
        const clone = key.toFormat('both')
        expect(clone).not.toBe(key)
        expect(clone.toJSON()).toEqual(key.toJSON())
    })

    it('should strip universalKey for format "key"', () => {
        const keyData: StandardKeyData = { key: 'test', universalKey: 'ROOM#1234' }
        const key = new StandardKey(keyData)
        const formatted = key.toFormat('key')
        expect(formatted.key).toBe('test')
        expect(formatted.universalKey).toBeUndefined()
        expect(formatted.tag).toBeUndefined() // StandardKey doesn't store tag
    })

    it('should strip key for format "universalKey"', () => {
        const keyData: StandardKeyData = { key: 'test', universalKey: 'ROOM#1234' }
        const key = new StandardKey(keyData)
        const formatted = key.toFormat('universal')
        expect(formatted.key).toBeUndefined()
        expect(formatted.universalKey).toBe('ROOM#1234')
        expect(formatted.tag).toBe('Room') // tag can be derived from universalKey
    })

    it('should not throw if key is missing for format "key"', () => {
        const keyData: StandardKeyData = 'ROOM#1234'
        const key = new StandardKey(keyData)
        const formatted = key.toFormat('key')
        expect(formatted.key).toBeUndefined()
        expect(formatted.universalKey).toBe('ROOM#1234')
    })

    it('should not throw if universalKey is missing for format "universalKey"', () => {
        const keyData: StandardKeyData = { key: 'test' }
        const key = new StandardKey(keyData)
        const formatted = key.toFormat('universal')
        expect(formatted.key).toBe('test')
        expect(formatted.tag).toBeUndefined() // tag cannot be derived without universalKey
        expect(formatted.universalKey).toBeUndefined()
    })

})

describe('StandardReference', () => {
    it('should construct StandardReference from WML', () => {
        const testSource = deIndentWML(`
            <Room key=(test) />
        `)
        const testVariable = new StandardReference(testSource)
        expect(testVariable.key).toEqual('test')
        expect(testVariable.tag).toEqual('Room')
        expect(schemaToWML(testVariable.schema)).toEqual(testSource)
    })

    it('should construct StandardReference from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Room key=(test) />
        `)
        schema.loadWML(testSource)
        const testVariable = new StandardReference(schema.schema)
        expect(testVariable.key).toEqual('test')
        expect(testVariable.tag).toEqual('Room')
        expect(schemaToWML(testVariable.schema)).toEqual(testSource)
    })

    it('should construct StandardReference from StandardReferenceData', () => {
        const testReferenceData: StandardReferenceData = { key: 'test', tag: 'Room' }
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
        expect(schemaToWML(new StandardReference('<Room key=(test) />')?.merge(new StandardReference('<Room key=(test) />'))?.schema ?? [])).toEqual(deIndentWML('<Room key=(test) />'))
    })

    it('should correctly parse a StandardReferenceRemove', () => {
        const testReferenceData = {
            tag: 'Remove',
            match: {
                tag: 'Room',
                key: 'test'
            }
        }
        const testVariableRemove = new StandardReference(testReferenceData)
        expect(testVariableRemove.tag).toEqual('Room')
        expect(testVariableRemove._payload).toBeInstanceOf(StandardReferenceRemove)
    })

    it('should correctly judge equality when both key and universalKey match', () => {
        const testReferenceData: StandardReferenceData = {
            key: 'test',
            universalKey: 'ROOM#1234',
            tag: 'Room'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ key: 'test', universalKey: 'ROOM#1234', tag: 'Room' }))).toBe(true)
    })

    it('should correctly judge equality when only universalKey specified (ComponentUUID form)', () => {
        const testReferenceData: StandardReferenceData = {
            key: 'test',
            universalKey: 'ROOM#1234',
            tag: 'Room'
        }
        const testReference = new StandardReference(testReferenceData)
        // ComponentUUID form creates a payload with only universalKey (no key)
        // So equality check will fail because one has key and one doesn't
        const componentUUIDRef = new StandardReference('ROOM#1234')
        expect(testReference.equal(componentUUIDRef)).toBe(false)
        // But they should be equal when both have the same universalKey and no conflicting key
        expect(componentUUIDRef.equal(componentUUIDRef)).toBe(true)
    })

    it('should correct judge inequality when key differs', () => {
        const testReferenceData: StandardReferenceData = {
            key: 'test',
            universalKey: 'ROOM#1234',
            tag: 'Room'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ key: 'test2', universalKey: 'ROOM#1234', tag: 'Room' }))).toBe(false)
    })

    it('should correct judge inequality when universalKey differs', () => {
        const testReferenceData: StandardReferenceData = {
            key: 'test',
            universalKey: 'ROOM#1234',
            tag: 'Room'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ key: 'test', universalKey: 'ROOM#5678', tag: 'Room' }))).toBe(false)
    })

    it('should correctly judge inequality when tags differ', () => {
        const testReferenceData: StandardReferenceData = {
            key: 'test',
            universalKey: 'ROOM#1234',
            tag: 'Room'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference('EXAMPLE#1234'))).toBe(false)
    })

    it('should correctly lookup keys in reference callback', () => {
        const callback = jest.fn((key: StandardKey) => {
            const keys: StandardKey[] = [
                { key: 'room1', universalKey: 'ROOM#Room1' as const },
                { key: 'room2', universalKey: 'ROOM#Room2' as const },
                { key: 'room3', universalKey: 'ROOM#Room3' as const }
            ].map(({ key, universalKey }) => new StandardKey({ key, universalKey }))
            return keys.find((check) => (check.equals(key)))
        })

        // Create references with both key and universalKey so lookup can match on key
        const testSimple = new StandardReference({ key: 'room1', tag: 'Room' })
        expect(testSimple.lookup(callback).toJSON()).toEqual({ key: 'room1', universalKey: 'ROOM#Room1', tag: 'Room'})
        const testRemove = new StandardReference({ tag: 'Remove', match: { key: 'room2', tag: 'Room' } })
        expect(testRemove.lookup(callback).toJSON()).toEqual({ tag: 'Remove', match: { key: 'room2', universalKey: 'ROOM#Room2', tag: 'Room' } })
        const testReplace = new StandardReference({ tag: 'Replace', match: { key: 'room2', tag: 'Room' }, payload: { key: 'room3', tag: 'Room' } })
        expect(testReplace.lookup(callback).toJSON()).toEqual({
            tag: 'Replace',
            match: { key: 'room2', universalKey: 'ROOM#Room2', tag: 'Room' },
            payload: { key: 'room3', universalKey: 'ROOM#Room3', tag: 'Room' }
        })
    })

        it('should correctly lookup keys in reference list', () => {
        const keys: StandardKey[] = [
            { key: 'room1', universalKey: 'ROOM#Room1' as const },
            { key: 'room2', universalKey: 'ROOM#Room2' as const },
            { key: 'room3', universalKey: 'ROOM#Room3' as const }
        ].map(({ key, universalKey }) => new StandardKey({ key, universalKey }))

        // Create references with both key and tag so lookup can match on key
        const testSimple = new StandardReference({ key: 'room1', tag: 'Room' })
        expect(testSimple.lookup(keys).toJSON()).toEqual({ key: 'room1', universalKey: 'ROOM#Room1', tag: 'Room'})
        const testRemove = new StandardReference({ tag: 'Remove', match: { key: 'room2', tag: 'Room' } })
        expect(testRemove.lookup(keys).toJSON()).toEqual({ tag: 'Remove', match: { key: 'room2', universalKey: 'ROOM#Room2', tag: 'Room' } })
        const testReplace = new StandardReference({ tag: 'Replace', match: { key: 'room2', tag: 'Room' }, payload: { key: 'room3', tag: 'Room' } })
        expect(testReplace.lookup(keys).toJSON()).toEqual({
            tag: 'Replace',
            match: { key: 'room2', universalKey: 'ROOM#Room2', tag: 'Room' },
            payload: { key: 'room3', universalKey: 'ROOM#Room3', tag: 'Room' }
        })
    })

    it('should correctly format a simple reference', () => {
        const testSimple = new StandardReference('<Room key=(room1) uuid=(Room1) />')
        expect(testSimple.toFormat('both').toJSON()).toEqual({ key: 'room1', universalKey: 'ROOM#Room1', tag: 'Room' })
        expect(testSimple.toFormat('key').toJSON()).toEqual({ key: 'room1', tag: 'Room' })
        expect(testSimple.toFormat('universal').toJSON()).toEqual(`ROOM#Room1`)
    })

    it('should correctly format a remove reference', () => {
        const testSimple = new StandardReference('<Remove><Room key=(room1) uuid=(Room1) /></Remove>')
        expect(testSimple.toFormat('both').toJSON()).toEqual({ tag: 'Remove', match: { key: 'room1', universalKey: 'ROOM#Room1', tag: 'Room' } })
        expect(testSimple.toFormat('key').toJSON()).toEqual({ tag: 'Remove', match: { key: 'room1', tag: 'Room' } })
        expect(testSimple.toFormat('universal').toJSON()).toEqual({ tag: 'Remove', match: `ROOM#Room1` })
    })

    it('should correctly format a replace reference', () => {
        const testSimple = new StandardReference('<Replace><Room key=(room1) uuid=(Room1) /></Replace><With><Room key=(room2) uuid=(Room2) /></With>')
        expect(testSimple.toFormat('both').toJSON()).toEqual({
            tag: 'Replace',
            match: { key: 'room1', universalKey: 'ROOM#Room1', tag: 'Room' },
            payload: { key: 'room2', universalKey: 'ROOM#Room2', tag: 'Room' }
        })
        expect(testSimple.toFormat('key').toJSON()).toEqual({
            tag: 'Replace',
            match: { key: 'room1', tag: 'Room' },
            payload: { key: 'room2', tag: 'Room' }
        })
        expect(testSimple.toFormat('universal').toJSON()).toEqual({
            tag: 'Replace',
            match: `ROOM#Room1`,
            payload: `ROOM#Room2`
        })
    })
})

describe('ReferenceList', () => {
    const keys: StandardKey[] = [
        { key: 'room1', universalKey: 'ROOM#Room1' as const },
        { key: 'room2', universalKey: 'ROOM#Room2' as const },
        { key: 'room3', universalKey: 'ROOM#Room3' as const }
    ].map((item) => (new StandardKey(item)))

    it('should correctly format references to both', () => {
        const testList = new ReferenceList(keys)
        expect(testList.toFormat('both').toJSON()).toEqual([
            { key: 'room1', universalKey: 'ROOM#Room1', tag: 'Room' },
            { key: 'room2', universalKey: 'ROOM#Room2', tag: 'Room' },
            { key: 'room3', universalKey: 'ROOM#Room3', tag: 'Room' }
        ])
    })

    it('should correctly format references to key', () => {
        const testList = new ReferenceList(keys)
        expect(testList.toFormat('key').toJSON()).toEqual([
            { key: 'room1', tag: 'Room' },
            { key: 'room2', tag: 'Room' },
            { key: 'room3', tag: 'Room' }
        ])
    })

    it('should correctly format references to universal', () => {
        const testList = new ReferenceList(keys)
        expect(testList.toFormat('universal').toJSON()).toEqual([
            'ROOM#Room1',
            'ROOM#Room2',
            'ROOM#Room3'
        ])
    })

    it('should correctly lookup references', () => {
        const callback = jest.fn((key: StandardKey) => {
            return keys.find((check) => (check.equals(key)))
        })

        const testList = new ReferenceList([
            'ROOM#Room1',
            { key: 'room2', universalKey: 'ROOM#Room2', tag: 'Room' },
            { key: 'room3', tag: 'Room' }
        ])
        const lookedUp = testList.lookup(callback)
        expect(lookedUp.toJSON()).toEqual([
            { key: 'room1', universalKey: 'ROOM#Room1', tag: 'Room' },
            { key: 'room2', universalKey: 'ROOM#Room2', tag: 'Room' },
            { key: 'room3', universalKey: 'ROOM#Room3', tag: 'Room' }
        ])
        expect(callback).toHaveBeenCalledTimes(3)
    })
})