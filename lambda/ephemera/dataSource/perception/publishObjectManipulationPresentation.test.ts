import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    buildDropWorldMessage,
    buildTakeHoldWorldMessage,
    publishObjectManipulationPresentation,
} from './publishObjectManipulationPresentation'
import type { ObjectManipulationEmissionPlan } from './objectManipulationPresentationFanIn'

const CHARACTER_ID = 'CHARACTER#Alice' as EphemeraCharacterId
const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const ANCHOR = 1_700_000_000_000

const basePlan = (overrides: Partial<ObjectManipulationEmissionPlan> = {}): ObjectManipulationEmissionPlan => ({
    operation: 'takeHold',
    characterId: CHARACTER_ID,
    objectId: OBJECT_ID,
    roomId: ROOM_ID,
    beatAnchorTime: ANCHOR,
    characterName: 'Alice',
    objectShortName: 'broom',
    carriedObjectCount: 1,
    ...overrides,
})

describe('publishObjectManipulationPresentation', () => {
    it('builds take-hold world message copy', () => {
        expect(buildTakeHoldWorldMessage(basePlan())).toBe('Alice picks up broom')
    })

    it('builds drop world message copy', () => {
        expect(buildDropWorldMessage(basePlan({ operation: 'drop' }))).toBe('Alice drops broom')
    })

    it('publishes single take-hold WorldMessage with Model A createdTime', () => {
        const messageBus = { publish: jest.fn() }

        publishObjectManipulationPresentation(messageBus as any, basePlan())

        expect(messageBus.publish).toHaveBeenCalledTimes(1)
        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: [ROOM_ID, CHARACTER_ID],
            displayProtocol: 'WorldMessage',
            message: ['Alice picks up broom'],
            createdTime: ANCHOR,
            deliveryMode: 'deferred',
        })
    })

    it('publishes single drop WorldMessage with Model A createdTime', () => {
        const messageBus = { publish: jest.fn() }

        publishObjectManipulationPresentation(messageBus as any, basePlan({ operation: 'drop' }))

        expect(messageBus.publish).toHaveBeenCalledTimes(1)
        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: [ROOM_ID, CHARACTER_ID],
            displayProtocol: 'WorldMessage',
            message: ['Alice drops broom'],
            createdTime: ANCHOR,
            deliveryMode: 'deferred',
        })
    })

    it('uses fallback display names in copy', () => {
        const messageBus = { publish: jest.fn() }

        publishObjectManipulationPresentation(messageBus as any, basePlan({
            characterName: 'Someone',
            objectShortName: 'something',
        }))

        expect(messageBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            message: ['Someone picks up something'],
        }))
    })

    it('appends "and everything on it" to take-hold copy for a carry (BD-13)', () => {
        expect(buildTakeHoldWorldMessage(basePlan({ carriedObjectCount: 2 })))
            .toBe('Alice picks up broom and everything on it')
    })

    it('appends "and everything on it" to drop copy for a carry (BD-13)', () => {
        expect(buildDropWorldMessage(basePlan({ operation: 'drop', carriedObjectCount: 2 })))
            .toBe('Alice drops broom and everything on it')
    })

    it('does not append the carry suffix for an ordinary (size-1) command', () => {
        expect(buildTakeHoldWorldMessage(basePlan({ carriedObjectCount: 1 })))
            .toBe('Alice picks up broom')
        expect(buildDropWorldMessage(basePlan({ operation: 'drop', carriedObjectCount: 1 })))
            .toBe('Alice drops broom')
    })
})
