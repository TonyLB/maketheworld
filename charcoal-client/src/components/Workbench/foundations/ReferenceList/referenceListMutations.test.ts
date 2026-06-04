import { describe, expect, it } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'

import {
    findReferenceInListById,
    removeReferenceFromListById
} from './referenceListMutations'

describe('referenceListMutations', () => {
    it('removeReferenceFromListById matches via sameKey on universalKey', () => {
        const list = new ReferenceList([
            new StandardReference({ universalKey: 'FEATURE#a', tag: 'Feature' }),
            new StandardReference({ universalKey: 'FEATURE#b', tag: 'Feature' })
        ])
        removeReferenceFromListById(list, 'FEATURE#a')
        expect(list.payload.map((r) => r.universalKey)).toEqual(['FEATURE#b'])
    })

    it('removeReferenceFromListById does not match local key when universalKey differs', () => {
        const list = new ReferenceList([
            new StandardReference({ key: 'tower', universalKey: 'FEATURE#uuid', tag: 'Feature' })
        ])
        removeReferenceFromListById(list, 'FEATURE#other')
        expect(list.payload.length).toBe(1)
    })

    it('findReferenceInListById matches via sameKey when row has local key', () => {
        const list = new ReferenceList([
            new StandardReference({ key: 'tower', universalKey: 'FEATURE#uuid', tag: 'Feature' })
        ])
        const found = findReferenceInListById(list, 'FEATURE#uuid' as ComponentUUID)
        expect(found?.sameKey(list.payload[0])).toBe(true)
    })

    it('findReferenceInListById returns undefined for non-UUID id', () => {
        const list = new ReferenceList([
            new StandardReference({ universalKey: 'FEATURE#a', tag: 'Feature' })
        ])
        expect(findReferenceInListById(list, 'clockTower')).toBeUndefined()
    })

    it('removeReferenceFromListById no-ops when id is not a ComponentUUID', () => {
        const list = new ReferenceList([
            new StandardReference({ universalKey: 'FEATURE#a', tag: 'Feature' })
        ])
        removeReferenceFromListById(list, 'clockTower')
        expect(list.payload.length).toBe(1)
    })
})
