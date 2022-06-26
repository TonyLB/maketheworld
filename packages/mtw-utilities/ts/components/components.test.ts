import { componentAppearanceReduce } from './components'

describe('component utilities', () => {
    describe('componentAppearanceReduce', () => {
        it('should return empty from empty string', () => {
            expect(componentAppearanceReduce()).toEqual({
                render: [],
                name: "",
                features: [],
                exits: []
            })
        })

        it('should correctly join render strings', () => {
            expect(componentAppearanceReduce({
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
                render: [{ tag: 'String', value: 'Test One' }],
                name: '',
                features: [],
                exits: []
            })
        })

        it('should correctly join link after string', () => {
            expect(componentAppearanceReduce({
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
                render: [
                    { tag: 'String', value: 'Test ' },
                    { tag: 'Link', value: 'One' }
                ],
                name: '',
                features: [],
                exits: []
            })

        })

        it('should correctly join string after link', () => {
            expect(componentAppearanceReduce({
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
                render: [
                    { tag: 'Link', value: 'Test' },
                    { tag: 'String', value: ' One' }
                ],
                name: '',
                features: [],
                exits: []
            })

        })

        it('should correctly join links with space between', () => {
            expect(componentAppearanceReduce({
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
                render: [
                    { tag: 'Link', value: 'Test' },
                    { tag: 'String', value: ' ' },
                    { tag: 'Link', value: 'One' }
                ],
                name: '',
                features: [],
                exits: []
            })

        })

        it('should correctly join items with line breaks', () => {
            expect(componentAppearanceReduce({
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
                render: [
                    { tag: 'Link', value: 'Test' },
                    { tag: 'LineBreak' },
                    { tag: 'Link', value: 'One' }
                ],
                name: '',
                features: [],
                exits: []
            })

        })


        it('should correctly join items without spacing fields', () => {
            expect(componentAppearanceReduce({
                render: [{
                    tag: 'String',
                    value: 'Test ',
                },
                {
                    tag: 'Link',
                    value: 'One',
                }]
            })).toEqual({
                render: [
                    { tag: 'String', value: 'Test ' },
                    { tag: 'Link', value: 'One' }
                ],
                name: '',
                features: [],
                exits: []
            })

        })

    })
})