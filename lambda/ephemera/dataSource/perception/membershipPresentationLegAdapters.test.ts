import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type {
    CharacterHomePublishedPayload,
    CharacterNavigatePublishedPayload,
} from '../actions/publishedEvents'
import { EPHEMERA_ACTIONS_DATA_SOURCE_KEY } from '../actions/sendPublishedEvents'
import type { CharacterMovedPublishedPayload } from '../positions/publishedEvents'
import { EPHEMERA_POSITIONS_DATA_SOURCE_KEY } from '../positions/publishedEvents'
import type { MembershipPresentationLeg } from './membershipPresentationFanIn'
import {
    isPerceptionActionsCharacterHomeEnvelope,
    isPerceptionActionsCharacterNavigateEnvelope,
    isPerceptionConnectionsCharactersEnvelope,
    isPerceptionPositionsCharacterMovedEnvelope,
    toMembershipPresentationLeg,
} from './membershipPresentationLegAdapters'

const CHARACTER = 'CHARACTER#Alice' as const
const ROOM_A = 'ROOM#a' as const
const ROOM_B = 'ROOM#b' as const
const ANCHOR_TIME = 1_700_000_000_000

const envelope = <T>(
    dataSourceKey: string,
    type: string,
    content: T
): StreamingEventEnvelope<T> => ({
    header: {
        dataSourceKey,
        streamKey: CHARACTER,
        timestamp: ANCHOR_TIME,
        type,
    },
    getContent: async () => content,
})

