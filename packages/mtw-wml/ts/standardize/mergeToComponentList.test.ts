import { mergeToComponentList, mergeUniversalKeyMappings, UniversalKeyMapping } from './mergeToComponentList'
import { StandardComponent } from './components/baseClasses'
import StandardRoom from './components/room'
import { StandardKey } from './components/reference'

describe('mergeToComponentList', () => {
    it('should add a new component if no match is found', () => {
        const universalKeyMappings: StandardKey[] = [
            new StandardKey({ key: 'foo', tag: 'Room', universalKey: 'ROOM#uuid-foo' })
        ]
        const prev: StandardComponent[] = []
        const component = new StandardRoom(`<Room uuid=(uuid-foo) key=(foo) />`)
        const result = mergeToComponentList(universalKeyMappings)(prev, component)
        expect(result).toEqual([component])
    })

    it('should merge with an existing component if key matches', () => {
        const universalKeyMappings: StandardKey[] = [
            new StandardKey({ key: 'foo', tag: 'Room', universalKey: 'ROOM#uuid-foo' })
        ]
        const base = new StandardRoom(`<Room uuid=(uuid-foo) key=(foo) />`)
        const value = new StandardRoom(`<Room uuid=(uuid-foo) key=(foo) />`)
        const prev: StandardComponent[] = [base]
        const result = mergeToComponentList(universalKeyMappings)(prev, value)
        expect(result.length).toBe(1)
        expect(result[0].toJSON()).toEqual(value.toJSON())
    })

    it('should merge with an existing component if universalKey matches', () => {
        const universalKeyMappings: StandardKey[] = [
            new StandardKey({ key: 'foo', tag: 'Room', universalKey: 'ROOM#uuid-foo' })
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
        })
    })

    it('should merge origin properties correctly when merging components', () => {
        const universalKeyMappings: StandardKey[] = [
            new StandardKey({ key: 'foo', tag: 'Room', universalKey: 'ROOM#uuid-foo' })
        ]
        
        // Create base component with origin
        const base = new StandardRoom(`<Room uuid=(uuid-foo) key=(foo) />`)
            .withOrigin(['ASSET#base', 'ASSET#inherited'])
        
        // Create incoming component with different origin
        const value = new StandardRoom(`<Room key=(foo)><ShortName>Test</ShortName></Room>`)
            .withOrigin(['ASSET#incoming', 'ASSET#new'])
        
        const prev: StandardComponent[] = [base]
        const result = mergeToComponentList(universalKeyMappings)(prev, value)
        
        expect(result.length).toBe(1)
        
        // Verify that origins are merged and deduplicated
        const mergedComponent = result[0] as StandardRoom
        expect(mergedComponent.origin).toEqual([
            'ASSET#base',
            'ASSET#inherited', 
            'ASSET#incoming',
            'ASSET#new'
        ])
        
        // Verify other properties are merged correctly
        expect(mergedComponent.shortName?.toJSON()).toBe('Test')
        expect(mergedComponent.universalKey).toBe('ROOM#uuid-foo')
    })

})

describe('mergeUniversalKeyMappings', () => {
    it('should keep distinct mappings', () => {
        const mappings: StandardKey[] = [
            new StandardKey({ key: 'foo', tag: 'Room', universalKey: 'ROOM#uuid-foo' }),
            new StandardKey({ key: 'bar', tag: 'Room', universalKey: 'ROOM#uuid-bar' })
        ]
        const result = mergeUniversalKeyMappings(mappings)
        expect(result.length).toBe(2)
        expect(result.map((key) => (key.toJSON()))).toContainEqual({ key: 'foo', tag: 'Room', universalKey: 'ROOM#uuid-foo' })
        expect(result.map((key) => (key.toJSON()))).toContainEqual({ key: 'bar', tag: 'Room', universalKey: 'ROOM#uuid-bar' })
    })

    it('should merge multiple duplicates', () => {
        const mappings: StandardKey[] = [
            new StandardKey({ key: 'foo', tag: 'Room', universalKey: 'ROOM#uuid-foo' }),
            new StandardKey({ key: 'foo', tag: 'Room', universalKey: undefined }),
            new StandardKey({ key: undefined, tag: 'Room', universalKey: 'ROOM#uuid-foo' })
        ]
        const result = mergeUniversalKeyMappings(mappings)
        expect(result.length).toBe(1)
        expect(result[0].toJSON()).toEqual({ key: 'foo', tag: 'Room', universalKey: 'ROOM#uuid-foo' })
    })
})