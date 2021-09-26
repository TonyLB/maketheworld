import { treeStateReducer } from './index'
import { NestedTree } from './interfaces'

type TestItem = {
    name: string;
}

describe('DraggableTree', () => {
    const testTree: NestedTree<TestItem> = [{
        item: { name: 'One' },
        children: [{
            item: { name: 'One-A' },
            children: []
        },
        {
            item: { name: 'One-B' },
            children: []
        },
        {
            item: { name: 'One-C' },
            children: []
        }]
    },
    {
        item: { name: 'Two' },
        children: []
    },
    {
        item: { name: 'Three' },
        children: []
    }]
    const addEntry = {
        item: { name: 'Added' },
        children: [{
            item: { name: 'Child'},
            children: []
        }]
    }
    const keyMap = ({ name }: TestItem) => (name)
    describe('treeStateReducer', () => {
        describe('ADD action', () => {
            it('correctly adds to the middle of siblings', () => {
                expect(treeStateReducer(keyMap)(testTree, { type: 'ADD', parentKey: 'One', position: 1, entry: addEntry }))
                    .toEqual([{
                        item: { name: 'One' },
                        children: [{
                            item: { name: 'One-A' },
                            children: []
                        },
                        addEntry,
                        {
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            item: { name: 'One-C' },
                            children: []
                        }]
                    },
                    {
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        item: { name: 'Three' },
                        children: []
                    }])
                expect(treeStateReducer(keyMap)(testTree, { type: 'ADD', parentKey: undefined, position: 1, entry: addEntry }))
                    .toEqual([{
                        item: { name: 'One' },
                        children: [{
                            item: { name: 'One-A' },
                            children: []
                        },
                        {
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            item: { name: 'One-C' },
                            children: []
                        }]
                    },
                    addEntry,
                    {
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        item: { name: 'Three' },
                        children: []
                    }])
            })
            it('correctly adds to the start of siblings', () => {
                expect(treeStateReducer(keyMap)(testTree, { type: 'ADD', parentKey: 'One', position: 0, entry: addEntry }))
                    .toEqual([{
                        item: { name: 'One' },
                        children: [addEntry,
                        {
                            item: { name: 'One-A' },
                            children: []
                        },
                        {
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            item: { name: 'One-C' },
                            children: []
                        }]
                    },
                    {
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        item: { name: 'Three' },
                        children: []
                    }])
                expect(treeStateReducer(keyMap)(testTree, { type: 'ADD', parentKey: undefined, position: 0, entry: addEntry }))
                    .toEqual([addEntry,
                    {
                        item: { name: 'One' },
                        children: [{
                            item: { name: 'One-A' },
                            children: []
                        },
                        {
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            item: { name: 'One-C' },
                            children: []
                        }]
                    },
                    {
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        item: { name: 'Three' },
                        children: []
                    }])
            })
            it('correctly adds to the end of siblings', () => {
                expect(treeStateReducer(keyMap)(testTree, { type: 'ADD', parentKey: 'One', position: 3, entry: addEntry }))
                    .toEqual([{
                        item: { name: 'One' },
                        children: [{
                            item: { name: 'One-A' },
                            children: []
                        },
                        {
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            item: { name: 'One-C' },
                            children: []
                        },
                        addEntry]
                    },
                    {
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        item: { name: 'Three' },
                        children: []
                    }])
                expect(treeStateReducer(keyMap)(testTree, { type: 'ADD', parentKey: undefined, position: 3, entry: addEntry }))
                    .toEqual([{
                        item: { name: 'One' },
                        children: [{
                            item: { name: 'One-A' },
                            children: []
                        },
                        {
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            item: { name: 'One-C' },
                            children: []
                        }]
                    },
                    {
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        item: { name: 'Three' },
                        children: []
                    },
                    addEntry])
            })
        })
        describe('REMOVE action', () => {
            it('correctly removes from the middle of siblings', () => {

            })
            it('correctly removes from the start of siblings', () => {

            })
            it('correctly removes from the end of siblings', () => {

            })
        })
    })
})