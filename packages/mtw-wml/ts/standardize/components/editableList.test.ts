import { editableListClassFactory } from './editableList'
import { StandardReference } from './reference'
import StandardRoom from './room'
import StandardFeature from './feature'

describe('editableListClassFactory', () => {
    class ReferenceList extends editableListClassFactory(StandardReference as any, 'TestEditableList') {
        override merge(other: ReferenceList): ReferenceList | undefined {
            const merged = super.merge(other)
            if (merged) {
                return merged as ReferenceList
            }
            return undefined
        }

        override diff(other: ReferenceList): ReferenceList | undefined {
            const diffed = super.diff(other)
            if (diffed) {
                return diffed as ReferenceList
            }
            return undefined
        }

        get payload(): StandardReference[] {
            return this._items as unknown as StandardReference[];
        }
    }

    it('should construct an empty list', () => {
        const instance = new ReferenceList([])
        expect(instance).toBeInstanceOf(ReferenceList)
        expect(instance._items).toEqual([])
    })

    it('should construct from JSON data', () => {
        const jsonData = ['ROOM#test', { key: 'featureTest', tag: 'Feature' }]
        const instance = new ReferenceList(jsonData)
        expect(instance).toBeInstanceOf(ReferenceList)
        expect(instance._items.length).toBe(2)
        expect(instance._items.map(item => item.toJSON())).toEqual(jsonData)
    })

    it('should construct from schema', () => {
        const schema = [
            new StandardRoom(`<Room uuid=(test) />`).schema,
            new StandardFeature(`<Feature key=(featureTest) />`).schema
        ]
        const instance = new ReferenceList(schema)
        expect(instance).toBeInstanceOf(ReferenceList)
        expect(instance._items.length).toBe(2)
        expect(instance._items.map(item => item.toJSON())).toEqual(['ROOM#test', { key: 'featureTest', tag: 'Feature' }])
    })

    it('should make items unique upon construction', () => {
        const jsonData = ['ROOM#test', { key: 'featureTest', tag: 'Feature' }, 'ROOM#test']
        const instance = new ReferenceList(jsonData)
        expect(instance).toBeInstanceOf(ReferenceList)
        expect(instance._items.length).toBe(2)
        expect(instance._items.map(item => item.toJSON())).toEqual([{ key: 'featureTest', tag: 'Feature' }, 'ROOM#test'])
    })

    it('should return payload', () => {
        const jsonData = ['ROOM#test', { key: 'featureTest', tag: 'Feature' }]
        const instance = new ReferenceList(jsonData)
        expect(instance.payload.map(item => item.toJSON())).toEqual(jsonData)
    })

    it('should merge simple items', () => {
        const base = new ReferenceList(['ROOM#test'])
        const toMerge = new ReferenceList([{ key: 'featureTest', tag: 'Feature' }])
        const merged = base.merge(toMerge)
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged._items.length).toBe(2)
            expect(merged._items.map(item => item.toJSON())).toEqual(['ROOM#test', { key: 'featureTest', tag: 'Feature' }])
        }
    })

    it('should merge incoming removes', () => {
        const base = new ReferenceList(['ROOM#test', 'FEATURE#toRemove'])
        const toMerge = new ReferenceList([
            { tag: 'Remove', match: { key: 'featureTest', tag: 'Feature', universalKey: 'FEATURE#toRemove' } },
            { tag: 'Remove', match: { key: 'unmatched', tag: 'Room' } }
        ])
        const merged = base.merge(toMerge)
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged._items.length).toBe(2)
            expect(merged._items.map(item => item.toJSON())).toEqual([
                'ROOM#test',
                { tag: 'Remove', match: { key: 'unmatched', tag: 'Room' } }
            ])
        }
    })

    it('should merge into base removes', () => {
        const base = new ReferenceList([
            'ROOM#test',
            { tag: 'Remove', match: { key: 'featureTest', tag: 'Feature', universalKey: 'FEATURE#removed' } }
        ])
        const toMerge = new ReferenceList(['FEATURE#removed'])
        const merged = base.merge(toMerge)
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged._items.length).toBe(1)
            expect(merged._items.map(item => item.toJSON())).toEqual(['ROOM#test'])
        }
    })

    it('should throw error when attempting to change reference target', () => {
        const base = new ReferenceList([
            'ROOM#test',
            'FEATURE#toReplace'            
        ])
        const toMerge = new ReferenceList([
            { tag: 'Replace', match: { key: 'featureTest', tag: 'Feature', universalKey: 'FEATURE#toReplace' }, payload: { key: 'newFeature', tag: 'Feature' } }
        ])
        expect(() => base.merge(toMerge)).toThrow('Cannot change which component a reference points to')
    })

    it('should merge removes into base replaces', () => {
        const base = new ReferenceList([
            'ROOM#test',
            { tag: 'Replace', match: 'FEATURE#toReplace', payload: { key: 'newFeature', tag: 'Feature' } }
        ])
        const toMerge = new ReferenceList([
            { tag: 'Remove', match: { key: 'newFeature', tag: 'Feature' } }
        ])
        const merged = base.merge(toMerge)
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged._items.length).toBe(2)
            expect(merged._items.map(item => item.toJSON())).toEqual(['ROOM#test', { tag: 'Remove', match: 'FEATURE#toReplace' }])
        }
    })

    it('should diff simple items', () => {
        const base = new ReferenceList(['ROOM#test', 'FEATURE#toRemove'])
        const toDiff = new ReferenceList([{ key: 'featureTest', tag: 'Feature' }, 'ROOM#test'])
        const diffed = base.diff(toDiff)
        expect(diffed).toBeDefined()
        if (diffed) {
            expect(diffed._items.length).toBe(2)
            expect(diffed._items.map(item => item.toJSON())).toEqual([{ tag: 'Remove', match: 'FEATURE#toRemove' }, { key: 'featureTest', tag: 'Feature' }])
        }
    })

    it('should diff base removes', () => {
        const base = new ReferenceList([{ tag: 'Remove', match: 'FEATURE#toRemove' }])
        const toDiff = new ReferenceList([])
        const diffed = base.diff(toDiff)
        expect(diffed).toBeDefined()
        if (diffed) {
            expect(diffed._items.length).toBe(1)
            expect(diffed._items.map(item => item.toJSON())).toEqual(['FEATURE#toRemove'])
        }
    })
})
