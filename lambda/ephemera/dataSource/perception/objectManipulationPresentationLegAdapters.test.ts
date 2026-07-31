import {
    StreamingEventEnvelope,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { EPHEMERA_ACTIONS_DATA_SOURCE_KEY } from '../actions/publishedEvents'
import { EPHEMERA_POSITIONS_DATA_SOURCE_KEY } from '../positions/publishedEvents'
import {
    isPerceptionActionsObjectEstablishRelationEnvelope,
    isPerceptionObjectManipulationPresentationEnvelope,
    isPerceptionPositionsObjectRelationChangedEnvelope,
    toObjectManipulationPresentationLeg,
} from './objectManipulationPresentationLegAdapters'

const CHARACTER = 'CHARACTER#Alice' as const
const OBJECT = 'OBJECT#Broom' as const
const TRAY = 'OBJECT#Tray' as const
const GLASS = 'OBJECT#Glass' as const
const ROOM = 'ROOM#Cafe' as const
const ANCHOR_TIME = 1_700_000_000_000

const envelope = (
    dataSourceKey: string,
    type: string,
    content: object,
    streamKey: string = CHARACTER
): StreamingEventEnvelope<unknown> => ({
    header: {
        dataSourceKey,
        streamKey,
        timestamp: Date.now(),
        type,
    },
    getContent: () => Promise.resolve(content),
})

/**
 * Take Hold / Drop / Object Moved coverage went out in Phase 4 with the branches it exercised:
 * object moves narrate through the mutation kernel's compiled step sequence now, so those events
 * never reach perception at all. The retired events are pinned as actively *rejected* rather than
 * merely no longer asserted --- that is the difference between "we removed the test" and "we removed
 * the route."
 */
describe('objectManipulationPresentationLegAdapters', () => {
    describe('envelope guards', () => {
        it('accepts Object Establish Relation from actions', () => {
            const env = envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Object Establish Relation', {
                type: 'Object Establish Relation',
                characterId: CHARACTER,
                subjectId: GLASS,
                targetId: TRAY,
                hostId: ROOM,
                relationKind: 'On',
            })
            expect(isPerceptionActionsObjectEstablishRelationEnvelope(env)).toBe(true)
            expect(isPerceptionObjectManipulationPresentationEnvelope(env)).toBe(true)
        })

        it('accepts Object Relation Changed from positions', () => {
            const env = envelope(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Object Relation Changed', {
                type: 'Object Relation Changed',
                subjectId: GLASS,
                targetId: TRAY,
                hostId: ROOM,
                relationKind: 'On',
                operation: 'establish',
                beatAnchorTime: ANCHOR_TIME,
            }, GLASS)
            expect(isPerceptionPositionsObjectRelationChangedEnvelope(env)).toBe(true)
            expect(isPerceptionObjectManipulationPresentationEnvelope(env)).toBe(true)
        })

        it('rejects the retired Object Take Hold / Object Drop / Object Moved events', () => {
            expect(isPerceptionObjectManipulationPresentationEnvelope(envelope(
                EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Object Take Hold', {
                    type: 'Object Take Hold', characterId: CHARACTER, objectIds: [OBJECT], roomId: ROOM,
                }
            ))).toBe(false)
            expect(isPerceptionObjectManipulationPresentationEnvelope(envelope(
                EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Object Drop', {
                    type: 'Object Drop', characterId: CHARACTER, objectIds: [OBJECT], roomId: ROOM,
                }
            ))).toBe(false)
            expect(isPerceptionObjectManipulationPresentationEnvelope(envelope(
                EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Object Moved', {
                    type: 'Object Moved', objectId: OBJECT, froms: [ROOM], to: CHARACTER, beatAnchorTime: ANCHOR_TIME,
                }, OBJECT
            ))).toBe(false)
        })

        it('rejects Character Moved for object manipulation guards', () => {
            const env = envelope(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Character Moved', {
                type: 'Character Moved',
                characterId: CHARACTER,
                froms: [ROOM],
                to: 'ROOM#Other',
                beatAnchorTime: ANCHOR_TIME,
            })
            expect(isPerceptionPositionsObjectRelationChangedEnvelope(env)).toBe(false)
            expect(isPerceptionObjectManipulationPresentationEnvelope(env)).toBe(false)
        })
    })

    describe('toObjectManipulationPresentationLeg', () => {
        it('maps Object Establish Relation to a relational intent leg', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Object Establish Relation', {
                    type: 'Object Establish Relation',
                    characterId: CHARACTER,
                    subjectId: GLASS,
                    targetId: TRAY,
                    hostId: ROOM,
                    relationKind: 'On',
                })
            )
            expect(legs).toEqual([{
                kind: 'relationalIntent',
                operation: 'establishRelation',
                characterId: CHARACTER,
                subjectId: GLASS,
                targetId: TRAY,
                roomId: ROOM,
                relationKind: 'On',
            }])
        })

        it('maps Object Relation Changed to a relational fact leg', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Object Relation Changed', {
                    type: 'Object Relation Changed',
                    subjectId: GLASS,
                    targetId: TRAY,
                    hostId: ROOM,
                    relationKind: 'On',
                    operation: 'establish',
                    beatAnchorTime: ANCHOR_TIME,
                }, GLASS)
            )
            expect(legs).toEqual([{
                kind: 'relationalFact',
                subjectId: GLASS,
                targetId: TRAY,
                hostRoomId: ROOM,
                relationKind: 'On',
                operation: 'establish',
                beatAnchorTime: ANCHOR_TIME,
            }])
        })

        it('yields no leg for a retired Object Moved fact', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Object Moved', {
                    type: 'Object Moved',
                    objectId: OBJECT,
                    froms: [ROOM],
                    to: CHARACTER,
                    beatAnchorTime: ANCHOR_TIME,
                }, OBJECT)
            )
            expect(legs).toEqual([])
        })

        it('returns an empty array for non-object-manipulation envelopes', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope('api.ephemera', 'Character Perception Requested', {
                    ephemeraId: CHARACTER,
                } as never)
            )
            expect(legs).toEqual([])
        })

        it('returns an empty array when content fails payload guard', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Object Establish Relation', {
                    type: 'Object Establish Relation',
                    characterId: CHARACTER,
                    subjectId: 'ROOM#bad',
                    targetId: TRAY,
                    hostId: ROOM,
                    relationKind: 'On',
                } as never)
            )
            expect(legs).toEqual([])
        })
    })
})
