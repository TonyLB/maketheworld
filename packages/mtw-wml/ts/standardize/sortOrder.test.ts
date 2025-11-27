import { standardComponentSortOrder } from './sortOrder'
import { StandardReferenceSimple, StandardKey } from './components/reference'
import StandardFeature from './components/feature'
import StandardRoom from './components/room'
import StandardCharacter from './components/character'
import StandardKnowledge from './components/knowledge'
import { StandardComponent } from './components/baseClasses'

describe('standardComponentSortOrder', () => {

    // Helper to create getAncestryChain function for testing
    // Builds a map of components by their _key for lookup
    const createGetAncestryChain = (components: StandardComponent[]): ((key: StandardKey) => StandardKey[]) => {
        // Helper to find component by key - handles cloned keys via JSON comparison
        const findComponent = (key: StandardKey): StandardComponent | undefined => {
            return components.find(comp => comp._key.equals(key))
        }
        
        return (key: StandardKey): StandardKey[] => {
            // Look up component by key
            const component = findComponent(key)
            
            if (!component || !component.implicitParent) {
                return []  // No component or no implicitParent means at Asset level
            }
            
            return [...createGetAncestryChain(components)(component.implicitParent), component.implicitParent]
        }
    }

    // Default getAncestryChain for tests that don't need hierarchy (returns empty array)
    const sortOrder = (a: StandardReferenceSimple | StandardKey, b: StandardReferenceSimple | StandardKey, getAncestryChain: (key: StandardKey) => StandardKey[] = () => ([])) => {
        return standardComponentSortOrder(a, b, getAncestryChain)
    }

    it('should order subcomponents after their parent', () => {
        const parentKey = new StandardKey({ key: 'Room1', tag: 'Room' })
        const parent = new StandardRoom({ key: 'Room1', tag: 'Room' })
        const child = new StandardFeature({ key: 'Feature1', tag: 'Feature' }).withImplicitParent(parentKey)
        
        const getAncestryChain = createGetAncestryChain([parent, child])
        expect(sortOrder(parent._key, child._key, getAncestryChain)).toBeLessThan(0)
        expect(sortOrder(child._key, parent._key, getAncestryChain)).toBeGreaterThan(0)
    })

    it('should order siblings by tag order', () => {
        const room = new StandardReferenceSimple({ key: 'Room1', tag: 'Room' })
        const feature = new StandardReferenceSimple({ key: 'Feature1', tag: 'Feature' })
        // Room comes before Feature in componentKeys
        expect(sortOrder(room, feature)).toBeGreaterThan(0)
        expect(sortOrder(feature, room)).toBeLessThan(0)
    })

    it('should order siblings with same tag by key', () => {
        const parentKey = new StandardKey({ key: 'Room1', tag: 'Room' })
        const parent = new StandardRoom({ key: 'Room1', tag: 'Room' })
        const featureA = new StandardFeature({ key: 'Feature1', tag: 'Feature' }).withImplicitParent(parentKey)
        const featureB = new StandardFeature({ key: 'Feature2', tag: 'Feature' }).withImplicitParent(parentKey)
        
        const getAncestryChain = createGetAncestryChain([parent, featureA, featureB])
        expect(sortOrder(featureA._key, featureB._key, getAncestryChain)).toBeLessThan(0)
        expect(sortOrder(featureB._key, featureA._key, getAncestryChain)).toBeGreaterThan(0)
    })

    it('should order unrelated components by tag order', () => {
        const room = new StandardReferenceSimple({ key: 'Room1', tag: 'Room' })
        const character = new StandardReferenceSimple({ key: 'Char1', tag: 'Character' })
        // Character comes before Room in componentKeys
        expect(sortOrder(character, room)).toBeLessThan(0)
        expect(sortOrder(room, character)).toBeGreaterThan(0)
    })

    it('should order deeply nested subcomponents after their ancestors', () => {
        const roomKey = new StandardKey({ key: 'Room1', tag: 'Room' })
        const room = new StandardRoom({ key: 'Room1', tag: 'Room' })
        const featureKey = new StandardKey({ key: 'Feature1', tag: 'Feature' })
        const feature = new StandardFeature({ key: 'Feature1', tag: 'Feature' }).withImplicitParent(roomKey)
        const knowledge = new StandardKnowledge({ key: 'Feature1.Sub1', tag: 'Knowledge' }).withImplicitParent(featureKey)
        
        const getAncestryChain = createGetAncestryChain([room, feature, knowledge])
        expect(sortOrder(feature._key, knowledge._key, getAncestryChain)).toBeLessThan(0)
        expect(sortOrder(knowledge._key, feature._key, getAncestryChain)).toBeGreaterThan(0)
    })

    it('should order components with same key and tag as equal', () => {
        const a = new StandardReferenceSimple({ key: 'Room1', tag: 'Room' })
        const b = new StandardReferenceSimple({ key: 'Room1', tag: 'Room' })
        expect(sortOrder(a, b)).toBe(0)
    })

    it('should order components with different ancestry by ancestor tag order', () => {
        const room1 = new StandardRoom({ key: 'Room1', tag: 'Room' })
        const room2 = new StandardRoom({ key: 'Room2', tag: 'Room' })
        const featureA = new StandardFeature({ key: 'Feature1', tag: 'Feature' }).withImplicitParent(room1._key)
        const featureB = new StandardFeature({ key: 'Feature2', tag: 'Feature' }).withImplicitParent(room2._key)
        
        const getAncestryChain = createGetAncestryChain([room1, room2, featureA, featureB])
        
        // Both are Feature, but their ancestors are Room1 and Room2, which are both Room, so fallback to key comparison
        // Room1 should come before Room2 alphabetically
        expect(sortOrder(featureA._key, featureB._key, getAncestryChain)).toBeLessThan(0)
        expect(sortOrder(featureB._key, featureA._key, getAncestryChain)).toBeGreaterThan(0)
    })

    it('should order components with different tags and different ancestry', () => {
        const room1Key = new StandardKey({ key: 'Room1', tag: 'Room' })
        const room1 = new StandardRoom({ key: 'Room1', tag: 'Room' })
        const room2 = new StandardRoom({ key: 'Room2', tag: 'Room' })
        const feature = new StandardFeature({ key: 'Feature1', tag: 'Feature' }).withImplicitParent(room1Key)
        
        const getAncestryChain = createGetAncestryChain([room1, room2, feature])
        // Feature has Room1 as ancestor, Room2 is at Asset level
        // When comparing differing ancestors: Room1 vs Room2 (both Room), fallback to key comparison
        expect(sortOrder(room2._key, feature._key, getAncestryChain)).toBeGreaterThan(0)
        expect(sortOrder(feature._key, room2._key, getAncestryChain)).toBeLessThan(0)
    })

    it('should order components with empty keys as equal', () => {
        const a = new StandardReferenceSimple({ key: '', tag: 'Room' })
        const b = new StandardReferenceSimple({ key: '', tag: 'Room' })
        expect(sortOrder(a, b)).toBe(0)
    })
})
