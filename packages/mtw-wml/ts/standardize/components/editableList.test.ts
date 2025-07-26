import { editableListClassFactory } from './editableList'
import { StandardReference } from './reference'
import StandardRoom from './room'
import StandardFeature from './feature'

describe('editableListClassFactory', () => {
    const ReferenceList = editableListClassFactory(StandardReference as any, 'TestEditableList');

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
})
