import { describe, it, expect } from 'vitest'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { groupComponentsByType } from './selectors'

describe('contentHeaders selectors', () => {
    describe('groupComponentsByType', () => {
        it('returns an Area group for StandardArea components', () => {
            const area = new StandardArea({
                tag: 'Area',
                universalKey: 'AREA#WORLD',
                key: 'WORLD'
            })
            const groups = groupComponentsByType([area])
            expect(groups).toEqual([{ type: 'Area', components: [area] }])
        })

        it('returns Room and Area groups when both are present', () => {
            const room = new StandardRoom({
                tag: 'Room',
                universalKey: 'ROOM#test',
                key: 'test'
            })
            const area = new StandardArea({
                tag: 'Area',
                universalKey: 'AREA#WORLD',
                key: 'WORLD'
            })
            const groups = groupComponentsByType([room, area])
            expect(groups).toEqual([
                { type: 'Room', components: [room] },
                { type: 'Area', components: [area] }
            ])
        })

        it('filters out empty groups', () => {
            const room = new StandardRoom({
                tag: 'Room',
                universalKey: 'ROOM#test',
                key: 'test'
            })
            const groups = groupComponentsByType([room])
            expect(groups.some((g) => g.type === 'Area')).toBe(false)
        })
    })
})
