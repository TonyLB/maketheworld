import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isOrphanedImprovisedObject } from './classification'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

describe('isOrphanedImprovisedObject', () => {
    it('classifies S1 double-fail orphan (pair + meta, no graph, empty containers)', () => {
        expect(isOrphanedImprovisedObject({
            objectId: OBJECT_ID,
            hasPairRow: true,
            hasMetaRow: true,
            membershipContainers: [],
            onAnyPositionGraph: false,
        })).toBe(true)
    })

    it('does not classify healthy spawn (containers include target room)', () => {
        expect(isOrphanedImprovisedObject({
            objectId: OBJECT_ID,
            hasPairRow: true,
            hasMetaRow: true,
            membershipContainers: [ROOM_ID],
            onAnyPositionGraph: true,
        })).toBe(false)
    })

    it('does not classify adjacency lag only (graph node present, containers empty)', () => {
        expect(isOrphanedImprovisedObject({
            objectId: OBJECT_ID,
            hasPairRow: true,
            hasMetaRow: true,
            membershipContainers: [],
            onAnyPositionGraph: true,
        })).toBe(false)
    })

    it('does not classify partial existence (pair only)', () => {
        expect(isOrphanedImprovisedObject({
            objectId: OBJECT_ID,
            hasPairRow: true,
            hasMetaRow: false,
            membershipContainers: [],
            onAnyPositionGraph: false,
        })).toBe(false)
    })

    it('does not classify partial existence (meta only)', () => {
        expect(isOrphanedImprovisedObject({
            objectId: OBJECT_ID,
            hasPairRow: false,
            hasMetaRow: true,
            membershipContainers: [],
            onAnyPositionGraph: false,
        })).toBe(false)
    })

    it('does not classify when containers are non-empty even without graph scan match', () => {
        expect(isOrphanedImprovisedObject({
            objectId: OBJECT_ID,
            hasPairRow: true,
            hasMetaRow: true,
            membershipContainers: [ROOM_ID],
            onAnyPositionGraph: false,
        })).toBe(false)
    })
})
