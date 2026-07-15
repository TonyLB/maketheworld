import {
    StreamingEventEnvelope,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { EPHEMERA_ACTIONS_DATA_SOURCE_KEY } from '../actions/publishedEvents'
import { EPHEMERA_POSITIONS_DATA_SOURCE_KEY } from '../positions/publishedEvents'
import {
    isPerceptionActionsObjectDropEnvelope,
    isPerceptionActionsObjectTakeHoldEnvelope,
    isPerceptionObjectManipulationPresentationEnvelope,
    isPerceptionPositionsObjectMovedEnvelope,
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

describe('objectManipulationPresentationLegAdapters', () => {
    describe('envelope guards', () => {
        it('accepts Object Take Hold from actions', () => {
            const env = envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Object Take Hold', {
                type: 'Object Take Hold',
                characterId: CHARACTER,
                objectIds: [OBJECT],
                roomId: ROOM,
            })
            expect(isPerceptionActionsObjectTakeHoldEnvelope(env)).toBe(true)
            expect(isPerceptionObjectManipulationPresentationEnvelope(env)).toBe(true)
        })

        it('accepts Object Drop from actions', () => {
            const env = envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Object Drop', {
                type: 'Object Drop',
                characterId: CHARACTER,
                objectIds: [OBJECT],
                roomId: ROOM,
            })
            expect(isPerceptionActionsObjectDropEnvelope(env)).toBe(true)
            expect(isPerceptionObjectManipulationPresentationEnvelope(env)).toBe(true)
        })

        it('accepts Object Moved from positions', () => {
            const env = envelope(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Object Moved', {
                type: 'Object Moved',
                objectId: OBJECT,
                froms: [ROOM],
                to: CHARACTER,
                beatAnchorTime: ANCHOR_TIME,
            }, OBJECT)
            expect(isPerceptionPositionsObjectMovedEnvelope(env)).toBe(true)
            expect(isPerceptionObjectManipulationPresentationEnvelope(env)).toBe(true)
        })

        it('rejects Character Moved for object manipulation guards', () => {
            const env = envelope(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Character Moved', {
                type: 'Character Moved',
                characterId: CHARACTER,
                froms: [ROOM],
                to: 'ROOM#Other',
                beatAnchorTime: ANCHOR_TIME,
            })
            expect(isPerceptionPositionsObjectMovedEnvelope(env)).toBe(false)
            expect(isPerceptionObjectManipulationPresentationEnvelope(env)).toBe(false)
        })
    })

    describe('toObjectManipulationPresentationLeg', () => {
        it('maps Object Take Hold to a single-element intent leg array', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Object Take Hold', {
                    type: 'Object Take Hold',
                    characterId: CHARACTER,
                    objectIds: [OBJECT],
                    roomId: ROOM,
                    confidence: 0.9,
                })
            )
            expect(legs).toEqual([{
                kind: 'intent',
                operation: 'takeHold',
                characterId: CHARACTER,
                objectId: OBJECT,
                objectIds: [OBJECT],
                roomId: ROOM,
            }])
        })

        it('maps a multi-object Object Take Hold (BD-13 carry) to one intent leg per object, each carrying the full set', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Object Take Hold', {
                    type: 'Object Take Hold',
                    characterId: CHARACTER,
                    objectIds: [TRAY, GLASS],
                    roomId: ROOM,
                })
            )
            expect(legs).toEqual([
                {
                    kind: 'intent',
                    operation: 'takeHold',
                    characterId: CHARACTER,
                    objectId: TRAY,
                    objectIds: [TRAY, GLASS],
                    roomId: ROOM,
                },
                {
                    kind: 'intent',
                    operation: 'takeHold',
                    characterId: CHARACTER,
                    objectId: GLASS,
                    objectIds: [TRAY, GLASS],
                    roomId: ROOM,
                },
            ])
        })

        it('maps Object Drop to a single-element intent leg array', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Object Drop', {
                    type: 'Object Drop',
                    characterId: CHARACTER,
                    objectIds: [OBJECT],
                    roomId: ROOM,
                    confidence: 0.9,
                })
            )
            expect(legs).toEqual([{
                kind: 'intent',
                operation: 'drop',
                characterId: CHARACTER,
                objectId: OBJECT,
                objectIds: [OBJECT],
                roomId: ROOM,
            }])
        })

        it('maps Object Moved to a single-element fact leg array', async () => {
            const legs = await toObjectManipulationPresentationLeg(
                envelope(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Object Moved', {
                    type: 'Object Moved',
                    objectId: OBJECT,
                    froms: [ROOM],
                    to: CHARACTER,
                    beatAnchorTime: ANCHOR_TIME,
                }, OBJECT)
            )
            expect(legs).toEqual([{
                kind: 'fact',
                objectId: OBJECT,
                froms: [ROOM],
                to: CHARACTER,
                beatAnchorTime: ANCHOR_TIME,
            }])
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
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Object Take Hold', {
                    type: 'Object Take Hold',
                    characterId: CHARACTER,
                    objectIds: ['ROOM#bad'],
                    roomId: ROOM,
                } as never)
            )
            expect(legs).toEqual([])
        })
    })
})
