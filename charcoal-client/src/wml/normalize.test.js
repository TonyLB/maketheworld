import normalize, { NormalizeTagMismatchError } from './normalize.js'

describe('WML normalize', () => {
    it('should return empty map on empty schema', () => {
        expect(normalize({})).toEqual({})
    })

    it('should normalize nested elements', () => {
        expect(normalize({
            tag: 'Asset',
            key: 'Test',
            contents: [{
                tag: 'Room',
                key: '123',
                name: 'Vortex',
                contents: [{
                    tag: 'Exit',
                    to: '456'
                },
                {
                    tag: 'Exit',
                    from: '456'
                }]
            },
            {
                tag: 'Room',
                key: '456',
                name: 'Welcome',
            }]
        })).toEqual({
            Test: {
                key: 'Test',
                tag: 'Asset',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        key: '123',
                        index: 0
                    },
                    {
                        key: '456',
                        index: 0
                    }]
                }]
            },
            '123': {
                key: '123',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', index: 0 }],
                    name: 'Vortex',
                    contents: [
                        { key: '123#456', index: 0 },
                        { key: '456#123', index: 0 }
                    ]
                }]
            },
            '123#456': {
                key: '123#456',
                tag: 'Exit',
                appearances: [{
                    contextStack: [{ key: 'Test', index: 0 }, { key: '123', index: 0 }],
                    to: '456',
                    from: '123',
                    contents: []
                }]
            },
            '456#123': {
                key: '456#123',
                tag: 'Exit',
                appearances: [{
                    contextStack: [{ key: 'Test', index: 0 }, { key: '123', index: 0 }],
                    to: '123',
                    from: '456',
                    contents: []
                }]
            },
            '456': {
                key: '456',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', index: 0 }],
                    name: 'Welcome',
                    contents: []
                }]
            }
        })
    })

    it('should accumulate multiple appearances of the same key', () => {
        expect(normalize({
            tag: 'Asset',
            key: 'Test',
            contents: [{
                tag: 'Room',
                key: '123',
                name: 'Vortex',
                render: ['Hello, world!']
            },
            {
                tag: 'Condition',
                if: 'true',
                contents: [{
                    tag: 'Room',
                    key: '123',
                    render: ['Vortex!']
                }]
            }]
        })).toEqual({
            Test: {
                key: 'Test',
                tag: 'Asset',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        key: '123',
                        index: 0
                    },
                    {
                        key: 'Condition-0',
                        index: 0
                    }]
                }]
            },
            '123': {
                key: '123',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', index: 0 }],
                    name: 'Vortex',
                    render: ['Hello, world!'],
                    contents: []
                },
                {
                    contextStack: [{ key: 'Test', index: 0 }, { key: 'Condition-0', index: 0 }],
                    render: ['Vortex!'],
                    contents: []
                }]
            },
            'Condition-0': {
                key: 'Condition-0',
                tag: 'Condition',
                appearances: [{
                    contextStack: [{ key: 'Test', index: 0 }],
                    if: 'true',
                    contents: [{
                        key: '123',
                        index: 1
                    }]
                }]
            }
        })
    })

    it('should throw an error on mismatched key use', () => {
        expect(() => {
            normalize({
                tag: 'Asset',
                key: 'Test',
                contents: [{
                    tag: 'Room',
                    key: 'ABC',
                    name: 'Vortex',
                    render: ['Hello, world!']
                },
                {
                    tag: 'Variable',
                    key: 'ABC',
                    default: 'true'
                }]
            })
        }).toThrowError(new NormalizeTagMismatchError(`Key 'ABC' is used to define elements of different tags ('Room' and 'Variable')`))
    })
})