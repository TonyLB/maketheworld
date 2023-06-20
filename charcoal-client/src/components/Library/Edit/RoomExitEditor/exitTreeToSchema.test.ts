import exitTreeToSchema from "./exitTreeToSchema"

describe('exitTreeToSchema', () => {

    it('should reorder exits', () => {
        expect(exitTreeToSchema({
            items: [
                { key: 'test1:test3', from: 'test1', to: 'test3', name: 'out' },
                { key: 'test1:test2', from: 'test1', to: 'test2', name: 'north' },
                { key: 'test2:test1', from: 'test2', to: 'test1', name: 'south' },
                { key: 'test3:test2', from: 'test3', to: 'test2', name: 'left' }
            ],
            conditionals: [
                {
                    if: {
                        key: 'import-0',
                        source: 'abc',
                        node: {
                            items: [{ key: 'test3:test1', from: 'test3', to: 'test1', name: 'in' }],
                            conditionals: []
                        },
                    },
                    elseIfs: []
                }
            ]
        })).toEqual({
            test1: [
                { tag: 'Exit', contents: [],  key: 'test1#test2', name: 'north', from: 'test1', to: 'test2' },
                { tag: 'Exit', contents: [],  key: 'test1#test3', name: 'out', from: 'test1', to: 'test3' }
            ],
            test2: [
                { tag: 'Exit', contents: [],  key: 'test2#test1', name: 'south', from: 'test2', to: 'test1' }
            ],
            test3: [
                { tag: 'Exit', contents: [],  key: 'test3#test2', name: 'left', from: 'test3', to: 'test2' },
                {
                    tag: 'If',
                    contextTag: 'Room',
                    conditions: [{ dependencies: ['abc'], if: 'abc' }],
                    contents: [{ tag: 'Exit', contents: [],  key: 'test3#test1', name: 'in', from: 'test3', to: 'test1' }]
                }
            ]
        })
    })

    it('should properly order conditionals', () => {
        expect(exitTreeToSchema({
            items: [],
            conditionals: [
                {
                    if: {
                        key: 'import-0',
                        source: 'def',
                        node: {
                            items: [
                                { key: 'test1:test2', from: 'test1', to: 'test2', name: 'test1-test2' },
                            ],
                            conditionals: [{
                                if: {
                                    key: 'import-1',
                                    source: 'abc',
                                    node: {
                                        items: [{ key: 'test1:test3', from: 'test1', to: 'test3', name: 'test1-test3' }],
                                        conditionals: []
                                    }
                                },
                                elseIfs: [],
                                else: {
                                    key: 'else-0',
                                    node: {
                                        items: [{ key: 'test1:test4', from: 'test1', to: 'test4', name: 'test1-test4' }],
                                        conditionals: []
                                    }
                                }
                            }]
                        }
                    },
                    elseIfs: [
                        {
                            key: 'import-2',
                            source: 'ghi',
                            node: {
                                items: [{ key: 'test1:test5', from: 'test1', to: 'test5', name: 'test1-test5' }],
                                conditionals: []
                            }
                        }
                    ]
                },
                {
                    if: {
                        key: 'import-3',
                        source: 'adf',
                        node: {
                            items: [{ key: 'test1:test6', from: 'test1', to: 'test6', name: 'test1-test6' }],
                            conditionals: []
                        }
                    },
                    elseIfs: []
                }
            ]
        })).toEqual({
            test1: [
                {
                    tag: 'If',
                    contextTag: 'Room',
                    conditions: [{ dependencies: ['adf'], if: 'adf' }],
                    contents: [
                        { tag: 'Exit', contents: [], key: 'test1#test6', from: 'test1', to: 'test6', name: 'test1-test6' }
                    ]
                },
                {
                    tag: 'If',
                    contextTag: 'Room',
                    conditions: [{ dependencies: ['def'], if: 'def' }],
                    contents: [
                        { tag: 'Exit', contents: [], key: 'test1#test2', from: 'test1', to: 'test2', name: 'test1-test2' },
                        {
                            tag: 'If',
                            contextTag: 'Room',
                            conditions: [{ dependencies: ['abc'], if: 'abc' }],
                            contents: [
                                { tag: 'Exit', contents: [], key: 'test1#test3', from: 'test1', to: 'test3', name: 'test1-test3' }
                            ]
                        },
                        {
                            tag: 'If',
                            contextTag: 'Room',
                            conditions: [{ dependencies: ['abc'], if: 'abc', not: true }],
                            contents: [
                                { tag: 'Exit', contents: [], key: 'test1#test4', from: 'test1', to: 'test4', name: 'test1-test4' }
                            ]
                        }
                    ]
                },
                {
                    tag: 'If',
                    contextTag: 'Room',
                    conditions: [{ dependencies: ['def'], if: 'def', not: true }, { dependencies: ['ghi'], if: 'ghi' }],
                    contents: [
                        { tag: 'Exit', contents: [], key: 'test1#test5', from: 'test1', to: 'test5', name: 'test1-test5' }
                    ]
                },
            ]
        })
    })
})