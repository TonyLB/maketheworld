import { treeStateReducer } from './index'
import { NestedTree } from './interfaces'

type TestItem = {
    name: string;
}

describe('DraggableTree', () => {
    const testTree: NestedTree<TestItem> = [{
        key: 'One',
        item: { name: 'One' },
        children: [{
            key: 'One-A',
            item: { name: 'One-A' },
            children: []
        },
        {
            key: 'One-B',
            item: { name: 'One-B' },
            children: []
        },
        {
            key: 'One-C',
            item: { name: 'One-C' },
            children: []
        }]
    },
    {
        key: 'Two',
        item: { name: 'Two' },
        children: []
    },
    {
        key: 'Three',
        item: { name: 'Three' },
        children: []
    }]
    const addEntry = {
        key: 'Added',
        item: { name: 'Added' },
        children: [{
            key: 'Child',
            item: { name: 'Child'},
            children: []
        }]
    }
    describe('treeStateReducer', () => {
        describe('ADD action', () => {
            it('correctly adds to the middle of siblings', () => {
                expect(treeStateReducer(testTree, { type: 'ADD', parentKey: 'One', position: 1, entry: addEntry }))
                    .toEqual([{
                        key: 'One',
                        item: { name: 'One' },
                        children: [{
                            key: 'One-A',
                            item: { name: 'One-A' },
                            children: []
                        },
                        addEntry,
                        {
                            key: 'One-B',
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            key: 'One-C',
                            item: { name: 'One-C' },
                            children: []
                        }]
                    },
                    {
                        key: 'Two',
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        key: 'Three',
                        item: { name: 'Three' },
                        children: []
                    }])
                expect(treeStateReducer(testTree, { type: 'ADD', parentKey: undefined, position: 1, entry: addEntry }))
                    .toEqual([{
                        key: 'One',
                        item: { name: 'One' },
                        children: [{
                            key: 'One-A',
                            item: { name: 'One-A' },
                            children: []
                        },
                        {
                            key: 'One-B',
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            key: 'One-C',
                            item: { name: 'One-C' },
                            children: []
                        }]
                    },
                    addEntry,
                    {
                        key: 'Two',
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        key: 'Three',
                        item: { name: 'Three' },
                        children: []
                    }])
            })
            it('correctly adds to the start of siblings', () => {
                expect(treeStateReducer(testTree, { type: 'ADD', parentKey: 'One', position: 0, entry: addEntry }))
                    .toEqual([{
                        key: 'One',
                        item: { name: 'One' },
                        children: [addEntry,
                        {
                            key: 'One-A',
                            item: { name: 'One-A' },
                            children: []
                        },
                        {
                            key: 'One-B',
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            key: 'One-C',
                            item: { name: 'One-C' },
                            children: []
                        }]
                    },
                    {
                        key: 'Two',
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        key: 'Three',
                        item: { name: 'Three' },
                        children: []
                    }])
                expect(treeStateReducer(testTree, { type: 'ADD', parentKey: undefined, position: 0, entry: addEntry }))
                    .toEqual([addEntry,
                    {
                        key: 'One',
                        item: { name: 'One' },
                        children: [{
                            key: 'One-A',
                            item: { name: 'One-A' },
                            children: []
                        },
                        {
                            key: 'One-B',
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            key: 'One-C',
                            item: { name: 'One-C' },
                            children: []
                        }]
                    },
                    {
                        key: 'Two',
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        key: 'Three',
                        item: { name: 'Three' },
                        children: []
                    }])
            })
            it('correctly adds to the end of siblings', () => {
                expect(treeStateReducer(testTree, { type: 'ADD', parentKey: 'One', position: 3, entry: addEntry }))
                    .toEqual([{
                        key: 'One',
                        item: { name: 'One' },
                        children: [{
                            key: 'One-A',
                            item: { name: 'One-A' },
                            children: []
                        },
                        {
                            key: 'One-B',
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            key: 'One-C',
                            item: { name: 'One-C' },
                            children: []
                        },
                        addEntry]
                    },
                    {
                        key: 'Two',
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        key: 'Three',
                        item: { name: 'Three' },
                        children: []
                    }])
                expect(treeStateReducer(testTree, { type: 'ADD', parentKey: undefined, position: 3, entry: addEntry }))
                    .toEqual([{
                        key: 'One',
                        item: { name: 'One' },
                        children: [{
                            key: 'One-A',
                            item: { name: 'One-A' },
                            children: []
                        },
                        {
                            key: 'One-B',
                            item: { name: 'One-B' },
                            children: []
                        },
                        {
                            key: 'One-C',
                            item: { name: 'One-C' },
                            children: []
                        }]
                    },
                    {
                        key: 'Two',
                        item: { name: 'Two' },
                        children: []
                    },
                    {
                        key: 'Three',
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