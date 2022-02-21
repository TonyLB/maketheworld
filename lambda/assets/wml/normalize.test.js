import normalize, {
    NormalizeTagMismatchError,
    transformNode,
    clearGeneratedKeys,
    addElement
} from './normalize.js'

describe('WML normalize', () => {

    beforeEach(() => {
        clearGeneratedKeys()
    })
    describe('transformNode', () => {
        it('should pass room key unchanged', () => {
            expect(transformNode(
                [{ key: 'Test', tag: 'Asset', index: 0 }],
                {
                    key: 'ABC',
                    tag: 'Room',
                    name: 'Vortex',
                    contents: []
                }
            )).toEqual({
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                node: {
                    key: 'ABC',
                    tag: 'Room',
                    name: 'Vortex',
                    contents: []
                }
            })
        })

        it('should synthesize a key for condition tag', () => {
            expect(transformNode(
                [{ key: 'Test', tag: 'Asset', index: 0 }],
                {
                    tag: 'Condition',
                    if: 'true',
                    contents: []
                }
            )).toEqual({
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                node: {
                    key: 'Condition-0',
                    tag: 'Condition',
                    if: 'true',
                    contents: []
                }
            })
        })

        it('should pass a global exit in a room wrapper, with synthetic key', () => {
            expect(transformNode(
                [{ key: 'Test', tag: 'Asset', index: 0 }],
                {
                    tag: 'Exit',
                    to: 'ABC',
                    from: 'DEF',
                    contents: []
                }
            )).toEqual({
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'DEF', tag: 'Room' }],
                node: {
                    key: 'DEF#ABC',
                    tag: 'Exit',
                    to: 'ABC',
                    from: 'DEF',
                    contents: []
                }
            })
        })

        it('should pass a local from exit at same level, with synthetic key', () => {
            expect(transformNode(
                [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'ABC', tag: 'Room', index: 0 }],
                {
                    tag: 'Exit',
                    to: 'DEF',
                    contents: []
                }
            )).toEqual({
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'ABC', tag: 'Room', index: 0 }],
                node: {
                    key: 'ABC#DEF',
                    tag: 'Exit',
                    to: 'DEF',
                    from: 'ABC',
                    contents: []
                }
            })
            expect(transformNode(
                [
                    { key: 'Test', tag: 'Asset', index: 0 },
                    { key: 'ABC', tag: 'Room', index: 0 },
                    { key: 'Condition-0', tag: 'Condition', index: 0 }
                ],
                {
                    tag: 'Exit',
                    to: 'DEF',
                    contents: []
                }
            )).toEqual({
                contextStack: [
                    { key: 'Test', tag: 'Asset', index: 0 },
                    { key: 'ABC', tag: 'Room', index: 0 },
                    { key: 'Condition-0', tag: 'Condition', index: 0 }
                ],
                node: {
                    key: 'ABC#DEF',
                    tag: 'Exit',
                    to: 'DEF',
                    from: 'ABC',
                    contents: []
                }
            })
        })

        it('should pass a local to exit in a sibling room wrapper, with synthetic key', () => {
            expect(transformNode(
                [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'ABC', tag: 'Room', index: 0 }],
                {
                    tag: 'Exit',
                    from: 'DEF',
                    contents: []
                }
            )).toEqual({
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'DEF', tag: 'Room' }],
                node: {
                    key: 'DEF#ABC',
                    tag: 'Exit',
                    from: 'DEF',
                    to: 'ABC',
                    contents: []
                }
            })
            expect(transformNode(
                [
                    { key: 'Test', tag: 'Asset', index: 0 },
                    { key: 'ABC', tag: 'Room', index: 0 },
                    { key: 'Condition-0', tag: 'Condition', index: 0 }
                ],
                {
                    tag: 'Exit',
                    from: 'DEF',
                    contents: []
                }
            )).toEqual({
                contextStack: [
                    { key: 'Test', tag: 'Asset', index: 0 },
                    { key: 'DEF', tag: 'Room' },
                    { key: 'Condition-0', tag: 'Condition' }
                ],
                node: {
                    key: 'DEF#ABC',
                    tag: 'Exit',
                    from: 'DEF',
                    to: 'ABC',
                    contents: []
                }
            })
        })

    })

    describe('addElement', () => {
        const testMap = {
            Test: {
                key: 'Test',
                tag: 'Asset',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        tag: 'Room',
                        key: 'ABC',
                        index: 0
                    },
                    {
                        tag: 'Condition',
                        key: 'Condition-0',
                        index: 0
                    }],
                }]
            },
            ABC: {
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: 'Vortex',
                    contents: [{
                        tag: 'Exit',
                        key: 'ABC#DEF',
                        index: 0
                    }]
                }]
            },
            'ABC#DEF': {
                key: 'ABC#DEF',
                tag: 'Exit',
                appearances: [{
                    contextStack: [{
                        key: 'Test',
                        tag: 'Asset',
                        index: 0
                    },
                    {
                        key: 'ABC',
                        tag: 'Room',
                        index: 0
                    }]
                }]
            },
            'Condition-0': {
                key: 'Condition-0',
                tag: 'Condition',
                if: 'true',
                appearances: [{
                    contextStack: [{
                        key: 'Test',
                        tag: 'Asset',
                        index: 0
                    }],
                    contents: []
                }]
            }
        }

        it('should add an element with matching contextStack', () => {
            expect(addElement(testMap, {
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                node: {
                    key: 'ABC',
                    tag: 'Room',
                    render: ['Vortex!'],
                    contents: []
                }
            })).toEqual({
                ...testMap,
                ABC: {
                    key: 'ABC',
                    tag: 'Room',
                    appearances: [{
                        contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                        name: 'Vortex',
                        render: ['Vortex!'],
                        contents: [{
                            tag: 'Exit',
                            key: 'ABC#DEF',
                            index: 0
                        }]
                    }]    
                }
            })
        })

        it('should add an element with differing contextStack', () => {
            expect(addElement(testMap, {
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                node: {
                    key: 'ABC',
                    tag: 'Room',
                    render: ['Vortex!'],
                    contents: []
                }
            })).toEqual({
                ...testMap,
                ABC: {
                    key: 'ABC',
                    tag: 'Room',
                    appearances: [{
                        contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                        name: 'Vortex',
                        contents: [{
                            tag: 'Exit',
                            key: 'ABC#DEF',
                            index: 0
                        }]
                    },
                    {
                        contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                        render: ['Vortex!'],
                        contents: []
                    }]
                },
                'Condition-0': {
                    key: 'Condition-0',
                    tag: 'Condition',
                    if: 'true',
                    appearances: [{
                        contextStack: [{
                            key: 'Test',
                            tag: 'Asset',
                            index: 0
                        }],
                        contents: [{ key: 'ABC', tag: 'Room', index: 1 }]
                    }]    
                }
            })
        })

        it('should add an element with unspecified indices in the context-stack', () => {
            expect(addElement(testMap, {
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition' }, { key: 'DEF', tag: 'Room' }],
                node: {
                    key: 'DEF#ABC',
                    tag: 'Exit',
                    to: 'ABC',
                    from: 'DEF',
                    contents: []
                }
            })).toEqual({
                ...testMap,
                DEF: {
                    key: 'DEF',
                    tag: 'Room',
                    appearances: [{
                        contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                        contents: [{
                            tag: 'Exit',
                            key: 'DEF#ABC',
                            index: 0
                        }]
                    }]
                },
                'DEF#ABC': {
                    key: 'DEF#ABC',
                    tag: 'Exit',
                    to: 'ABC',
                    from: 'DEF',
                    appearances: [{
                        contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }, { key: 'DEF', tag: 'Room', index: 0 }],
                        contents: []
                    }]                    
                },
                'Condition-0': {
                    key: 'Condition-0',
                    tag: 'Condition',
                    if: 'true',
                    appearances: [{
                        contextStack: [{
                            key: 'Test',
                            tag: 'Asset',
                            index: 0
                        }],
                        contents: [{ key: 'DEF', tag: 'Room', index: 0 }]
                    }]    
                }
            })
        })
    })

    it('should return empty map on empty schema', () => {
        expect(normalize({})).toEqual({})
    })

    it('should normalize every needed tag', () => {
        expect(normalize({
            tag: 'Asset',
            key: 'Test',
            contents: [{
                tag: 'Import',
                from: 'BASE',
                mapping: {
                    power: 'basePower',
                    overview: "overview"
                },
                contents: [],
                props: {}
            },
            {
                tag: 'Room',
                key: '123',
                name: 'Vortex',
                contents: [{
                    tag: 'Exit',
                    from: '456'
                }]
            },
            {
                tag: 'Variable',
                key: 'active',
                default: 'true'
            },
            {
                tag: 'Computed',
                key: 'inactive',
                src: '!active',
                dependencies: ['active']
            },
            {
                tag: 'Action',
                key: 'toggleActive',
                src: 'active = !active'
            }]
        })).toEqual({
            Test: {
                key: 'Test',
                tag: 'Asset',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        key: 'Import-0',
                        tag: 'Import',
                        index: 0
                    },
                    {
                        key: '123',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: '456',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'active',
                        tag: 'Variable',
                        index: 0
                    },
                    {
                        key: 'inactive',
                        tag: 'Computed',
                        index: 0
                    },
                    {
                        key: 'toggleActive',
                        tag: 'Action',
                        index: 0
                    }]
                }]
            },
            'Import-0': {
                key: 'Import-0',
                tag: 'Import',
                from: 'BASE',
                mapping: {
                    power: 'basePower',
                    overview: 'overview'
                },
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    contents: [],
                    props: {}
                }]
            },
            '123': {
                key: '123',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: 'Vortex',
                    contents: []
                }]
            },
            '456#123': {
                key: '456#123',
                tag: 'Exit',
                to: '123',
                from: '456',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: '456', tag: 'Room', index: 0 }],
                    contents: []
                }]
            },
            '456': {
                key: '456',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    contents: [{ key: '456#123', tag: 'Exit', index: 0 }]
                }]
            },
            active: {
                key: 'active',
                tag: 'Variable',
                default: 'true',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    contents: []
                }]
            },
            inactive: {
                key: 'inactive',
                tag: 'Computed',
                src: '!active',
                dependencies: ['active'],
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    contents: []
                }]
            },
            toggleActive: {
                key: 'toggleActive',
                tag: 'Action',
                src: 'active = !active',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    contents: []
                }]
            },
        })
    })
    
    it('should create wrapping elements for exits where needed', () => {
        expect(normalize({
            tag: 'Asset',
            key: 'Test',
            contents: [{
                tag: 'Room',
                key: '123',
                name: 'Vortex',
                contents: [{
                    tag: 'Exit',
                    from: '456'
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
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: '456',
                        tag: 'Room',
                        index: 0
                    }]
                }]
            },
            '123': {
                key: '123',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: 'Vortex',
                    contents: []
                }]
            },
            '456#123': {
                key: '456#123',
                tag: 'Exit',
                to: '123',
                from: '456',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: '456', tag: 'Room', index: 0 }],
                    contents: []
                }]
            },
            '456': {
                key: '456',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    contents: [{ key: '456#123', tag: 'Exit', index: 0 }]
                }]
            }
        })
    })

    it('should normalize exits into their parent room where needed', () => {
        expect(normalize({
            tag: 'Asset',
            key: 'Test',
            contents: [{
                tag: 'Room',
                key: '123',
                name: 'Vortex',
                contents: [{
                    tag: 'Exit',
                    to: '456',
                    from: '123'
                }]
            },
            {
                tag: 'Exit',
                from: '456',
                to: '123'
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
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: '456',
                        tag: 'Room',
                        index: 0
                    }]
                }]
            },
            '123': {
                key: '123',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: 'Vortex',
                    contents: [
                        { key: '123#456', tag: 'Exit', index: 0 }
                    ]
                }]
            },
            '123#456': {
                key: '123#456',
                tag: 'Exit',
                to: '456',
                from: '123',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: '123', tag: 'Room', index: 0 }],
                    contents: []
                }]
            },
            '456': {
                key: '456',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: 'Welcome',
                    contents: [
                        { key: '456#123', tag: 'Exit', index: 0 }
                    ]
                }]
            },
            '456#123': {
                key: '456#123',
                tag:'Exit',
                to: '123',
                from: '456',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0}, { key: '456', tag: 'Room', index: 0 }],
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
            },
            {
                tag: 'Room',
                key: '123',
                render: ['Hello, world!']
            },
            {
                tag: 'Condition',
                if: 'true',
                dependencies: [],
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
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'Condition-0',
                        tag: 'Condition',
                        index: 0
                    }]
                }]
            },
            '123': {
                key: '123',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: 'Vortex',
                    render: ['Hello, world!'],
                    contents: []
                },
                {
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                    render: ['Vortex!'],
                    contents: []
                }]
            },
            'Condition-0': {
                key: 'Condition-0',
                tag: 'Condition',
                if: 'true',
                dependencies: [],
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    contents: [{
                        key: '123',
                        tag: 'Room',
                        index: 1
                    }]
                }]
            }
        })
    })

    it('should denormalize condition dependencies into contextStack', () => {
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
                if: 'strong',
                dependencies: ['strong'],
                contents: [{
                    tag: 'Room',
                    key: '123',
                    render: ['Vortex!']
                }]
            },
            {
                tag: 'Variable',
                key: 'strong',
                default: 'false'
            }]
        })).toEqual({
            Test: {
                key: 'Test',
                tag: 'Asset',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        key: '123',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'Condition-0',
                        tag: 'Condition',
                        index: 0
                    },
                    {
                        key: 'strong',
                        tag: 'Variable',
                        index: 0
                    }]
                }]
            },
            '123': {
                key: '123',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: 'Vortex',
                    render: ['Hello, world!'],
                    contents: []
                },
                {
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                    render: ['Vortex!'],
                    contents: []
                }]
            },
            'Condition-0': {
                key: 'Condition-0',
                tag: 'Condition',
                if: 'strong',
                dependencies: ['strong'],
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    contents: [{
                        key: '123',
                        tag: 'Room',
                        index: 1
                    }]
                }]
            },
            strong: {
                key: 'strong',
                tag: 'Variable',
                default: 'false',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    contents: []
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