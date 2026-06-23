import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    buildTakeHoldWorldMessage,
    publishObjectManipulationPresentation,
} from './publishObjectManipulationPresentation'
import type { ObjectManipulationEmissionPlan } from './objectManipulationPresentationFanIn'

const CHARACTER_ID = 'CHARACTER#Alice' as EphemeraCharacterId
const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const ANCHOR = 1_700_000_000_000

const basePlan = (overrides: Partial<ObjectManipulationEmissionPlan> = {}): ObjectManipulationEmissionPlan => ({
    characterId: CHARACTER_ID,
    objectId: OBJECT_ID,
    roomId: ROOM_ID,
    beatAnchorTime: ANCHOR,
    characterName: 'Alice',
    objectShortName: 'broom',
    ...overrides,
})

describe('publishObjectManipulationPresentation', () => {
    it('builds take-hold world message copy', () => {
        expect(buildTakeHoldWorldMessage(basePlan())).toBe('Alice picks up broom')
    })

    it('publishes single WorldMessage with Model A createdTime', () => {
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
})
