import StandardReference, { StandardKey } from '../reference'
import { mapReferenceToFormat } from './references'

describe('mapReferenceToFormat', () => {
    const referenceMapping: StandardKey[] = [
        { key: 'Room1', tag: 'Room' as const, universalKey: 'ROOM#001' as const },
        { key: 'Room2', tag: 'Room' as const, universalKey: 'ROOM#002' as const },
        { key: 'Feature3', tag: 'Feature' as const, universalKey: 'FEATURE#003' as const },
        { key: 'Example4', tag: 'Example' as const, universalKey: 'EXAMPLE#004' as const },
        { key: 'Example5', tag: 'Example' as const, universalKey: 'EXAMPLE#005' as const }
    ].map((props) => (new StandardKey(props)))

    it('should map all types of reference to universal format', () => {
        const references = [
            new StandardReference({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#001' }),
            new StandardReference({ tag: 'Room', key: 'Room2', universalKey: 'ROOM#002' }),
            new StandardReference({ tag: 'Feature', key: 'Feature3', universalKey: 'FEATURE#003' }),
            new StandardReference({ tag: 'Remove', match: { tag: 'Example', key: 'Example4', universalKey: 'EXAMPLE#004' } }),
            new StandardReference({
                tag: 'Replace',
                match: { tag: 'Example', key: 'Example5', universalKey: 'EXAMPLE#005' },
                payload: { tag: 'Room', key: 'Room1', universalKey: 'ROOM#001' }
            })
        ]

        const mappedReferences = references.map(mapReferenceToFormat(referenceMapping, 'universal'))
        expect(mappedReferences.map((reference) => (reference.toJSON()))).toEqual([
            'ROOM#001',
            'ROOM#002',
            'FEATURE#003',
            { tag: 'Remove', match: 'EXAMPLE#004' },
            { tag: 'Replace', match: 'EXAMPLE#005', payload: 'ROOM#001' }
        ]);
    })
})
