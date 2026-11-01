/**
 * Payoff test for the Concept kind (ISS8349, AK-8 option B): a room holds a terminal and the Concept it is associated
 * with ("habitat control system"). The Concept is internal reasoning structure, not a player-facing thing:
 *
 * - the room affordance header lists the terminal and not the Concept;
 * - `take terminal` is an ordinary attempt (the physical member under a Concept is still a thing);
 * - `take habitat control system` is refused with the kind-aware wording, an Error that answers where it stands and
 *   never climbs to the classifier.
 *
 * Graphs are built directly, as Slice 3's tests build them: asset mode refuses a Concept (LG-7) until producers exist.
 * Harness copied from `actorCacheTakeFromBagPayoff.integration.test.ts`.
 */
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId, EphemeraConceptId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'

import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { parseCommand } from './actions/parseCommand'
import { conceptErrorMessages } from './actions/enrich/objectManipulation/conceptRefusal'
import { getActorCache } from './actions/actorObjectCatalog'
import { catalogDepsFromColdBuild } from './actions/objectCatalogTestSupport'
import { EphemeraLudicGraph } from './positions/ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from './positions/ludicGraph/testFixtures'
import { buildLudicCache } from './positions/ludicCache/fold'
import { ludicCacheRoomObjectContents } from './positions/ludicCache/roomObjectContents'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const ROOM_ID = 'ROOM#DockingRing' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Tester' as EphemeraCharacterId
const SYSTEM_ID = 'CONCEPT#HabitatControlSystem' as EphemeraConceptId
const TERMINAL_ID = 'OBJECT#Terminal' as EphemeraObjectId

const names: Record<string, string> = { [SYSTEM_ID]: 'habitat control system', [TERMINAL_ID]: 'terminal' }

/** AK-3's stored shape: the room hosts the terminal (`In`) and the Concept (`Associated`); the Concept hosts the terminal (`Associated`). */
const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
    [ROOM_ID, testLudicGraph(ROOM_ID, {
        nodes: [
            { tag: 'Room', universalKey: ROOM_ID },
            { tag: 'Concept', universalKey: SYSTEM_ID, hostingKind: 'Associated' },
            { tag: 'Object', universalKey: TERMINAL_ID, hostingKind: 'In' },
            presenceBindingNode(parentRemainderKey(ROOM_ID), undefined, { members: [
                { host: SYSTEM_ID, presence: 'PRESENCE#here' as any },
                { host: TERMINAL_ID, presence: 'PRESENCE#Base' as any },
            ] }),
        ],
    })],
    [SYSTEM_ID, testLudicGraph(SYSTEM_ID, {
        nodes: [
            { tag: 'Concept', universalKey: SYSTEM_ID },
            { tag: 'Object', universalKey: TERMINAL_ID, hostingKind: 'Associated' },
            presenceBindingNode('Base'),
            presenceBindingNode('here', ROOM_ID, { members: [{ host: TERMINAL_ID, presence: 'PRESENCE#assoc' as any }] }),
        ],
    })],
    [TERMINAL_ID, testLudicGraph(TERMINAL_ID, {
        nodes: [
            { tag: 'Object', universalKey: TERMINAL_ID },
            presenceBindingNode('Base', ROOM_ID),
            presenceBindingNode('assoc', { host: SYSTEM_ID, presence: 'PRESENCE#here' as any }),
        ],
    })],
])
const containers: Record<string, EphemeraMembershipHostId[]> = { [CHARACTER_ID]: [ROOM_ID], [TERMINAL_ID]: [ROOM_ID] }

const getLudicGraph = async (hostId: EphemeraMembershipHostId) => graphs.get(hostId) ?? EphemeraLudicGraph.empty(hostId)

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

describe('Concept kind payoff: the header omits it, a command on it is refused (integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        internalCache.clear()
        messageBus.clear()
        assetDBMock.getItems.mockResolvedValue([] as any)
        assetDBMock.query.mockResolvedValue([] as any)
        ephemeraDBMock.getItems.mockResolvedValue([] as any)
        ephemeraDBMock.getItem.mockResolvedValue(undefined as any)
        internalCache.ImprovisationComponentData.set(TERMINAL_ID, IMPROVISATION_ASSET_ID, new StandardObject({ tag: 'Object', universalKey: TERMINAL_ID, shortName: 'terminal' }))
        jest.spyOn(internalCache.SpanEmbeddings, 'get').mockResolvedValue({ success: false })
        jest.spyOn(internalCache.Positions, 'getMembershipContainers').mockImplementation(async (id) => containers[id] ?? [])
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    const parse = async (command: string) => {
        const actorCache = await getActorCache(CHARACTER_ID, {
            ...catalogDepsFromColdBuild({ getLudicGraph, getComponentAggregate: getComponentAggregate as any }),
            getMembershipContainers: async (id) => containers[id] ?? [],
        })
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({ success: true, body: '{"type":"Command","confidence":0.9}' })
        const parseResult = await parseCommand(
            { command, characterId: CHARACTER_ID, hostRoomId: ROOM_ID, objectCatalog: actorCache?.entries() ?? [], actorCache },
            {
                invokeBedrockParseCommandImpl,
                objectManipulationPositionsReadDeps: {
                    getMembershipContainers: jest.fn().mockImplementation(async (id: string) => containers[id] ?? []),
                    getLudicGraph: jest.fn().mockImplementation(getLudicGraph),
                },
            }
        )
        return { parseResult, invokeBedrockParseCommandImpl }
    }

    it('control: "take terminal", the physical member of the Concept, is an attempt that names the terminal', async () => {
        const { parseResult } = await parse('take terminal')

        expect(parseResult).toEqual(expect.objectContaining({ type: 'CommandAttempt' }))
        expect(JSON.stringify(parseResult)).toContain(TERMINAL_ID)
    })

    it('the room affordance header lists the terminal and not the Concept', async () => {
        const { objects } = await ludicCacheRoomObjectContents(ROOM_ID, ['ASSET#viewer'], {
            readLudicCache: async (roomId) => ({
                cache: (await buildLudicCache(roomId, [], { getLudicGraph, getComponentAggregate: getComponentAggregate as any })).cache,
                outcome: 'hit' as const,
            }),
            getComponentAggregate: getComponentAggregate as any,
        })

        expect(objects).toEqual([{ objectId: TERMINAL_ID, shortName: 'terminal', contents: [] }])
    })

    it('"take habitat control system" is refused as not a physical thing, an Error that does not climb', async () => {
        const { parseResult } = await parse('take habitat control system')

        expect(parseResult).toEqual(expect.objectContaining({ type: 'Error', errorMessage: conceptErrorMessages.notPhysical }))
    })
})
