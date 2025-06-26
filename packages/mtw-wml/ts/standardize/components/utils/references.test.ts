import { ComponentUUID } from '@tonylb/mtw-base/ts/schema';
import StandardReference, { StandardKey, StandardReferenceRemove, StandardReferenceReplace, StandardReferenceSimple } from '../reference'
import { assureItemInReferenceList, mapReferenceToFormat } from './references'

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

describe('assureItemInReferenceList', () => {
    it('should add the item to an empty list', () => {
        const previous: StandardReference[] = []
        const item = new StandardReference({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#001' })
        const result = assureItemInReferenceList(previous, item)
        expect(result).toEqual([item])
    })

    it('should add the item to a non-empty list if it does not exist', () => {
        const previous: StandardReference[] = [
            new StandardReference({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#001' })
        ]
        const item = new StandardReference({ tag: 'Room', key: 'Room2', universalKey: 'ROOM#002' })
        const result = assureItemInReferenceList(previous, item)
        expect(result).toEqual([...previous, item])
    })

    it('should not add the item if a plain reference already exists', () => {
        const previous: StandardReference[] = [
            new StandardReference({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#001' })
        ]
        const item = new StandardReference({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#001' })
        const result = assureItemInReferenceList(previous, item)
        expect(result).toEqual(previous)
    })

    it('should not add the item if a remove reference already exists', () => {
        const previous: StandardReference[] = [
            new StandardReference(new StandardReferenceRemove(new StandardKey({ tag: 'Room', key: 'Room1' })))
        ]
        const item = new StandardReference({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#001' })
        const result = assureItemInReferenceList(previous, item)
        expect(result).toEqual(previous)
    })

    it('should not add the item if a replace reference already exists', () => {
        const previous: StandardReference[] = [
            new StandardReference(new StandardReferenceReplace(
                new StandardKey({ tag: 'Room', key: 'Room1', universalKey: 'ROOM#001' }),
                new StandardKey({ tag: 'Room', key: 'Room2', universalKey: 'ROOM#002' })
            ))
        ]
        const item = new StandardReference({ tag: 'Room', key: 'Room2', universalKey: 'ROOM#002' })
        const result = assureItemInReferenceList(previous, item)
        expect(result).toEqual(previous)
    })
})