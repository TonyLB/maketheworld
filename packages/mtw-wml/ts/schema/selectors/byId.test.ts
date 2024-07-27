import { SchemaTag } from '../baseClasses'
import { GenericTree, TreeId } from '../../tree/baseClasses'
import { selectById } from './byId'

describe('byId selector', () => {
    it('should select dependencies from a room', () => {
        const testOne: GenericTree<SchemaTag, TreeId> = [{
            data: { tag: 'Asset', key: 'test', Story: undefined },
            id: 'ASSET',
            children: [{
                data: { tag: 'Room', key: 'testRoom' },
                id: 'ROOM',
                children: [{
                    data: { tag: 'Description' },
                    id: 'DESCRIPTION',
                    children: [
                        { data: { tag: 'String', value: 'Test' }, children: [], id: 'ABC' },
                        { data: { tag: 'br' }, children: [], id: 'BR' },
                        { data: { tag: 'String', value: 'Next line' }, children: [], id: 'DEF' }
                    ]
                }]
            }]
        }]
        expect(selectById('DESCRIPTION')(testOne)).toEqual({
            data: { tag: 'Description' },
            id: 'DESCRIPTION',
            children: [
                { data: { tag: 'String', value: 'Test' }, children: [], id: 'ABC' },
                { data: { tag: 'br' }, children: [], id: 'BR' },
                { data: { tag: 'String', value: 'Next line' }, children: [], id: 'DEF' }
            ]
        })
    })

})
