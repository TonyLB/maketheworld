import { nonRoomHostsAffectedByObjectMoved } from './nonRoomHostsAffectedByObjectMoved'

describe('nonRoomHostsAffectedByObjectMoved', () => {
    it('keeps Object/Feature/Character ids from froms and to', () => {
        const result = nonRoomHostsAffectedByObjectMoved({
            froms: ['OBJECT#table', 'FEATURE#alcove', 'CHARACTER#carrier'],
            to: 'OBJECT#crate',
        })
        expect(result.sort()).toEqual(['CHARACTER#carrier', 'FEATURE#alcove', 'OBJECT#crate', 'OBJECT#table'].sort())
    })

    it('filters out Room and Area ids', () => {
        const result = nonRoomHostsAffectedByObjectMoved({
            froms: ['ROOM#hall', 'AREA#wing'],
            to: 'ROOM#hall',
        })
        expect(result).toEqual([])
    })

    it('dedupes across froms and to', () => {
        const result = nonRoomHostsAffectedByObjectMoved({
            froms: ['OBJECT#table'],
            to: 'OBJECT#table',
        })
        expect(result).toEqual(['OBJECT#table'])
    })

    it('handles a null to', () => {
        const result = nonRoomHostsAffectedByObjectMoved({
            froms: ['OBJECT#table'],
            to: null,
        })
        expect(result).toEqual(['OBJECT#table'])
    })
})
