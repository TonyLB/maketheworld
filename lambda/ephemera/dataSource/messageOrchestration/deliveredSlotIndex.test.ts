import { DeliveredSlotIndex } from './deliveredSlotIndex'

describe('DeliveredSlotIndex', () => {
    it('find returns undefined for an unrecorded (bundleId, slotId)', () => {
        const index = new DeliveredSlotIndex()
        expect(index.find('bundle-a', 'header')).toBeUndefined()
    })

    it('record then find round-trips targets/messageId', () => {
        const index = new DeliveredSlotIndex()
        index.record('bundle-a', [{ slotId: 'header', targets: ['CHARACTER#viewer'], messageId: 'MESSAGE#1' }])
        expect(index.find('bundle-a', 'header')).toEqual({ targets: ['CHARACTER#viewer'], messageId: 'MESSAGE#1' })
    })

    it('record with no messageId still round-trips (undefined is a legitimate value)', () => {
        const index = new DeliveredSlotIndex()
        index.record('bundle-a', [{ slotId: 'leave', targets: ['ROOM#a'] }])
        expect(index.find('bundle-a', 'leave')).toEqual({ targets: ['ROOM#a'], messageId: undefined })
    })

    it('records for one bundle do not leak into find for a different bundleId', () => {
        const index = new DeliveredSlotIndex()
        index.record('bundle-a', [{ slotId: 'header', targets: ['CHARACTER#one'], messageId: 'MESSAGE#1' }])
        expect(index.find('bundle-b', 'header')).toBeUndefined()
    })

    it('a later record() call for the same bundle adds slots without clobbering previously recorded ones', () => {
        const index = new DeliveredSlotIndex()
        index.record('bundle-a', [{ slotId: 'leave', targets: ['ROOM#a'], messageId: 'MESSAGE#leave' }])
        index.record('bundle-a', [{ slotId: 'arrive', targets: ['ROOM#a'], messageId: 'MESSAGE#arrive' }])
        expect(index.find('bundle-a', 'leave')).toEqual({ targets: ['ROOM#a'], messageId: 'MESSAGE#leave' })
        expect(index.find('bundle-a', 'arrive')).toEqual({ targets: ['ROOM#a'], messageId: 'MESSAGE#arrive' })
    })

    it('clear() empties the index', () => {
        const index = new DeliveredSlotIndex()
        index.record('bundle-a', [{ slotId: 'header', targets: ['CHARACTER#one'], messageId: 'MESSAGE#1' }])
        index.clear()
        expect(index.find('bundle-a', 'header')).toBeUndefined()
    })
})
