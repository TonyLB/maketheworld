import { slateToExitSchema } from './slateToExitTree'

describe('slateToExitSchema', () => {

    it('should reorder exits', () => {
        expect(slateToExitSchema([
            { type: 'exit', key: 'test1:test3', from: 'test1', to: 'test3', children: [{ text: 'out' }] },
            { type: 'ifBase', source: 'abc', children: [
                { type: 'exit', key: 'test3:test1', from: 'test3', to: 'test1', children: [{ text: 'in' }] }
            ]},
            { type: 'exit', key: 'test1:test2', from: 'test1', to: 'test2', children: [{ text: 'north' }] },
            { type: 'exit', key: 'test2:test1', from: 'test2', to: 'test1', children: [{ text: 'south' }] },
            { type: 'exit', key: 'test3:test2', from: 'test3', to: 'test2', children: [{ text: 'left' }] }
        ])).toEqual({
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
                    conditions: [{ dependencies: ['abc'], if: 'abc' }],
                    contents: [{ tag: 'Exit', contents: [],  key: 'test3#test1', name: 'in', from: 'test3', to: 'test1' }]
                }
            ]
        })
    })

    it('should properly order conditionals', () => {
        expect(slateToExitSchema([
            { type: 'ifBase', source: 'def', children: [
                { type: 'exit', key: 'test1:test2', from: 'test1', to: 'test2', children: [{ text: 'test1-test2'}] },
                { type: 'ifBase', source: 'abc', children: [
                    { type: 'exit', key: 'test1:test3', from: 'test1', to: 'test3', children: [{ text: 'test1-test3' }] }
                ]},
                { type: 'else', children: [
                    { type: 'exit', key: 'test1:test4', from: 'test1', to: 'test4', children: [{ text: 'test1-test4' }] }
                ] }
            ]},
            { type: 'elseif', source: 'ghi', children: [{ type: 'exit', key: 'test1:test5', from: 'test1', to: 'test5', children: [{ text: 'test1-test5'}] }]},
            { type: 'ifBase', source: 'adf', children: [
                { type: 'exit', key: 'test1:test6', from: 'test1', to: 'test6', children: [{ text: 'test1-test6'}] }
            ]}
        ])).toEqual({
            test1: [
                {
                    tag: 'If',
                    conditions: [{ dependencies: ['adf'], if: 'adf' }],
                    contents: [
                        { tag: 'Exit', contents: [], key: 'test1#test6', from: 'test1', to: 'test6', name: 'test1-test6' }
                    ]
                },
                {
                    tag: 'If',
                    conditions: [{ dependencies: ['def'], if: 'def' }],
                    contents: [
                        { tag: 'Exit', contents: [], key: 'test1#test2', from: 'test1', to: 'test2', name: 'test1-test2' },
                        {
                            tag: 'If',
                            conditions: [{ dependencies: ['abc'], if: 'abc' }],
                            contents: [
                                { tag: 'Exit', contents: [], key: 'test1#test3', from: 'test1', to: 'test3', name: 'test1-test3' }
                            ]
                        },
                        {
                            tag: 'If',
                            conditions: [{ dependencies: ['abc'], if: 'abc', not: true }],
                            contents: [
                                { tag: 'Exit', contents: [], key: 'test1#test4', from: 'test1', to: 'test4', name: 'test1-test4' }
                            ]
                        }
                    ]
                },
                {
                    tag: 'If',
                    conditions: [{ dependencies: ['def'], if: 'def', not: true }, { dependencies: ['ghi'], if: 'ghi' }],
                    contents: [
                        { tag: 'Exit', contents: [], key: 'test1#test5', from: 'test1', to: 'test5', name: 'test1-test5' }
                    ]
                },
            ]
        })
    })
})