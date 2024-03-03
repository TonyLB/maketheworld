import { schemaFromParse, schemaToWML } from '../schema'
import { SchemaTagTree } from './schema'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import parse from '../simpleParser'
import { deIndentWML } from '../schema/utils'
import { SchemaTag } from '../schema/baseClasses'
import { GenericTree, TreeId } from '../tree/baseClasses'

describe('SchemaTagTree', () => {
    it('should condense order-independent entries', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Description>Test description</Description>
                    <Name>Test room</Name>
                    <Exit to=(room2) />
                </Room>
                <Room key=(room2) />
                <Room key=(room1)>
                    <Description>: Added</Description>
                </Room>
            </Asset>
        `))))
        const tagTree = new SchemaTagTree(testTree)
        expect(schemaToWML(tagTree.tree)).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Description>Test description: Added</Description>
                    <Name>Test room</Name>
                    <Exit to=(room2) />
                </Room>
                <Room key=(room2) />
            </Asset>
        `))
    })

    it('should preserve ids where possible on merger', () => {
        const testTree: GenericTree<SchemaTag, TreeId> = [
            {
                data: { tag: 'Room', key: 'testRoom' },
                children: [{
                    data: { tag: 'Description' },
                    children: [{ data: { tag: 'String', value: 'Test' }, children: [], id: 'GHI'}],
                    id: 'DEF'
                }],
                id: 'ABC'
            },
            {
                data: { tag: 'If' },
                id: 'IF-1',
                children: [{
                    data: { tag: 'Statement', if: 'true' },
                    children: [{
                        data: { tag: 'Room', key: 'testRoom' },
                        children: [{
                            data: { tag: 'Description' },
                            children: [{ data: { tag: 'String', value: 'Condition' }, children: [], id: 'QRS'}],
                            id: 'MNO'
                        }],
                        id: 'JKL'
                    }],
                    id: 'STATEMENT-1'
                }]
            }
        ]
        const tagTree = new SchemaTagTree(testTree)
            .reordered([{ match: 'Room' }, { match: 'Description' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }])
        expect(tagTree.tree).toEqual([{
            data: { tag: 'Room', key: 'testRoom' },
            children: [{
                data: { tag: 'Description' },
                children: [
                    { data: { tag: 'String', value: 'Test' }, children: [], id: 'GHI'},
                    {
                        data: { tag: 'If' },
                        id: 'IF-1',
                        children: [{
                            data: { tag: 'Statement', if: 'true' },
                            children: [{ data: { tag: 'String', value: 'Condition' }, children: [], id: 'QRS'}],
                            id: 'STATEMENT-1'
                        }]
                    }
                ],
                id: 'DEF'
            }],
            id: 'ABC'
        }])
    })

})