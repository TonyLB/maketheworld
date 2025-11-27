import { ReferenceList, StandardKey, StandardReference, StandardReferenceRemove } from './reference';
import { deIndentWML } from '../../schema/utils';
import { Schema, schemaToWML } from '../../schema';
import { StandardReferenceData } from './dataTypes/reference';
import StandardRoom from './room';

describe('StandardKey', () => {
    it('should return a clone for format "both"', () => {
        const refData: StandardReferenceData = { key: 'test', tag: 'Room', universalKey: 'ROOM#1234' }
        const key = new StandardKey(refData)
        const clone = key.toFormat('both')
        expect(clone).not.toBe(key)
        expect(clone.toJSON()).toEqual(key.toJSON())
    })

    it('should strip universalKey for format "key"', () => {
        const refData: StandardReferenceData = { key: 'test', tag: 'Room', universalKey: 'ROOM#1234' }
        const key = new StandardKey(refData)
        const formatted = key.toFormat('key')
        expect(formatted.key).toBe('test')
        expect(formatted.universalKey).toBeUndefined()
        expect(formatted._tag).toBe('Room')
    })

    it('should strip key for format "universalKey"', () => {
        const refData: StandardReferenceData = { key: 'test', tag: 'Room', universalKey: 'ROOM#1234' }
        const key = new StandardKey(refData)
        const formatted = key.toFormat('universal')
        expect(formatted.key).toBeUndefined()
        expect(formatted.universalKey).toBe('ROOM#1234')
        expect(formatted._tag).toBeUndefined()
    })

    it('should not throw if key is missing for format "key"', () => {
        const refData: StandardReferenceData = 'ROOM#1234'
        const key = new StandardKey(refData)
        const formatted = key.toFormat('key')
        expect(formatted.key).toBeUndefined()
        expect(formatted.universalKey).toBe('ROOM#1234')
    })

    it('should not throw if universalKey is missing for format "universalKey"', () => {
        const refData: StandardReferenceData = { tag: 'Room', key: 'test' }
        const key = new StandardKey(refData)
        const formatted = key.toFormat('universal')
        expect(formatted.key).toBe('test')
        expect(formatted.tag).toBe('Room')
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
        const testReferenceData: StandardReferenceData = {
            key: 'test',
            tag: 'Room'
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

    it('should correctly judge equality when only key specified', () => {
        const testReferenceData = {
            tag: 'Room',
            key: 'test',
            universalKey: 'ROOM#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Room', key: 'test' }))).toBe(true)
    })

    it('should correctly judge equality when only universalKey specified', () => {
        const testReferenceData = {
            tag: 'Room',
            key: 'test',
            universalKey: 'ROOM#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Room', universalKey: 'ROOM#1234' }))).toBe(true)
    })

    it('should correct judge inequality when key differs', () => {
        const testReferenceData = {
            tag: 'Room',
            key: 'test',
            universalKey: 'ROOM#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Room', key: 'test2', universalKey: 'ROOM#1234' }))).toBe(false)
    })

    it('should correct judge inequality when universalKey differs', () => {
        const testReferenceData = {
            tag: 'Room',
            key: 'test',
            universalKey: 'ROOM#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Room', key: 'test', universalKey: 'ROOM#5678' }))).toBe(false)
    })

    it('should correctly judge inequality when tags differ', () => {
        const testReferenceData = {
            tag: 'Room',
            key: 'test',
            universalKey: 'ROOM#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ key: 'test', tag: 'Example' }))).toBe(false)
    })

    it('should correctly lookup keys in reference callback', () => {
        const callback = jest.fn((key: StandardKey) => {
            const keys: StandardKey[] = [
                { key: 'room1', universalKey: 'ROOM#Room1' as const },
                { key: 'room2', universalKey: 'ROOM#Room2' as const },
                { key: 'room3', universalKey: 'ROOM#Room3' as const }
            ].map(({ key, universalKey }) => new StandardKey({ key, universalKey, tag: 'Room' }))
            return keys.find((check) => (check.equals(key)))
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

        it('should correctly lookup keys in reference list', () => {
        const keys: StandardKey[] = [
            { key: 'room1', universalKey: 'ROOM#Room1' as const },
            { key: 'room2', universalKey: 'ROOM#Room2' as const },
            { key: 'room3', universalKey: 'ROOM#Room3' as const }
        ].map(({ key, universalKey }) => new StandardKey({ key, universalKey, tag: 'Room' }))

        const testSimple = new StandardReference('<Room key=(room1) />')
        expect(testSimple.lookup(keys).toJSON()).toEqual({ key: 'room1', tag: 'Room', universalKey: 'ROOM#Room1'})
        const testRemove = new StandardReference('<Remove><Room key=(room2) /></Remove>')
        expect(testRemove.lookup(keys).toJSON()).toEqual({ tag: 'Remove', match: { key: 'room2', tag: 'Room', universalKey: 'ROOM#Room2' } })
        const testReplace = new StandardReference('<Replace><Room key=(room2) /></Replace><With><Room key=(room3) /></With>')
        expect(testReplace.lookup(keys).toJSON()).toEqual({
            tag: 'Replace',
            match: { key: 'room2', tag: 'Room', universalKey: 'ROOM#Room2' },
            payload: { key: 'room3', tag: 'Room', universalKey: 'ROOM#Room3' }
        })
    })

    it('should correctly format a simple reference', () => {
        const testSimple = new StandardReference('<Room key=(room1) uuid=(Room1) />')
        expect(testSimple.toFormat('both').toJSON()).toEqual({ key: 'room1', tag: 'Room', universalKey: 'ROOM#Room1' })
        expect(testSimple.toFormat('key').toJSON()).toEqual({ key: 'room1', tag: 'Room' })
        expect(testSimple.toFormat('universal').toJSON()).toEqual(`ROOM#Room1`)
    })

    it('should correctly format a remove reference', () => {
        const testSimple = new StandardReference('<Remove><Room key=(room1) uuid=(Room1) /></Remove>')
        expect(testSimple.toFormat('both').toJSON()).toEqual({ tag: 'Remove', match: { key: 'room1', tag: 'Room', universalKey: 'ROOM#Room1' } })
        expect(testSimple.toFormat('key').toJSON()).toEqual({ tag: 'Remove', match: { key: 'room1', tag: 'Room' } })
        expect(testSimple.toFormat('universal').toJSON()).toEqual({ tag: 'Remove', match: `ROOM#Room1` })
    })

    it('should correctly format a replace reference', () => {
        const testSimple = new StandardReference('<Replace><Room key=(room1) uuid=(Room1) /></Replace><With><Room key=(room2) uuid=(Room2) /></With>')
        expect(testSimple.toFormat('both').toJSON()).toEqual({
            tag: 'Replace',
            match: { key: 'room1', tag: 'Room', universalKey: 'ROOM#Room1' },
            payload: { key: 'room2', tag: 'Room', universalKey: 'ROOM#Room2' }
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
        { key: 'room1', tag: 'Room' as const, universalKey: 'ROOM#Room1' as const },
        { key: 'room2', tag: 'Room' as const, universalKey: 'ROOM#Room2' as const },
        { key: 'room3', tag: 'Room' as const, universalKey: 'ROOM#Room3' as const }
    ].map((item) => (new StandardKey(item)))

    it('should correctly format references to both', () => {
        const testList = new ReferenceList(keys)
        expect(testList.toFormat('both').toJSON()).toEqual([
            { key: 'room1', tag: 'Room', universalKey: 'ROOM#Room1' },
            { key: 'room2', tag: 'Room', universalKey: 'ROOM#Room2' },
            { key: 'room3', tag: 'Room', universalKey: 'ROOM#Room3' }
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
            { tag: 'Room', key: 'room2', universalKey: 'ROOM#Room2' },
            { tag: 'Room', key: 'room3' }
        ])
        const lookedUp = testList.lookup(callback)
        expect(lookedUp.toJSON()).toEqual([
            { key: 'room1', tag: 'Room', universalKey: 'ROOM#Room1' },
            { key: 'room2', tag: 'Room', universalKey: 'ROOM#Room2' },
            { key: 'room3', tag: 'Room', universalKey: 'ROOM#Room3' }
        ])
        expect(callback).toHaveBeenCalledTimes(3)
    })
})