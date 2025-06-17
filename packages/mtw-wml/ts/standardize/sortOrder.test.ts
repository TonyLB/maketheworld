import { standardComponentSortOrder } from './sortOrder'
import { StandardReferenceSimple, StandardKey } from './components/reference'
import { ComponentTag } from './components/dataTypes/abstract'

describe('standardComponentSortOrder', () => {
    // Lookup function for ancestry, returns a StandardReference with the given key and a tag based on key
    const lookup = (key: string) => {
        // For test purposes, tag is based on the last part of the key, or 'Room' by default
        const tagMap: Record<string, string> = {
            'Room1': 'Room',
            'Room1.Feature1': 'Feature',
            'Room1.Feature2': 'Feature',
            'Room2': 'Room',
            'Room2.Feature1': 'Feature',
            'Room1.Feature1.Sub1': 'Action',
            'Room1.Feature1.Sub2': 'Action'
        }
        return new StandardReferenceSimple({ key, tag: (tagMap[key] || 'Room') as ComponentTag })
    }

    const sortOrder = standardComponentSortOrder

    it('should order subcomponents after their parent', () => {
        const parent = new StandardReferenceSimple({ key: 'Room1', tag: 'Room' })
        const child = new StandardReferenceSimple({ key: 'Feature1', tag: 'Feature' }).withContext([new StandardKey({ key: 'Room1', tag: 'Room' })])
        expect(sortOrder(parent, child)).toBeLessThan(0)
        expect(sortOrder(child, parent)).toBeGreaterThan(0)
    })

    it('should order siblings by tag order', () => {
        const room = new StandardReferenceSimple({ key: 'Room1', tag: 'Room' })
        const feature = new StandardReferenceSimple({ key: 'Feature1', tag: 'Feature' })
        // Room comes before Feature in componentKeys
        expect(sortOrder(room, feature)).toBeGreaterThan(0)
        expect(sortOrder(feature, room)).toBeLessThan(0)
    })

    it('should order siblings with same tag by key', () => {
        const featureA = new StandardReferenceSimple({ key: 'Feature1', tag: 'Feature' }).withContext([new StandardKey({ key: 'Room1', tag: 'Room' })])
        const featureB = new StandardReferenceSimple({ key: 'Feature2', tag: 'Feature' }).withContext([new StandardKey({ key: 'Room1', tag: 'Room' })])
        expect(sortOrder(featureA, featureB)).toBeLessThan(0)
        expect(sortOrder(featureB, featureA)).toBeGreaterThan(0)
    })

    it('should order unrelated components by tag order', () => {
        const room = new StandardReferenceSimple({ key: 'Room1', tag: 'Room' })
        const character = new StandardReferenceSimple({ key: 'Char1', tag: 'Character' })
        // Character comes before Room in componentKeys
        expect(sortOrder(character, room)).toBeLessThan(0)
        expect(sortOrder(room, character)).toBeGreaterThan(0)
    })

    it('should order deeply nested subcomponents after their ancestors', () => {
        const parent = new StandardReferenceSimple({ key: 'Feature1', tag: 'Feature' }).withContext([new StandardKey({ key: 'Room1', tag: 'Room' })])
        const child = new StandardReferenceSimple({ key: 'Feature1.Sub1', tag: 'Action' }).withContext([new StandardKey({ key: 'Room1', tag: 'Room' })])
        expect(sortOrder(parent, child)).toBeLessThan(0)
        expect(sortOrder(child, parent)).toBeGreaterThan(0)
    })

    it('should order components with no key as equal', () => {
        const a = new StandardReferenceSimple({ key: undefined, tag: 'Room' })
        const b = new StandardReferenceSimple({ key: undefined, tag: 'Room' })
        expect(sortOrder(a, b)).toBe(0)
    })

    it('should order components with same key and tag as equal', () => {
        const a = new StandardReferenceSimple({ key: 'Room1', tag: 'Room' })
        const b = new StandardReferenceSimple({ key: 'Room1', tag: 'Room' })
        expect(sortOrder(a, b)).toBe(0)
    })

    it('should order components with different ancestry by ancestor tag order', () => {
        const a = new StandardReferenceSimple({ key: 'Feature1', tag: 'Feature'}).withContext([new StandardKey({ key: 'Room1', tag: 'Room' })])
        const b = new StandardReferenceSimple({ key: 'Feature1', tag: 'Feature'}).withContext([new StandardKey({ key: 'Room2', tag: 'Room' })])
        // Both are Feature, but their ancestors are Room1 and Room2, which are both Room, so fallback to key comparison
        expect(sortOrder(a, b)).toBeLessThan(0)
        expect(sortOrder(b, a)).toBeGreaterThan(0)
    })

    it('should order components with different tags and different ancestry', () => {
        const a = new StandardReferenceSimple({ key: 'Feature1', tag: 'Feature' }).withContext([new StandardKey({ key: 'Room1', tag: 'Room' })])
        const b = new StandardReferenceSimple({ key: 'Room2', tag: 'Room' })
        // Room1 comes before Room2
        expect(sortOrder(b, a)).toBeGreaterThan(0)
        expect(sortOrder(a, b)).toBeLessThan(0)
    })

    it('should order components with empty keys as equal', () => {
        const a = new StandardReferenceSimple({ key: '', tag: 'Room' })
        const b = new StandardReferenceSimple({ key: '', tag: 'Room' })
        expect(sortOrder(a, b)).toBe(0)
    })
})
