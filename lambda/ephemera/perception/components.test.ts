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
                    text: 'One',
                    to: 'FEATURE#TestOne',
                    targetTag: 'Feature',
                    spaceBefore: true
                }]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'Test ' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne', targetTag: 'Feature' }
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
                    text: 'Test',
                    to: 'FEATURE#TestOne',
                    targetTag: 'Feature',
                    spaceAfter: true
                },
                {
                    tag: 'String',
                    value: 'One',
                    spaceBefore: true
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne', targetTag: 'Feature' },
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
                    text: 'Test',
                    to: 'FEATURE#TestOne',
                    targetTag: 'Feature',
                    spaceAfter: true
                },
                {
                    tag: 'Link',
                    text: 'One',
                    to: 'FEATURE#TestOne',
                    targetTag: 'Feature',
                    spaceBefore: true
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne', targetTag: 'Feature' },
                    { tag: 'String', value: ' ' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne', targetTag: 'Feature' }
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
                    text: 'Test',
                    to: 'FEATURE#TestOne',
                    targetTag: 'Feature',
                    spaceAfter: true
                },
                {
                    tag: 'LineBreak'
                },
                {
                    tag: 'Link',
                    text: 'One',
                    to: 'FEATURE#TestOne',
                    targetTag: 'Feature',
                    spaceBefore: true
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne', targetTag: 'Feature' },
                    { tag: 'LineBreak' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne', targetTag: 'Feature' }
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
                    text: 'One',
                    to: 'FEATURE#TestOne',
                    targetTag: 'Feature'
                }]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'Test ' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne', targetTag: 'Feature' }
                ],
                Name: '',
                Exits: []
            })

        })

    })
})