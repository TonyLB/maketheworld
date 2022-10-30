jest.mock('../internalCache')
import internalCache from "../internalCache"
import { componentAppearanceReduce } from './components'

const cacheMock = jest.mocked(internalCache, true)

describe('component utilities', () => {
    describe('componentAppearanceReduce', () => {
        it('should return empty from empty string', async () => {
            expect(await componentAppearanceReduce()).toEqual({
                Description: [],
                Name: [],
                Exits: []
            })
        })

        it('should correctly join render strings', async () => {
            expect(await componentAppearanceReduce({
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'Test '
                },
                {
                    tag: 'String',
                    value: 'One'
                }]
            })).toEqual({
                Description: [{ tag: 'String', value: 'Test One' }],
                Name: [],
                Exits: []
            })
        })

        it('should correctly join link after string', async () => {
            expect(await componentAppearanceReduce({
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'Test '
                },
                {
                    tag: 'Link',
                    text: 'One',
                    to: 'FEATURE#TestOne'
                }]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'Test ' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly join string after link', async () => {
            expect(await componentAppearanceReduce({
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'Link',
                    text: 'Test',
                    to: 'FEATURE#TestOne'
                },
                {
                    tag: 'String',
                    value: ' One'
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne' },
                    { tag: 'String', value: ' One' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly join links with space between', async () => {
            expect(await componentAppearanceReduce({
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'Link',
                    text: 'Test',
                    to: 'FEATURE#TestOne'
                },
                {
                    tag: 'String',
                    value: ' '
                },
                {
                    tag: 'Link',
                    text: 'One',
                    to: 'FEATURE#TestOne'
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne' },
                    { tag: 'String', value: ' ' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly join items with line breaks', async () => {
            expect(await componentAppearanceReduce({
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'Link',
                    text: 'Test',
                    to: 'FEATURE#TestOne'
                },
                {
                    tag: 'LineBreak'
                },
                {
                    tag: 'Link',
                    text: 'One',
                    to: 'FEATURE#TestOne'
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne' },
                    { tag: 'LineBreak' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly join items without spacing fields', async () => {
            expect(await componentAppearanceReduce({
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'Test ',
                },
                {
                    tag: 'Link',
                    text: 'One',
                    to: 'FEATURE#TestOne'
                }]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'Test ' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly evaluate conditionals', async () => {
            cacheMock.EvaluateCode.get.mockImplementation(async ({ source }) => {
                switch(source) {
                    case 'checkOne': return true
                    case 'checkTwo': return false
                }
            })
            expect(await componentAppearanceReduce({
                conditions: [],
                name: [],
                exits: [],
                render: [
                    { tag: 'String', value: 'Show this, ' },
                    {
                        tag: 'Conditional',
                        if: 'checkOne',
                        dependencies: { checkOne: 'VARIABLE#Test' },
                        contents: [
                            { tag: 'String', value: 'and this, ' },
                            {
                                tag: 'Conditional',
                                if: 'checkOne',
                                dependencies: { checkOne: 'VARIABLE#Test' },
                                contents: [
                                    { tag: 'String', value: `and also this` },
                                ]
                            },
                            {
                                tag: 'Conditional',
                                if: 'checkTwo',
                                dependencies: { checkTwo: 'VARIABLE#Test' },
                                contents: [
                                    { tag: 'String', value: `but not this` },
                                ]
                            }
                        ]
                    },
                    {
                        tag: 'Conditional',
                        if: 'checkTwo',
                        dependencies: { checkTwo: 'VARIABLE#Test' },
                        contents: [
                            { tag: 'String', value: `and not this` },
                        ]
                    },
                    { tag: 'String', value: '.' }
                ]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'Show this, and this, and also this.' }
                ],
                Name: [],
                Exits: []
            })
        })

    })
})