import { ComponentUUID } from '@tonylb/mtw-base/ts/schema';
import StandardReference, { StandardReferenceRemove, StandardReferenceReplace, StandardReferenceSimple } from '../reference'
import { mapReferenceToFormat } from './references'

describe('mapReferenceToFormat', () => {
    const referenceMapping: { key: string; universalKey: ComponentUUID }[] = [
        { key: 'Room1', universalKey: 'ROOM#001' },
        { key: 'Room2', universalKey: 'ROOM#002' },
        { key: 'Feature3', universalKey: 'FEATURE#003' },
        { key: 'Example4', universalKey: 'EXAMPLE#004' },
        { key: 'Example5', universalKey: 'EXAMPLE#005' }
    ]

    it('should map all types of reference to universal format', () => {
        const references = [
            new StandardReference({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#001' }),
            new StandardReference({ tag: 'Room', key: 'Room2' }),
            new StandardReference({ tag: 'Feature', universalKey: 'FEATURE#003' }),
            new StandardReference({ tag: 'Remove', match: { tag: 'Example', key: 'Example4' } }),
            new StandardReference({ tag: 'Replace', match: { tag: 'Example', key: 'Example5' }, payload: { tag: 'Room', key: 'Room1' } })
        ]
        // console.log(`reference payloads: ${
        //     references.map(reference => (
        //         reference._payload instanceof StandardReferenceSimple
        //             ? 'Simple'
        //             : reference._payload instanceof StandardReferenceRemove
        //                 ? 'Remove'
        //                 : reference._payload instanceof StandardReferenceReplace
        //                     ? 'Replace' : 'Unknown'
        //         )
        //     )
        // }`)

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