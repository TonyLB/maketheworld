/**
 * Payoff test for charactersDataSource Slice 2: the eviction ladder's round trip through
 * the real `mtw.ephemera.characters` bus subscription, and connect's read-side placement
 * decision after the write lands.
 *
 * Real: the `mtw.ephemera.characters` DataSource subscription (`handleCharacterMoved` ->
 * `persistRoomStackNavigate`), and positions' `handleCharacterConnected` ->
 * `resolveConnectTargetRoom` -> `trimPersistCharacterRoomStack`. `internalCache.CharacterMeta`,
 * `.RoomAssets` and `.Global` are the real caches, seeded/spied directly rather than mocked
 * wholesale.
 *
 * Mocked: `@tonylb/mtw-utilities/ts/dynamoDB` (a single stateful `Meta::Character` row behind
 * `optimisticUpdate`, the same `produce`-over-a-draft stand-in
 * `repairCharacterLegalPlacement.test.ts`'s `setupTrimPersist` uses, kept across the whole test);
 * `internalCache.Positions.getMembershipContainers` (toggled to simulate connect/disconnect ---
 * the adjacency leaf itself isn't modelled, following `positions/receivePaths.integration.test.ts`'s
 * precedent of spying this directly); and `orchestrateCharacterMove` (the connect/kernel-commit
 * boundary --- already covered unmocked by `orchestrateCharacterMove.test.ts`,
 * `buildCharacterMoveOp.test.ts` et al., so re-proving it here would be out of this slice's scope).
 *
 * The ladder write itself is driven by `sendCharacterMovedPublish`, which publishes a real
 * `StreamingEvent` matching `isEphemeraPositionsCharacterMovedEnvelope` on the process message
 * bus --- not a direct call to `handleCharacterMoved`/`persistRoomStackNavigate` --- so the write
 * this test observes landed through the real bus subscription, not a shortcut around it.
 */
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

// The same subscription also announces the mover (`CharacterInPlay`); that publish is covered by
// `publishCharacterInPlay.test.ts` and is not what this ladder round trip observes.
jest.mock('./characters/publishCharacterInPlay', () => ({
    publishCharacterInPlay: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./positions/navigate/orchestrateCharacterMove', () => ({
    orchestrateCharacterMove: jest.fn(),
}))

import { produce } from 'immer'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import messageBus from '../messageBus'
import internalCache from '../internalCache'
import { sendCharacterMovedPublish } from './positions/publishedEvents'
import { handleCharacterConnected } from './positions/handleConnectionsCharactersPresence'
import { orchestrateCharacterMove } from './positions/navigate/orchestrateCharacterMove'
import { DEFAULT_ROOM_STACK } from './characters/roomStack/trimEvictionLadder'
import type { RoomStackItem } from './characters/roomStack/types'

import './characters'

const ephemeraDBMock = jest.mocked(ephemeraDB)
const orchestrateCharacterMoveMock = orchestrateCharacterMove as jest.MockedFunction<typeof orchestrateCharacterMove>

const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId
const VORTEX_ROOM_ID = 'ROOM#VORTEX' as EphemeraRoomId
const OVERLOOK_ROOM_ID = 'ROOM#Overlook' as EphemeraRoomId

type StoredCharacterRow = {
    EphemeraId: EphemeraCharacterId;
    Name: string;
    RoomStack: RoomStackItem[];
    HomeId: string;
    assets: string[];
    Pronouns: string;
}

describe('character eviction-ladder connect payoff (integration)', () => {
    let row: StoredCharacterRow

    beforeEach(() => {
        messageBus.clear()
        internalCache.clear()
        jest.clearAllMocks()

        row = {
            EphemeraId: CHARACTER_ID,
            Name: 'Tester',
            RoomStack: DEFAULT_ROOM_STACK,
            HomeId: 'VORTEX',
            assets: ['overlayOne'],
            Pronouns: 'they/them',
        }

        jest.spyOn(internalCache.Global, 'get').mockImplementation(async (key: any) => (
            key === 'assets' ? ['primitives'] : undefined
        ))
        jest.spyOn(internalCache.RoomAssets, 'get').mockImplementation(async (roomId: EphemeraRoomId) => (
            roomId === OVERLOOK_ROOM_ID ? ['ASSET#overlayOne'] as any : ['ASSET#primitives'] as any
        ))

        ephemeraDBMock.getItem.mockImplementation(async () => ({ ...row }) as any)
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer, successCallback }: any) => {
            const prior = row
            const next = produce(prior, updateReducer)
            row = next
            successCallback?.(next, prior)
            return next
        })

        orchestrateCharacterMoveMock.mockResolvedValue({ ok: true, froms: [], to: null, changed: false })
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('places a reconnecting character in the overlay room the real bus-delivered ladder write put them in, then at the surviving canon frame once that asset is lost', async () => {
        // 1. Navigate into the overlay room. The ladder write must arrive at
        //    mtw.ephemera.characters through the real bus subscription, not a direct call.
        sendCharacterMovedPublish(messageBus, CHARACTER_ID, {
            type: 'Character Moved',
            characterId: CHARACTER_ID,
            froms: [VORTEX_ROOM_ID],
            to: OVERLOOK_ROOM_ID,
            beatAnchorTime: 1_000,
        })
        await messageBus.flushAndSettle()

        expect(row.RoomStack.slice(-1)[0]).toEqual(expect.objectContaining({ RoomId: 'Overlook' }))

        // 2. Disconnect (out of play), then connect: resolve placement from the ladder the
        //    subscriber just wrote --- the character is placed back in the overlay room.
        jest.spyOn(internalCache.Positions, 'getMembershipContainers').mockResolvedValue([])

        await handleCharacterConnected(
            { type: 'Character Connected', characterId: CHARACTER_ID, sessionId: 'SESSION#1', timestamp: '2026-10-08T00:00:00.000Z' },
            { messageBus: messageBus as any, streamEvent: jest.fn().mockResolvedValue(undefined) }
        )

        expect(orchestrateCharacterMoveMock).toHaveBeenCalledWith(
            expect.objectContaining({ characterId: CHARACTER_ID, targetRoomId: OVERLOOK_ROOM_ID, intentKind: 'connect' })
        )

        // 3. The overlay asset becomes inaccessible. Disconnect and connect again: the character
        //    is placed at the surviving canon frame instead.
        orchestrateCharacterMoveMock.mockClear()
        row = { ...row, assets: [] }
        internalCache.CharacterMeta.invalidate(CHARACTER_ID)

        await handleCharacterConnected(
            { type: 'Character Connected', characterId: CHARACTER_ID, sessionId: 'SESSION#2', timestamp: '2026-10-08T00:05:00.000Z' },
            { messageBus: messageBus as any, streamEvent: jest.fn().mockResolvedValue(undefined) }
        )

        expect(orchestrateCharacterMoveMock).toHaveBeenCalledWith(
            expect.objectContaining({ characterId: CHARACTER_ID, targetRoomId: VORTEX_ROOM_ID, intentKind: 'connect' })
        )
    })
})