describe('membershipPresentationLegAdapters', () => {
    describe('envelope guards', () => {
        it('accepts Character Navigate from mtw.ephemera.actions', () => {
            const nav: CharacterNavigatePublishedPayload = {
                type: 'Character Navigate',
                characterId: CHARACTER,
                fromRoomId: ROOM_A,
                toRoomId: ROOM_B,
            }
            expect(
                isPerceptionActionsCharacterNavigateEnvelope(
                    envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Navigate', nav)
                )
            ).toBe(true)
        })

        it('accepts Character Home from mtw.ephemera.actions', () => {
            const home: CharacterHomePublishedPayload = {
                type: 'Character Home',
                characterId: CHARACTER,
                fromRoomId: ROOM_A,
                toRoomId: ROOM_B,
            }
            expect(
                isPerceptionActionsCharacterHomeEnvelope(
                    envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Home', home)
                )
            ).toBe(true)
        })

        it('accepts Character Connected and Disconnected from mtw.connections.characters', () => {
            const connected = {
                type: 'Character Connected' as const,
                characterId: CHARACTER,
                sessionId: 'SESSION#1',
                timestamp: '2026-01-01T00:00:00.000Z',
            }
            const disconnected = {
                type: 'Character Disconnected' as const,
                characterId: CHARACTER,
                sessionId: 'SESSION#1',
                timestamp: '2026-01-01T00:00:00.000Z',
            }
            expect(
                isPerceptionConnectionsCharactersEnvelope(
                    envelope('mtw.connections.characters', 'Character Connected', connected)
                )
            ).toBe(true)
            expect(
                isPerceptionConnectionsCharactersEnvelope(
                    envelope('mtw.connections.characters', 'Character Disconnected', disconnected)
                )
            ).toBe(true)
        })

        it('accepts Character Moved from mtw.ephemera.positions', () => {
            const moved: CharacterMovedPublishedPayload = {
                type: 'Character Moved',
                characterId: CHARACTER,
                from: ROOM_A,
                to: ROOM_B,
                beatAnchorTime: ANCHOR_TIME,
            }
            expect(
                isPerceptionPositionsCharacterMovedEnvelope(
                    envelope(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Character Moved', moved)
                )
            ).toBe(true)
        })

        it('rejects wrong dataSourceKey or type', () => {
            const nav: CharacterNavigatePublishedPayload = {
                type: 'Character Navigate',
                characterId: CHARACTER,
                fromRoomId: ROOM_A,
                toRoomId: ROOM_B,
            }
            expect(
                isPerceptionActionsCharacterNavigateEnvelope(
                    envelope('mtw.ephemera.positions', 'Character Navigate', nav)
                )
            ).toBe(false)
            expect(
                isPerceptionActionsCharacterHomeEnvelope(
                    envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Navigate', {
                        type: 'Character Home',
                        characterId: CHARACTER,
                        fromRoomId: ROOM_A,
                        toRoomId: ROOM_B,
                    })
                )
            ).toBe(false)
        })
    })

    describe('toMembershipPresentationLeg', () => {
        it('maps Character Navigate to navigate intent leg', async () => {
            const leg = await toMembershipPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Navigate', {
                    type: 'Character Navigate',
                    characterId: CHARACTER,
                    fromRoomId: ROOM_A,
                    toRoomId: ROOM_B,
                })
            )
            expect(leg).toEqual({
                kind: 'intent',
                intentKind: 'navigate',
                characterId: CHARACTER,
                fromRoomId: ROOM_A,
                toRoomId: ROOM_B,
            } satisfies MembershipPresentationLeg)
        })

        it('maps Character Home to home intent leg', async () => {
            const leg = await toMembershipPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Home', {
                    type: 'Character Home',
                    characterId: CHARACTER,
                    fromRoomId: ROOM_A,
                    toRoomId: ROOM_B,
                })
            )
            expect(leg).toEqual({
                kind: 'intent',
                intentKind: 'home',
                characterId: CHARACTER,
                fromRoomId: ROOM_A,
                toRoomId: ROOM_B,
            })
        })

        it('maps Character Connected to provisional connect intent leg', async () => {
            const leg = await toMembershipPresentationLeg(
                envelope('mtw.connections.characters', 'Character Connected', {
                    type: 'Character Connected',
                    characterId: CHARACTER,
                    sessionId: 'SESSION#1',
                    timestamp: '2026-01-01T00:00:00.000Z',
                })
            )
            expect(leg).toEqual({
                kind: 'intent',
                intentKind: 'connect',
                characterId: CHARACTER,
            })
        })

        it('maps Character Disconnected to provisional disconnect intent leg', async () => {
            const leg = await toMembershipPresentationLeg(
                envelope('mtw.connections.characters', 'Character Disconnected', {
                    type: 'Character Disconnected',
                    characterId: CHARACTER,
                    sessionId: 'SESSION#1',
                    timestamp: '2026-01-01T00:00:00.000Z',
                })
            )
            expect(leg).toEqual({
                kind: 'intent',
                intentKind: 'disconnect',
                characterId: CHARACTER,
            })
        })

        it('maps Character Moved to fact leg', async () => {
            const leg = await toMembershipPresentationLeg(
                envelope(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Character Moved', {
                    type: 'Character Moved',
                    characterId: CHARACTER,
                    from: ROOM_A,
                    to: ROOM_B,
                    beatAnchorTime: ANCHOR_TIME,
                    legalExits: ['north'],
                    characterName: 'Alice',
                })
            )
            expect(leg).toEqual({
                kind: 'fact',
                characterId: CHARACTER,
                from: ROOM_A,
                to: ROOM_B,
                beatAnchorTime: ANCHOR_TIME,
                legalExits: ['north'],
                characterName: 'Alice',
            })
        })

        it('returns undefined for non-membership envelopes', async () => {
            const leg = await toMembershipPresentationLeg(
                envelope('api.ephemera', 'Character Perception Requested', {
                    ephemeraId: CHARACTER,
                } as never)
            )
            expect(leg).toBeUndefined()
        })

        it('returns undefined when content fails payload guard', async () => {
            const leg = await toMembershipPresentationLeg(
                envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Navigate', {
                    type: 'Character Navigate',
                    characterId: CHARACTER,
                    fromRoomId: ROOM_A,
                    toRoomId: 1,
                } as never)
            )
            expect(leg).toBeUndefined()
        })
    })

    describe('integration with FanInClusterStore', () => {
        it('home intent + fact yields copyKind home via adapters', async () => {
            const {
                createMembershipPresentationFanInStore,
                createMembershipFanInHandlerContext,
            } = await import('./membershipPresentationFanIn')
            const ctx = createMembershipFanInHandlerContext()
            const store = createMembershipPresentationFanInStore()
            store.setHandlerContext(ctx)

            const homeEnvelope = envelope(EPHEMERA_ACTIONS_DATA_SOURCE_KEY, 'Character Home', {
                type: 'Character Home',
                characterId: CHARACTER,
                fromRoomId: ROOM_A,
                toRoomId: ROOM_B,
            })
            const factEnvelope = envelope(EPHEMERA_POSITIONS_DATA_SOURCE_KEY, 'Character Moved', {
                type: 'Character Moved',
                characterId: CHARACTER,
                from: ROOM_A,
                to: ROOM_B,
                beatAnchorTime: ANCHOR_TIME,
            })

            const homeLeg = await toMembershipPresentationLeg(homeEnvelope)
            const factLeg = await toMembershipPresentationLeg(factEnvelope)
            expect(homeLeg).toBeDefined()
            expect(factLeg).toBeDefined()

            await store.route(homeLeg!)
            await store.route(factLeg!)

            expect(ctx.plans).toHaveLength(1)
            expect(ctx.plans[0]).toMatchObject({
                copyKind: 'home',
                shape: 'leaveAndArrive',
                deferralExecution: false,
            })
        })
    })
})
