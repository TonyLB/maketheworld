import { KeyLookup } from './keyLookup'
import { StandardKey } from './keys/key'
import StandardRoom from './components/room'
import StandardFeature from './components/feature'
import { StandardComponent } from './components/baseClasses'
import { deIndentWML } from '../schema/utils'

describe('KeyLookup', () => {
    describe('lookup with universalKey only (string constructor)', () => {
        it('should find component by universalKey when key is constructed from string', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room uuid=(room1) />`))
            const room2 = new StandardRoom(deIndentWML(`<Room uuid=(room2) />`))
            const components = [room1, room2]
            const lookup = new KeyLookup(components)

            const key = new StandardKey('ROOM#room1')
            const result = lookup.lookup(key)

            expect(result.index).toBe(0)
            expect(result.component).toBe(room1)
            expect(result.component?.universalKey).toBe('ROOM#room1')
        })

        it('should return index -1 when component not found by universalKey', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room uuid=(room1) />`))
            const components = [room1]
            const lookup = new KeyLookup(components)

            const key = new StandardKey('ROOM#nonexistent')
            const result = lookup.lookup(key)

            expect(result.index).toBe(-1)
            expect(result.component).toBeUndefined()
        })
    })

    describe('lookup with key property', () => {
        it('should find component by key when key property is present', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room key=(mainHall) uuid=(room1) />`))
            const room2 = new StandardRoom(deIndentWML(`<Room key=(sideRoom) uuid=(room2) />`))
            const components = [room1, room2]
            const lookup = new KeyLookup(components)

            const key = new StandardKey({ key: 'mainHall' })
            const result = lookup.lookup(key)

            expect(result.index).toBe(0)
            expect(result.component).toBe(room1)
            expect(result.component?.key).toBe('mainHall')
        })

        it('should find component by universalKey when key property is present but matches by universalKey', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room key=(mainHall) uuid=(room1) />`))
            const room2 = new StandardRoom(deIndentWML(`<Room key=(sideRoom) uuid=(room2) />`))
            const components = [room1, room2]
            const lookup = new KeyLookup(components)

            const key = new StandardKey({ key: 'differentKey', universalKey: 'ROOM#room1' })
            const result = lookup.lookup(key)

            expect(result.index).toBe(0)
            expect(result.component).toBe(room1)
            expect(result.component?.universalKey).toBe('ROOM#room1')
        })

        it('should find component by key when both key and universalKey are provided', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room key=(mainHall) uuid=(room1) />`))
            const room2 = new StandardRoom(deIndentWML(`<Room key=(sideRoom) uuid=(room2) />`))
            const components = [room1, room2]
            const lookup = new KeyLookup(components)

            const key = new StandardKey({ key: 'sideRoom', universalKey: 'ROOM#room2' })
            const result = lookup.lookup(key)

            expect(result.index).toBe(1)
            expect(result.component).toBe(room2)
            expect(result.component?.key).toBe('sideRoom')
        })

        it('should return index -1 when component not found by key', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room key=(mainHall) uuid=(room1) />`))
            const components = [room1]
            const lookup = new KeyLookup(components)

            const key = new StandardKey({ key: 'nonexistent' })
            const result = lookup.lookup(key)

            expect(result.index).toBe(-1)
            expect(result.component).toBeUndefined()
        })
    })

    describe('index correctness', () => {
        it('should return correct index for first component', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room key=(room1) uuid=(room1) />`))
            const room2 = new StandardRoom(deIndentWML(`<Room key=(room2) uuid=(room2) />`))
            const room3 = new StandardRoom(deIndentWML(`<Room key=(room3) uuid=(room3) />`))
            const components = [room1, room2, room3]
            const lookup = new KeyLookup(components)

            const key = new StandardKey({ key: 'room1' })
            const result = lookup.lookup(key)

            expect(result.index).toBe(0)
            expect(result.component).toBe(room1)
        })

        it('should return correct index for middle component', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room key=(room1) uuid=(room1) />`))
            const room2 = new StandardRoom(deIndentWML(`<Room key=(room2) uuid=(room2) />`))
            const room3 = new StandardRoom(deIndentWML(`<Room key=(room3) uuid=(room3) />`))
            const components = [room1, room2, room3]
            const lookup = new KeyLookup(components)

            const key = new StandardKey({ key: 'room2' })
            const result = lookup.lookup(key)

            expect(result.index).toBe(1)
            expect(result.component).toBe(room2)
        })

        it('should return correct index for last component', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room key=(room1) uuid=(room1) />`))
            const room2 = new StandardRoom(deIndentWML(`<Room key=(room2) uuid=(room2) />`))
            const room3 = new StandardRoom(deIndentWML(`<Room key=(room3) uuid=(room3) />`))
            const components = [room1, room2, room3]
            const lookup = new KeyLookup(components)

            const key = new StandardKey({ key: 'room3' })
            const result = lookup.lookup(key)

            expect(result.index).toBe(2)
            expect(result.component).toBe(room3)
        })
    })

    describe('mixed component types', () => {
        it('should find different component types correctly', () => {
            const room = new StandardRoom(deIndentWML(`<Room key=(mainHall) uuid=(room1) />`))
            const feature = new StandardFeature(deIndentWML(`<Feature key=(fountain) uuid=(feature1) />`))
            const components = [room, feature]
            const lookup = new KeyLookup(components)

            const roomKey = new StandardKey({ key: 'mainHall' })
            const roomResult = lookup.lookup(roomKey)
            expect(roomResult.index).toBe(0)
            expect(roomResult.component).toBe(room)

            const featureKey = new StandardKey({ key: 'fountain' })
            const featureResult = lookup.lookup(featureKey)
            expect(featureResult.index).toBe(1)
            expect(featureResult.component).toBe(feature)
        })
    })

    describe('empty component list', () => {
        it('should return index -1 for empty component list', () => {
            const components: StandardComponent[] = []
            const lookup = new KeyLookup(components)

            const key = new StandardKey({ key: 'test' })
            const result = lookup.lookup(key)

            expect(result.index).toBe(-1)
            expect(result.component).toBeUndefined()
        })
    })

    describe('edge cases', () => {
        it('should handle components with only key (no universalKey)', () => {
            const roomWithoutUUID = new StandardRoom(deIndentWML(`<Room key=(testRoom) />`))
            const components = [roomWithoutUUID]
            const lookup = new KeyLookup(components)

            const key = new StandardKey({ key: 'testRoom' })
            const result = lookup.lookup(key)

            expect(result.index).toBe(0)
            expect(result.component).toBe(roomWithoutUUID)
        })

        it('should handle lookup key with only universalKey (no key property)', () => {
            const room = new StandardRoom(deIndentWML(`<Room uuid=(room1) />`))
            const components = [room]
            const lookup = new KeyLookup(components)

            const key = new StandardKey({ universalKey: 'ROOM#room1' })
            const result = lookup.lookup(key)

            expect(result.index).toBe(0)
            expect(result.component).toBe(room)
        })
    })
})

