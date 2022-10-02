import { componentAppearanceReduce } from './components'

describe('component utilities', () => {
    describe('componentAppearanceReduce', () => {
        it('should return empty from empty string', () => {
            expect(componentAppearanceReduce()).toEqual({
                Description: [],
                Name: "",
                Exits: []
            })
        })

        it('should correctly join render strings', () => {
            expect(componentAppearanceReduce({
                conditions: [],
                name: '',
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'Test',
                    spaceAfter: true
                },
                {
                    tag: 'String',
                    value: 'One',
                    spaceBefore: true
                }]
            })).toEqual({
                Description: [{ tag: 'String', value: 'Test One' }],
                Name: '',
                Exits: []
            })
        })

        it('should correctly join link after string', () => {
            expect(componentAppearanceReduce({
                conditions: [],
                name: '',
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'Test',
                    spaceAfter: true
                },
                {
                    tag: 'Link',
                    value: 'One',
                    spaceBefore: true
                }]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'Test ' },
                    { tag: 'Link', value: 'One' }
                ],
                Name: '',
                Exits: []
            })

        })

        it('should correctly join string after link', () => {
            expect(componentAppearanceReduce({
                conditions: [],
                name: '',
                exits: [],
                render: [{
                    tag: 'Link',
                    value: 'Test',
                    spaceAfter: true
                },
                {
                    tag: 'String',
                    value: 'One',
                    spaceBefore: true
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', value: 'Test' },
                    { tag: 'String', value: ' One' }
                ],
                Name: '',
                Exits: []
            })

        })

        it('should correctly join links with space between', () => {
            expect(componentAppearanceReduce({
                conditions: [],
                name: '',
                exits: [],
                render: [{
                    tag: 'Link',
                    value: 'Test',
                    spaceAfter: true
                },
                {
                    tag: 'Link',
                    value: 'One',
                    spaceBefore: true
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', value: 'Test' },
                    { tag: 'String', value: ' ' },
                    { tag: 'Link', value: 'One' }
                ],
                Name: '',
                Exits: []
            })

        })

        it('should correctly join items with line breaks', () => {
            expect(componentAppearanceReduce({
                conditions: [],
                name: '',
                exits: [],
                render: [{
                    tag: 'Link',
                    value: 'Test',
                    spaceAfter: true
                },
                {
                    tag: 'LineBreak'
                },
                {
                    tag: 'Link',
                    value: 'One',
                    spaceBefore: true
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', value: 'Test' },
                    { tag: 'LineBreak' },
                    { tag: 'Link', value: 'One' }
                ],
                Name: '',
                Exits: []
            })

        })


        it('should correctly join items without spacing fields', () => {
            expect(componentAppearanceReduce({
                conditions: [],
                name: '',
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'Test ',
                },
                {
                    tag: 'Link',
                    value: 'One',
                }]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'Test ' },
                    { tag: 'Link', value: 'One' }
                ],
                Name: '',
                Exits: []
            })

        })

    })
})