import TagTree, { iterativeMerge } from '.'
import { schemaFromParse, schemaToWML } from '../simpleSchema'
import parse from '../simpleParser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import { deIndentWML } from '../simpleSchema/utils'

describe('TagTree', () => {
    describe('iterativeMerge', () => {
        it('should merge data into an empty tree', () => {
            expect(iterativeMerge([], ['test'])).toEqual([{ data: 'test', children: [] }])
            expect(iterativeMerge([], ['testA', 'testB', 'testC'])).toEqual([{ data: 'testA', children: [{ data: 'testB', children: [{ data: 'testC', children: [] }] }] }])
        })

        it('should merge data into an existing tree', () => {
            const testTree = [{
                data: 'testA',
                children: [
                    { data: 'testB', children: [{ data: 'testC', children: [] }] }
                ]
            }]
            expect(iterativeMerge(testTree, ['testA', 'testB', 'testD'])).toEqual([{
                data: 'testA',
                children: [{
                    data: 'testB',
                    children: [
                        { data: 'testC', children: [] },
                        { data: 'testD', children: [] }
                    ]
                }]
            }])
            expect(iterativeMerge(testTree, ['testA', 'testD'])).toEqual([{
                data: 'testA',
                children: [
                    {
                        data: 'testB',
                        children: [{ data: 'testC', children: [] }]
                    },
                    { data: 'testD', children: [] }
                ]
            }])

        })
    }) 

    it('should return tree unchanged on empty arguments', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Name>Test room</Name>
                    <Exit to=(room2) />
                </Room>
                <Room key=(room2) />
            </Asset>
        `))))
        const tagTree = new TagTree(testTree)
        expect(tagTree.tree()).toEqual(testTree)
    })

    xit('should reorder tags correctly', () => {
        const testTree = schemaFromParse(parse(tokenizer(new SourceStream(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Name>Lobby</Name>
                    <Description>An institutional lobby.</Description>
                </Room>
                <If {true}>
                    <Room key=(room1)>
                        <Name><Space />at night</Name>
                        <Description><Space />The lights are out, and shadows stretch along the walls.</Description>
                    </Room>
                </If>
            </Asset>
        `))))
        const tagTree = new TagTree(testTree)
        expect(schemaToWML(tagTree.tree({ reorderTags: ['Room', 'Description', 'Name', 'If']}))).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(room1)>
                    <Name>Lobby<If {true}><Space />at night</If></Name>
                    <Description>
                        An institutional lobby.<If {true}>
                            <Space />
                            The lights are out, and shadows stretch along the walls.
                        </If>
                    </Description>
                </Room>
            </Asset>
        `))
    })

})