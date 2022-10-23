import { componentAppearanceReduce } from './components'

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

    })
})