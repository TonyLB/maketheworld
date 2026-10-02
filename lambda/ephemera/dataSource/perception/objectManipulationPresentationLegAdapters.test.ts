import {
    StreamingEventEnvelope,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { EPHEMERA_ACTIONS_DATA_SOURCE_KEY } from '../actions/publishedEvents'
import { EPHEMERA_POSITIONS_DATA_SOURCE_KEY } from '../positions/publishedEvents'
import type { CommandAttemptData } from '../actions/commandAttempt'
import internalCache from '../../internalCache'
import {
    isPerceptionActionsLudicNetworkChangeRequestedEnvelope,
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

const relationalAttempt = (
    primitive: 'establishRelation' | 'dissolveRelation',
    subjectId: string,
    targetId: string,
    relationKind: string = 'Under'
): CommandAttemptData => ({
    words: 'test command',
    referents: [],
    actions: [{
        kind: 'position',
        desiredResult: {
            kind: 'change',
            primitive,
            subject: { referentType: 'objectSpan', span: 'subject', groundedId: subjectId },
            target: { referentType: 'objectSpan', span: 'target', groundedId: targetId },
            relationKind,
        } as CommandAttemptData['actions'][number]['desiredResult'],
        challenges: [],
    }],
})

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
 *
 * Re-pointed from `Object Establish Relation`/`Object Dissolve Relation` to `Ludic Network Change
 * Requested` (AP-9, slice 3a-iv): the host is no longer carried flat, so `toObjectManipulationPresentationLeg`
 * reads it fresh via `internalCache.Positions.getMembershipContainers`, mocked here.
 */
describe('objectManipulationPresentationLegAdapters', () => {
    beforeEach(() => {
        jest.spyOn(internalCache.Positions, 'getMembershipContainers').mockResolvedValue([ROOM])
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('envelope guards', () => {
        it('accepts Ludic Network Change Requested from actions', () => {
            const env = envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Ludic Network Change Requested', {
                type: 'Ludic Network Change Requested',
                characterId: CHARACTER,
                attempt: relationalAttempt('establishRelation', GLASS, TRAY),
            })
            expect(isPerceptionActionsLudicNetworkChangeRequestedEnvelope(env)).toBe(true)
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
        it('maps Ludic Network Change Requested (establish) to a relational intent leg', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Ludic Network Change Requested', {
                    type: 'Ludic Network Change Requested',
                    characterId: CHARACTER,
                    attempt: relationalAttempt('establishRelation', GLASS, TRAY),
                })
            )
            expect(legs).toEqual([{
                kind: 'relationalIntent',
                operation: 'establishRelation',
                characterId: CHARACTER,
                subjectId: GLASS,
                targetId: TRAY,
                roomId: ROOM,
                relationKind: 'Under',
            }])
        })

        it('maps Ludic Network Change Requested (dissolve) to a relational intent leg', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Ludic Network Change Requested', {
                    type: 'Ludic Network Change Requested',
                    characterId: CHARACTER,
                    attempt: relationalAttempt('dissolveRelation', GLASS, TRAY),
                })
            )
            expect(legs).toEqual([{
                kind: 'relationalIntent',
                operation: 'dissolveRelation',
                characterId: CHARACTER,
                subjectId: GLASS,
                targetId: TRAY,
                roomId: ROOM,
                relationKind: 'Under',
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

        it('yields no leg for an Object Relation Changed fact with a non-Object (Character) subject --- deliberately deferred', async () => {
            const COMPANION = 'CHARACTER#Companion' as const
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Object Relation Changed', {
                    type: 'Object Relation Changed',
                    subjectId: COMPANION,
                    targetId: TRAY,
                    hostId: ROOM,
                    relationKind: 'On',
                    operation: 'establish',
                    beatAnchorTime: ANCHOR_TIME,
                }, GLASS)
            )
            expect(legs).toEqual([])
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
                envelope('api.ephemera', 'Perception Thread Registered', {
                    componentId: ROOM,
                } as never)
            )
            expect(legs).toEqual([])
        })

        it('returns an empty array when content fails payload guard', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Ludic Network Change Requested', {
                    type: 'Ludic Network Change Requested',
                    characterId: 'ROOM#bad',
                    attempt: relationalAttempt('establishRelation', GLASS, TRAY),
                } as never)
            )
            expect(legs).toEqual([])
        })

        it('yields no leg for an attempt with no relational action (membership)', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Ludic Network Change Requested', {
                    type: 'Ludic Network Change Requested',
                    characterId: CHARACTER,
                    attempt: {
                        words: 'pick up the broom',
                        referents: [],
                        actions: [{
                            kind: 'position',
                            desiredResult: {
                                kind: 'change',
                                primitive: 'transferMembership',
                                object: { referentType: 'objectSpan', span: 'object', groundedId: OBJECT },
                                from: { referentType: 'currentHost', referentTarget: { referentType: 'actingCharacter' }, groundedId: ROOM },
                                to: { referentType: 'actingCharacter', groundedId: CHARACTER },
                            },
                            challenges: [],
                        }],
                    },
                })
            )
            expect(legs).toEqual([])
        })

        it('yields no leg when the subject has no single current host (drift)', async () => {
            jest.spyOn(internalCache.Positions, 'getMembershipContainers').mockResolvedValue([])
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Ludic Network Change Requested', {
                    type: 'Ludic Network Change Requested',
                    characterId: CHARACTER,
                    attempt: relationalAttempt('establishRelation', GLASS, TRAY),
                })
            )
            expect(legs).toEqual([])
        })
    })
})
