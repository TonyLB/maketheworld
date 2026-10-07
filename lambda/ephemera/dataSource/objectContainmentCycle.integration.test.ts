/**
 * AB-63 regression: the real object-containment path refuses a move that would close a containment
 * cycle. `In` became player-reachable 2026-09-22, so "put the cup in the box", then "put the box
 * in the cup", is a two-command sequence any player can type --- and before
 * `planObjectMoveTransfer`'s `hasPresenceAncestor` check (`positions/ludicGraph/presenceAncestry.ts`)
 * it committed, emptying the room's graph and leaving box and cup holding each other.
 *
 * Real, unmocked: `commitAttempt` -> its dry run over the attempt's whole sequence ->
 * `commitAndPresentStepSequence` -> `commitStepSequence`, against a mocked `ephemeraDB` leaf ---
 * the same harness as `objectContainmentInPayoff.integration.test.ts`, except that this test's
 * `transactWrite` mock writes each committed graph back into its store, so a second move sees the
 * first one's result at commit time as well as at plan time.
 *
 * Parse is skipped: `compileAttemptsFromSkeleton` resolves ids and nothing else, so it cannot
 * refuse a cycle either way. The attempt is built by hand, as `commitAttempt.test.ts`'s
 * `containmentAttempt` does, with the subject's source host read live at commit (`currentHost`).
 *
 * The harm asserted is reachability, not an infinite loop: `enumerateLudicCacheShards` guards with
 * a visited set, so a cycle does not hang it --- instead both objects drop out of the room's walk,
 * and so out of every candidate pool the player could name them from.
 */
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
const mockGetCurrentTimestamp = jest.fn()
jest.mock('../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: () => mockGetCurrentTimestamp(),
}))
jest.mock('../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { CommandAttempt } from './actions/commandAttempt'
import { commitAttempt } from './positions/manipulation/commitAttempt'
import { enumerateLudicCacheShards } from './positions/ludicCache/enumerateShards'
import { testLudicGraph } from './positions/ludicGraph/testFixtures'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const ROOM_ID = 'ROOM#TestRoom' as EphemeraRoomId
const BOX_ID = 'OBJECT#Box' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId

/** Stored `ludicGraph` payloads by host, updated by every successful commit. */
let storedByHost: Record<string, any>

const transactWriteMock = jest.fn(async (items: any[]): Promise<void> => {
    const multiKeyItem = items.find((item) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
    if (!multiKeyItem) {
        return
    }
    const draft: Record<string, any> = {}
    multiKeyItem.Keys.forEach((key: { EphemeraId: string; DataCategory: string }) => {
        const stored = storedByHost[key.EphemeraId]
        if (!stored) {
            throw new Error(`transactWriteMock: no seeded graph for footprint host ${key.EphemeraId}`)
        }
        draft[`${key.EphemeraId}#${key.DataCategory}`] = {
            EphemeraId: key.EphemeraId,
            DataCategory: key.DataCategory,
            ludicGraph: stored,
        }
    })
    multiKeyItem.reducer(draft)
    Object.values(draft).forEach((entry: any) => {
        storedByHost[entry.EphemeraId] = entry.ludicGraph
    })
})

const move = (subjectId: EphemeraObjectId, targetId: EphemeraObjectId) => commitAttempt({
    attempt: CommandAttempt.fromJSON({
        words: 'put the subject in the target',
        referents: [],
        actions: [{
            kind: 'position',
            id: 'action-1',
            desiredResult: {
                kind: 'change',
                primitive: 'transferMembership',
                object: { referentType: 'objectSpan', span: 'subject', stableRefKey: 'subject', groundedId: subjectId, shortName: subjectId },
                from: { referentType: 'currentHost', referentTarget: { referentType: 'objectSpan', span: 'subject', stableRefKey: 'subject', groundedId: subjectId, shortName: subjectId } },
                to: { referentType: 'objectSpan', span: 'target', stableRefKey: 'target', groundedId: targetId, shortName: targetId },
                containment: 'In',
            } as never,
            challenges: [],
        }],
        narrationUnits: [],
    }),
    characterId: CHARACTER_ID,
    messageBus: { publish: jest.fn() } as any,
    streamEvent: jest.fn().mockResolvedValue(undefined),
})

describe('object containment cycle (AB-63)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        let timestamp = 1_000_000_000_000
        mockGetCurrentTimestamp.mockImplementation(() => timestamp++)
        internalCache.clear()
        messageBus.clear()
        assetDBMock.getItems.mockResolvedValue([] as any)
        assetDBMock.query.mockResolvedValue([] as any)
        ephemeraDBMock.getItems.mockResolvedValue([] as any)

        storedByHost = {
            [ROOM_ID]: testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: BOX_ID },
                    { tag: 'Object', universalKey: CUP_ID },
                ],
                edges: [],
            }).toStored(),
            [BOX_ID]: testLudicGraph(BOX_ID, { nodes: [{ tag: 'Object', universalKey: BOX_ID }] }).toStored(),
            [CUP_ID]: testLudicGraph(CUP_ID, { nodes: [{ tag: 'Object', universalKey: CUP_ID }] }).toStored(),
        }
        ephemeraDBMock.getItem.mockImplementation(async ({ Key }: any) => {
            const stored = storedByHost[Key.EphemeraId]
            if (stored && (Key.DataCategory === 'Meta::Room' || Key.DataCategory === 'Meta::Object')) {
                return { ludicGraph: stored }
            }
            return undefined
        })
        ephemeraDBMock.transactWrite.mockImplementation(transactWriteMock)
        // The adjacency read's query leaf is not modelled here (as in `ropeLashedTakePayoff`): answer
        // "which hosts hold this id" from the live graphs instead, so the commit sees each move's result.
        jest.spyOn(internalCache.Positions, 'getMembershipContainers').mockImplementation(async (id) => {
            if (id === CHARACTER_ID) {
                return [ROOM_ID] as any
            }
            const containers: string[] = []
            for (const hostId of [ROOM_ID, BOX_ID, CUP_ID]) {
                if (hostId !== id && (await internalCache.Positions.getLudicGraph(hostId)).nodeIds.has(id)) {
                    containers.push(hostId)
                }
            }
            return containers as any
        })
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('refuses "put the box in the cup" while the cup is in the box', async () => {
        await move(CUP_ID, BOX_ID)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)
        expect((await internalCache.Positions.getLudicGraph(BOX_ID)).nodeIds.has(CUP_ID)).toBe(true)

        await move(BOX_ID, CUP_ID)

        const { hostIds } = await enumerateLudicCacheShards(ROOM_ID)
        expect(hostIds).toEqual(expect.arrayContaining([BOX_ID, CUP_ID]))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)
    })

    it('refuses "put the box in the box"', async () => {
        await move(BOX_ID, BOX_ID)

        const { hostIds } = await enumerateLudicCacheShards(ROOM_ID)
        expect(hostIds).toContain(BOX_ID)
        expect(ephemeraDBMock.transactWrite).not.toHaveBeenCalled()
    })
})
