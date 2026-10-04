import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { enumerateIdentityAssignments } from './enumerateIdentityAssignments'
import type { ObjectSpanCandidate } from './spanResolution'

const candidate = (id: string, jointRelevance: number): ObjectSpanCandidate => ({
    id: `OBJECT#${id}` as EphemeraObjectId,
    label: id.toLowerCase(),
    jointRelevance,
    sourceTags: ['lexical'],
    locus: { kind: 'room' },
})

const idsOf = (identities: ReadonlyMap<string, { objectId: EphemeraObjectId }>) =>
    Object.fromEntries([...identities].map(([key, identity]) => [key, identity.objectId]))

describe('enumerateIdentityAssignments', () => {
    it('keeps a single pool in order, each with its own confidence', () => {
        const assignments = enumerateIdentityAssignments(new Map([
            ['primaryObject', [candidate('Bag', 0.7), candidate('Satchel', 0.65)]],
        ]))
        expect(assignments.map(({ identities, confidence }) => [idsOf(identities), confidence])).toEqual([
            [{ primaryObject: 'OBJECT#Bag' }, 0.7],
            [{ primaryObject: 'OBJECT#Satchel' }, 0.65],
        ])
    })

    it('forms the full product, first key outermost, with min confidence', () => {
        const assignments = enumerateIdentityAssignments(new Map([
            ['subject', [candidate('Cup', 0.9), candidate('Mug', 0.6)]],
            ['target', [candidate('Table', 0.8), candidate('Desk', 0.5)]],
        ]))
        expect(assignments.map(({ identities, confidence }) => [idsOf(identities), confidence])).toEqual([
            [{ subject: 'OBJECT#Cup', target: 'OBJECT#Table' }, 0.8],
            [{ subject: 'OBJECT#Cup', target: 'OBJECT#Desk' }, 0.5],
            [{ subject: 'OBJECT#Mug', target: 'OBJECT#Table' }, 0.6],
            [{ subject: 'OBJECT#Mug', target: 'OBJECT#Desk' }, 0.5],
        ])
    })

    it('yields nothing when any pool is empty', () => {
        expect(enumerateIdentityAssignments(new Map([
            ['subject', [candidate('Cup', 0.9)]],
            ['target', []],
        ]))).toEqual([])
    })

    it('yields nothing when there are no pools', () => {
        expect(enumerateIdentityAssignments(new Map())).toEqual([])
    })
})
