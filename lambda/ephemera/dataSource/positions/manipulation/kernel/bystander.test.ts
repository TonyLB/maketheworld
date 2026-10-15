import { isBystanderMove } from './bystander'

describe('isBystanderMove', () => {
    it('is a character at a Room', () => {
        expect(isBystanderMove('CHARACTER#Alpha' as any, 'ROOM#Cafe' as any)).toBe(true)
    })

    it('is not an object at a room, or a character anywhere else', () => {
        expect(isBystanderMove('OBJECT#Tray' as any, 'ROOM#Cafe' as any)).toBe(false)
        expect(isBystanderMove('CHARACTER#Alpha' as any, 'OBJECT#Tray' as any)).toBe(false)
        expect(isBystanderMove('CHARACTER#Alpha' as any, 'FEATURE#Sign' as any)).toBe(false)
    })
})
