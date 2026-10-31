/**
 * Payoff test for the actor's cache (ISS8314, `AGENT.actorCache.planning.md`, Phase 1): an actor holding a bag with
 * a coin in it types `take coin from bag`, and the command grounds the coin and reaches its egress, the
 * `CommandAttempt` that `handleParseRequested` publishes as `Ludic Network Change Requested`.
 *
 * **Slice 2 turned it green.** The coin is a node of the bag's graph. The room walk never enters a character's shard, so the
 * coin used to be in no catalog. The one catalog is now read from the actor's cache, which folds the held bag, so the coin
 * grounds. The control case ("drop bag") runs the same harness, so a red `take coin from bag` is the missing coin, not a
 * broken harness.
 *
 * Harness copied from `phraseCoveragePayoff.integration.test.ts` (real `parseCommand` over seeded graphs, catalogs
 * built the way `loadCommandWorld` builds them from the same graphs); it stops at the parse result, which is the
 * attempt's last internal form before the bus.
 */
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'

import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { parseCommand } from './actions/parseCommand'
import { getActorWorld } from './actions/actorObjectCatalog'
import { catalogDepsFromColdBuild } from './actions/objectCatalogTestSupport'
import { EphemeraLudicGraph } from './positions/ludicGraph'
import { parentRemainderKey } from './positions/ludicGraph/testFixtures'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const ROOM_ID = 'ROOM#Parlour' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const BAG_ID = 'OBJECT#Bag' as EphemeraObjectId
const COIN_ID = 'OBJECT#Coin' as EphemeraObjectId

const names: Record<string, string> = { [TABLE_ID]: 'table', [BAG_ID]: 'bag', [COIN_ID]: 'coin' }

const covering = (...members: ([EphemeraObjectId, string?])[]) => ({
    members: members.map(([host, presence]) => ({ host, presence: (presence ?? 'PRESENCE#Base') as EphemeraPresenceNodeId })),
})
const binding = (key: string, parentHost: EphemeraMembershipHostId, parentPresence?: string, cover: ReturnType<typeof covering> = { members: [] }) => ({
    tag: 'Presence' as const,
    universalKey: key as EphemeraPresenceNodeId,
    fromHostPresences: [{ host: parentHost, presence: (parentPresence ?? parentRemainderKey(parentHost)) as EphemeraPresenceNodeId }],
    cover,
})
const rootBinding = (key: string, cover: ReturnType<typeof covering> = { members: [] }) => ({ tag: 'Presence' as const, universalKey: key as EphemeraPresenceNodeId, fromHostPresences: [], cover })

/** The room holds a table; the actor holds a bag; the coin is in the bag. The room's graph holds no character. */
const graphs: Record<string, EphemeraLudicGraph> = {
    [ROOM_ID]: EphemeraLudicGraph.empty(ROOM_ID)
        .addPresenceNode(rootBinding(parentRemainderKey(ROOM_ID), covering([TABLE_ID, 'PRESENCE#table-in-room'])))
        .addObject(TABLE_ID, 'In'),
    [CHARACTER_ID]: EphemeraLudicGraph.empty(CHARACTER_ID)
        .addPresenceNode(rootBinding('PRESENCE#Base', covering([BAG_ID, 'PRESENCE#bag-held'])))
        .addObject(BAG_ID, 'Held'),
    [TABLE_ID]: EphemeraLudicGraph.empty(TABLE_ID).addPresenceNode(binding('PRESENCE#table-in-room', ROOM_ID)),
    [BAG_ID]: EphemeraLudicGraph.empty(BAG_ID)
        .addPresenceNode(binding('PRESENCE#bag-held', CHARACTER_ID, 'PRESENCE#Base', covering([COIN_ID, 'PRESENCE#coin-in-bag'])))
        .addObject(COIN_ID, 'In'),
    [COIN_ID]: EphemeraLudicGraph.empty(COIN_ID).addPresenceNode(binding('PRESENCE#coin-in-bag', BAG_ID, 'PRESENCE#bag-held')),
}
const containers: Record<string, EphemeraMembershipHostId[]> = {
    [CHARACTER_ID]: [ROOM_ID], [TABLE_ID]: [ROOM_ID], [BAG_ID]: [CHARACTER_ID], [COIN_ID]: [BAG_ID],
}

const getComponentAggregate = async ([perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]) => {
    const shortName = names[perspective.universalKey]
    return shortName
        ? [mergedComponentResult({
            universalKey: perspective.universalKey as EphemeraObjectId,
            merged: new StandardObject({ tag: 'Object', shortName }),
            mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
        })]
        : []
}

describe('actor cache payoff: take from a held bag (integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        internalCache.clear()
        messageBus.clear()
        assetDBMock.getItems.mockResolvedValue([] as any)
        assetDBMock.query.mockResolvedValue([] as any)
        ephemeraDBMock.getItems.mockResolvedValue([] as any)
        ephemeraDBMock.getItem.mockResolvedValue(undefined as any)
        for (const [objectId, shortName] of Object.entries(names)) {
            internalCache.ImprovisationComponentData.set(objectId as EphemeraObjectId, IMPROVISATION_ASSET_ID, new StandardObject({ tag: 'Object', universalKey: objectId as EphemeraObjectId, shortName }))
        }
        jest.spyOn(internalCache.SpanEmbeddings, 'get').mockResolvedValue({ success: false })
        jest.spyOn(internalCache.Positions, 'getMembershipContainers').mockImplementation(async (id) => containers[id] ?? [])
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    /** The real `parseCommand`; the one catalog as `loadCommandWorld` builds it, from the actor's cache (the table in the room, the bag in hand, the coin in the bag). */
    const parse = async (command: string) => {
        const { entries: objectCatalog, actorCache } = await getActorWorld(CHARACTER_ID, {
            ...catalogDepsFromColdBuild({
                getLudicGraph: async (hostId) => graphs[hostId] ?? EphemeraLudicGraph.empty(hostId),
                getComponentAggregate: getComponentAggregate as any,
            }),
            getMembershipContainers: async (id) => containers[id] ?? [],
        })
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({ success: true, body: '{"type":"Command","confidence":0.9}' })
        const parseResult = await parseCommand(
            {
                command,
                characterId: CHARACTER_ID,
                hostRoomId: ROOM_ID,
                objectCatalog,
                actorCache,
            },
            {
                invokeBedrockParseCommandImpl,
                objectManipulationPositionsReadDeps: {
                    getMembershipContainers: jest.fn().mockImplementation(async (id: string) => containers[id] ?? []),
                    getLudicGraph: jest.fn().mockImplementation(async (hostId: string) => graphs[hostId] ?? EphemeraLudicGraph.empty(hostId as EphemeraMembershipHostId)),
                },
            }
        )
        return { parseResult, invokeBedrockParseCommandImpl }
    }

    it('control: "drop bag", the bag held, is an attempt that names the bag (the harness works, a direct member is found)', async () => {
        const { parseResult } = await parse('drop bag')

        expect(parseResult).toEqual(expect.objectContaining({ type: 'CommandAttempt' }))
        expect(JSON.stringify(parseResult)).toContain(BAG_ID)
    })

    it('"take coin from bag", the bag held with the coin in it, grounds the coin and reaches the egress attempt', async () => {
        const { parseResult } = await parse('take coin from bag')

        expect(parseResult).toEqual(expect.objectContaining({ type: 'CommandAttempt' }))
        expect(JSON.stringify(parseResult)).toContain(COIN_ID)
    })
})
