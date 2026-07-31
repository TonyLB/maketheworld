import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    buildDissolveRelationWorldMessage,
    buildEstablishRelationWorldMessage,
    publishObjectRelationalPresentation,
} from './publishObjectManipulationPresentation'
import type { ObjectRelationalEmissionPlan } from './objectManipulationPresentationFanIn'

const CHARACTER_ID = 'CHARACTER#Alice' as EphemeraCharacterId
const SUBJECT_ID = 'OBJECT#Glass' as EphemeraObjectId
const TARGET_ID = 'OBJECT#Tray' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const ANCHOR = 1_700_000_000_000

const basePlan = (overrides: Partial<ObjectRelationalEmissionPlan> = {}): ObjectRelationalEmissionPlan => ({
    operation: 'establishRelation',
    characterId: CHARACTER_ID,
    subjectId: SUBJECT_ID,
    targetId: TARGET_ID,
    roomId: ROOM_ID,
    relationKind: 'On',
    beatAnchorTime: ANCHOR,
    characterName: 'Alice',
    subjectShortName: 'glass',
    targetShortName: 'tray',
    ...overrides,
})

/**
 * Take/drop coverage left this file in Phase 4 along with the builders it exercised --- the copy
 * cases now live in `presentStepSequence.test.ts`'s `objectMove` narration block, and the routing in
 * `orchestrateObjectMove.test.ts`. What remains is the relational (reposition-within-a-host) family,
 * which is a deliberate deferral rather than a boundary (PB-M).
 */
describe('publishObjectRelationalPresentation', () => {
    it('builds establish-relation copy per relation kind', () => {
        expect(buildEstablishRelationWorldMessage(basePlan())).toBe('Alice puts glass on tray')
        expect(buildEstablishRelationWorldMessage(basePlan({ relationKind: 'Under' })))
            .toBe('Alice puts glass under tray')
        expect(buildEstablishRelationWorldMessage(basePlan({ relationKind: 'Against' })))
            .toBe('Alice leans glass against tray')
        expect(buildEstablishRelationWorldMessage(basePlan({ relationKind: 'Custom', relationLabel: 'balances' })))
            .toBe('Alice balances glass tray')
    })

    it('builds dissolve-relation copy', () => {
        expect(buildDissolveRelationWorldMessage(basePlan({ operation: 'dissolveRelation' })))
            .toBe('Alice takes glass off tray')
    })

    it('targets the room alone --- the trailing characterId tack-on is retired', () => {
        const messageBus = { publish: jest.fn() }

        publishObjectRelationalPresentation(messageBus as any, basePlan())

        // The actor never leaves the room during a reposition, so live `ROOM#` expansion at flush
        // already includes them; the trailing `characterId` was a no-op copied from the one site
        // (a departure room) where it was genuinely load-bearing. Purpose finding 1.
        expect(messageBus.publish).toHaveBeenCalledTimes(1)
        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: [ROOM_ID],
            displayProtocol: 'WorldMessage',
            message: ['Alice puts glass on tray'],
            createdTime: ANCHOR,
        })
    })

    it('publishes dissolve copy through the same path', () => {
        const messageBus = { publish: jest.fn() }

        publishObjectRelationalPresentation(messageBus as any, basePlan({ operation: 'dissolveRelation' }))

        expect(messageBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            targets: [ROOM_ID],
            message: ['Alice takes glass off tray'],
        }))
    })
})
