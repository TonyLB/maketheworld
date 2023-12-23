import TagTree from '.'
import { GenericTree } from '../sequence/tree/baseClasses'
import { SchemaTag } from '../simpleSchema/baseClasses'

describe('TagTree', () => {
    it('should return tree unchanged on empty arguments', () => {
        const testTree: GenericTree<SchemaTag> = [{
            data: {
                tag: 'Room',
                key: 'Room-1',
                contents: [],
                render: [],
                name: []
            },
            children: [
                { data: { tag: 'Exit', key: 'Room-1#Room-2', from : 'Room-1', to: 'Room-2', contents: [], name: '' }, children: [] }
            ]
        },
        {
            data: {
                tag: 'Room',
                key: 'Room-2',
                contents: [],
                render: [],
                name: []
            },
            children: []
        }]
        const tagTree = new TagTree(testTree)
        expect(tagTree.tree()).toEqual(testTree)
    })
})