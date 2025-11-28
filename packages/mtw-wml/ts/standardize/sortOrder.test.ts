import { standardComponentSortOrder } from './sortOrder'
import { StandardReferenceSimple, StandardKey } from './components/reference'
import StandardFeature from './components/feature'
import StandardRoom from './components/room'
import StandardCharacter from './components/character'
import StandardKnowledge from './components/knowledge'
import { StandardComponent } from './components/baseClasses'

describe('standardComponentSortOrder', () => {

    // Helper to create lookup function for testing
    // Builds a map of components by their _key for lookup
    const createLookup = (components: StandardComponent[]): ((key: StandardKey) => StandardComponent | undefined) => {
        return (key: StandardKey): StandardComponent | undefined => {
            return components.find(comp => comp._key.equals(key))
        }
    }

    // Default lookup for tests that don't need hierarchy (returns undefined for all keys)
    const sortOrder = (a: StandardReferenceSimple | StandardKey, b: StandardReferenceSimple | StandardKey, lookup: (key: StandardKey) => StandardComponent | undefined = () => undefined) => {
        return standardComponentSortOrder(a, b, lookup)
    }

    it('should order subcomponents after their parent', () => {
        const parent = new StandardRoom({ key: 'Room1', tag: 'Room' })
        const child = new StandardFeature({ key: 'Feature1', tag: 'Feature' }).withImplicitParent(parent._key)
        
        const lookup = createLookup([parent, child])
        expect(sortOrder(parent._key, child._key, lookup)).toBeLessThan(0)
        expect(sortOrder(child._key, parent._key, lookup)).toBeGreaterThan(0)
    })

    it('should order siblings by tag order', () => {
        const room = new StandardReferenceSimple({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#Room1' })
        const feature = new StandardReferenceSimple({ tag: 'Feature', key: 'Feature1', universalKey: 'FEATURE#Feature1' })
        // Room comes before Feature in componentKeys
        expect(sortOrder(room, feature)).toBeGreaterThan(0)
        expect(sortOrder(feature, room)).toBeLessThan(0)
    })

    it('should order siblings with same tag by key', () => {
        const parent = new StandardRoom({ key: 'Room1', tag: 'Room' })
        const featureA = new StandardFeature({ key: 'Feature1', tag: 'Feature' }).withImplicitParent(parent._key)
        const featureB = new StandardFeature({ key: 'Feature2', tag: 'Feature' }).withImplicitParent(parent._key)
        
        const lookup = createLookup([parent, featureA, featureB])
        expect(sortOrder(featureA._key, featureB._key, lookup)).toBeLessThan(0)
        expect(sortOrder(featureB._key, featureA._key, lookup)).toBeGreaterThan(0)
    })

    it('should order unrelated components by tag order', () => {
        const room = new StandardReferenceSimple({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#Room1' })
        const character = new StandardReferenceSimple({ tag: 'Character', key: 'Char1', universalKey: 'CHARACTER#Char1' })
        // Character comes before Room in componentKeys
        expect(sortOrder(character, room)).toBeLessThan(0)
        expect(sortOrder(room, character)).toBeGreaterThan(0)
    })

    it('should order deeply nested subcomponents after their ancestors', () => {
        const room = new StandardRoom({ key: 'Room1', tag: 'Room' })
        const featureKey = new StandardKey({ key: 'Feature1', universalKey: 'FEATURE#Feature1' })
        const feature = new StandardFeature({ key: 'Feature1', tag: 'Feature' }).withImplicitParent(room._key)
        const knowledge = new StandardKnowledge({ key: 'Feature1.Sub1', tag: 'Knowledge' }).withImplicitParent(featureKey)
        
        const lookup = createLookup([room, feature, knowledge])
        expect(sortOrder(feature._key, knowledge._key, lookup)).toBeLessThan(0)
        expect(sortOrder(knowledge._key, feature._key, lookup)).toBeGreaterThan(0)
    })

    it('should order components with same key and tag as equal', () => {
        const a = new StandardReferenceSimple({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#Room1' })
        const b = new StandardReferenceSimple({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#Room1' })
        expect(sortOrder(a, b)).toBe(0)
    })

    it('should order components with different ancestry by ancestor tag order', () => {
        const room1 = new StandardRoom({ key: 'Room1', tag: 'Room' })
        const room2 = new StandardRoom({ key: 'Room2', tag: 'Room' })
        const featureA = new StandardFeature({ key: 'Feature1', tag: 'Feature' }).withImplicitParent(room1._key)
        const featureB = new StandardFeature({ key: 'Feature2', tag: 'Feature' }).withImplicitParent(room2._key)
        
        const lookup = createLookup([room1, room2, featureA, featureB])
        
        // Both are Feature, but their ancestors are Room1 and Room2, which are both Room, so fallback to key comparison
        // Room1 should come before Room2 alphabetically
        expect(sortOrder(featureA._key, featureB._key, lookup)).toBeLessThan(0)
        expect(sortOrder(featureB._key, featureA._key, lookup)).toBeGreaterThan(0)
    })

    it('should order components with different tags and different ancestry', () => {
        const room1 = new StandardRoom({ key: 'Room1', tag: 'Room' })
        const room2 = new StandardRoom({ key: 'Room2', tag: 'Room' })
        const feature = new StandardFeature({ key: 'Feature1', tag: 'Feature' }).withImplicitParent(room1._key)
        
        const lookup = createLookup([room1, room2, feature])
        // Feature has Room1 as ancestor, Room2 is at Asset level
        // When comparing differing ancestors: Room1 vs Room2 (both Room), fallback to key comparison
        expect(sortOrder(room2._key, feature._key, lookup)).toBeGreaterThan(0)
        expect(sortOrder(feature._key, room2._key, lookup)).toBeLessThan(0)
    })

})
