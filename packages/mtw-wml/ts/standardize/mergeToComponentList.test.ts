import { mergeToComponentList, mergeUniversalKeyMappings, UniversalKeyMapping } from './mergeToComponentList'
import { StandardComponent } from './components/baseClasses'
import StandardRoom from './components/room'

describe('mergeToComponentList', () => {
    it('should add a new component if no match is found', () => {
        const universalKeyMappings: UniversalKeyMapping[] = [
            { key: 'foo', universalKey: 'ROOM#uuid-foo' }
        ]
        const prev: StandardComponent[] = []
        const component = new StandardRoom(`<Room uuid=(uuid-foo) key=(foo) />`)
        const result = mergeToComponentList(universalKeyMappings)(prev, component)
        expect(result).toEqual([component])
    })

    it('should merge with an existing component if key matches', () => {
        const universalKeyMappings: UniversalKeyMapping[] = [
            { key: 'foo', universalKey: 'ROOM#uuid-foo' }
        ]
        const base = new StandardRoom(`<Room uuid=(uuid-foo) key=(foo) />`)
        const value = new StandardRoom(`<Room uuid=(uuid-foo) key=(foo) />`)
        const prev: StandardComponent[] = [base]
        const result = mergeToComponentList(universalKeyMappings)(prev, value)
        expect(result.length).toBe(1)
        expect(result[0].toJSON()).toEqual(value.toJSON())
    })

    it('should merge with an existing component if universalKey matches', () => {
        const universalKeyMappings: UniversalKeyMapping[] = [
            { key: 'foo', universalKey: 'ROOM#uuid-foo' }
        ]
        const base = new StandardRoom(`<Room uuid=(uuid-foo) key=(foo) />`)
        const value = new StandardRoom(`<Room key=(foo)><ShortName>Test</ShortName></Room>`)
        const prev: StandardComponent[] = [base]
        const result = mergeToComponentList(universalKeyMappings)(prev, value)
        expect(result.length).toBe(1)
        expect(result[0].toJSON()).toEqual({
            tag: 'Room',
            universalKey: 'ROOM#uuid-foo',
            key: 'foo',
            shortName: 'Test',
            exits: []
        })
    })

})

describe('mergeUniversalKeyMappings', () => {
    it('should merge mappings with the same key', () => {
        const mappings: UniversalKeyMapping[] = [
            { key: 'foo', universalKey: 'ROOM#uuid-foo' },
            { key: 'foo', universalKey: 'ROOM#uuid-bar' }
        ]
        const result = mergeUniversalKeyMappings(mappings)
        expect(result.length).toBe(1)
        expect(result[0]).toEqual({ key: 'foo', universalKey: 'ROOM#uuid-foo' })
    })

    it('should keep distinct mappings', () => {
        const mappings: UniversalKeyMapping[] = [
            { key: 'foo', universalKey: 'ROOM#uuid-foo' },
            { key: 'bar', universalKey: 'ROOM#uuid-bar' }
        ]
        const result = mergeUniversalKeyMappings(mappings)
        expect(result.length).toBe(2)
        expect(result).toContainEqual({ key: 'foo', universalKey: 'ROOM#uuid-foo' })
        expect(result).toContainEqual({ key: 'bar', universalKey: 'ROOM#uuid-bar' })
    })

    it('should merge multiple duplicates', () => {
        const mappings: UniversalKeyMapping[] = [
            { key: 'foo', universalKey: 'ROOM#uuid-foo' },
            { key: 'foo', universalKey: undefined },
            { key: undefined, universalKey: 'ROOM#uuid-foo' }
        ]
        const result = mergeUniversalKeyMappings(mappings)
        expect(result.length).toBe(1)
        expect(result[0]).toEqual({ key: 'foo', universalKey: 'ROOM#uuid-foo' })
    })
})