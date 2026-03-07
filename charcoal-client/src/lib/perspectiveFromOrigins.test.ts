import { describe, it, expect } from 'vitest'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { derivePerspectiveForRoom } from './perspectiveFromOrigins'

describe('derivePerspectiveForRoom', () => {
    it('returns null when room is not in the form', () => {
        const form = new StandardForm({
            universalKey: 'ASSET#test',
            components: [],
            metaData: []
        })
        expect(derivePerspectiveForRoom(form, 'ROOM#nonexistent', 'ASSET#test')).toBeNull()
    })

    it('returns null when room has no origins and no situations', () => {
        const form = new StandardForm({
            universalKey: 'ASSET#test',
            components: [
                {
                    tag: 'Room',
                    key: 'r1',
                    universalKey: 'ROOM#room1'
                }
            ],
            metaData: []
        })
        expect(derivePerspectiveForRoom(form, 'ROOM#room1', 'ASSET#test')).toBeNull()
    })

    it('returns perspective with merged stack when room has origin', () => {
        const form = new StandardForm({
            universalKey: 'ASSET#current',
            components: [
                {
                    tag: 'Room',
                    key: 'r1',
                    universalKey: 'ROOM#room1',
                    origin: ['ASSET#base', 'ASSET#mid']
                }
            ],
            metaData: []
        })
        const result = derivePerspectiveForRoom(form, 'ROOM#room1', 'ASSET#current')
        expect(result).not.toBeNull()
        expect(result!.assetStack).toEqual(['ASSET#base', 'ASSET#mid', 'ASSET#current'])
    })

    it('does not duplicate currentAssetId when already in chain', () => {
        const form = new StandardForm({
            universalKey: 'ASSET#current',
            components: [
                {
                    tag: 'Room',
                    key: 'r1',
                    universalKey: 'ROOM#room1',
                    origin: ['ASSET#base', 'ASSET#current']
                }
            ],
            metaData: []
        })
        const result = derivePerspectiveForRoom(form, 'ROOM#room1', 'ASSET#current')
        expect(result).not.toBeNull()
        expect(result!.assetStack).toEqual(['ASSET#base', 'ASSET#current'])
    })
})
