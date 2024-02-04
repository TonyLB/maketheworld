import { explicitSpaces } from './explicitSpaces'

describe('explicitSpaces utility', () => {
    it('should return unchanged when no space at start or end of tree', () => {
        expect(explicitSpaces([
            { data: { tag: 'String', value: 'Test One ' }, children: [] },
            { data: { tag: 'Link', to: 'testLink', text: 'TestLink' }, children: [] },
            { data: { tag: 'String', value: ' Test Two' }, children: [] }
        ])).toEqual([
            { data: { tag: 'String', value: 'Test One ' }, children: [] },
            { data: { tag: 'Link', to: 'testLink', text: 'TestLink' }, children: [] },
            { data: { tag: 'String', value: ' Test Two' }, children: [] }
        ])
    })

    it('should return make space at start of tree explicit', () => {
        expect(explicitSpaces([
            { data: { tag: 'String', value: ' Test One ' }, children: [] },
            { data: { tag: 'Link', to: 'testLink', text: 'TestLink' }, children: [] },
            { data: { tag: 'String', value: ' Test Two' }, children: [] }
        ])).toEqual([
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'String', value: 'Test One ' }, children: [] },
            { data: { tag: 'Link', to: 'testLink', text: 'TestLink' }, children: [] },
            { data: { tag: 'String', value: ' Test Two' }, children: [] }
        ])
    })

    it('should return make space at end of tree explicit', () => {
        expect(explicitSpaces([
            { data: { tag: 'String', value: 'Test One ' }, children: [] },
            { data: { tag: 'Link', to: 'testLink', text: 'TestLink' }, children: [] },
            { data: { tag: 'String', value: ' Test Two ' }, children: [] }
        ])).toEqual([
            { data: { tag: 'String', value: 'Test One ' }, children: [] },
            { data: { tag: 'Link', to: 'testLink', text: 'TestLink' }, children: [] },
            { data: { tag: 'String', value: ' Test Two' }, children: [] },
            { data: { tag: 'Space' }, children: [] }
        ])
    })

})