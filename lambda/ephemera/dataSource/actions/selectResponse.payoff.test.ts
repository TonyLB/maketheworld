import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { ephemeraActionsDataSource } from './index'
import messageBus from '../../messageBus'
import internalCache from '../../internalCache'
import { getRoomExitTargetsForCharacter } from './roomExitTargetsForCharacter'
import { getHeldInventoryCatalogForCharacter } from './heldInventoryCatalogForCharacter'
import { getRoomObjectCatalogForCharacter } from './roomObjectCatalogForCharacter'
import { collectCoyoteOccupiedStableKeys } from './stableKey/collectCoyoteOccupiedStableKeys'
import { testLudicGraph } from '../positions/ludicGraph/testFixtures'
import { applyOptimisticUpdate } from './persistentCommand/testFixtures'

/**
 * The select-response payoff: "get cup" over a room with two cups, through the real parse, producer,
 * row store, answer reducer and resume. Only the leaves are faked: the table, the world readers,
 * the bus and the stream. The commit is observed as the `Ludic Network Change Requested` event the
 * take leaves this lambda with; its consumer lives in another data source and has no cross-lambda
 * harness, so the loop is proven up to that hop.
 */

// Names prefixed `mock` may be referenced from a hoisted factory.
const mockTable = new Map<string, string>()
const mockKeyOf = (key: { EphemeraId: string; DataCategory: string }) => `${key.EphemeraId}|${key.DataCategory}`
// The JSON round trips mimic Dynamo's marshalling (drops `undefined` fields).
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    // The other tables are bound at load by the caches; nothing here reads them.
    assetDB: { _client: {} },
    ephemeraDB: {
        // Modules bind the table's client at load; the fake never sends through it.
        _client: {},
        putItem: async (item: any) => { mockTable.set(mockKeyOf(item), JSON.stringify(item)) },
        getItem: async ({ Key }: any) => {
            const raw = mockTable.get(mockKeyOf(Key))
            return raw === undefined ? undefined : JSON.parse(raw)
        },
        optimisticUpdate: async (props: any) => {
            const raw = mockTable.get(mockKeyOf(props.Key))
            const { next, returned } = await jest.requireActual('./persistentCommand/testFixtures')
                .applyOptimisticUpdate(raw === undefined ? undefined : JSON.parse(raw), props)
            if (next) {
                mockTable.set(mockKeyOf(props.Key), JSON.stringify({ ...props.Key, ...next }))
            }
            return returned
        },
        deleteItem: async (key: any) => { mockTable.delete(mockKeyOf(key)) },
    },
}))
jest.mock('../../messageBus')
jest.mock('../../internalCache')
jest.mock('./roomExitTargetsForCharacter', () => ({
    ...(jest.requireActual('./roomExitTargetsForCharacter') as object),
    getRoomExitTargetsForCharacter: jest.fn(),
}))
jest.mock('./roomObjectCatalogForCharacter', () => ({
    getRoomObjectCatalogForCharacter: jest.fn(),
    roomObjectLabelsFromCatalog: jest.requireActual('./roomObjectCatalogForCharacter').roomObjectLabelsFromCatalog,
}))
jest.mock('./heldInventoryCatalogForCharacter', () => ({ getHeldInventoryCatalogForCharacter: jest.fn() }))
jest.mock('./stableKey/collectCoyoteOccupiedStableKeys', () => ({ collectCoyoteOccupiedStableKeys: jest.fn() }))
jest.mock('../perception/subscribedEvents', () => ({
    ...(jest.requireActual('../perception/subscribedEvents') as object),
    sendPerceptionThreadRegistered: jest.fn(),
}))
jest.mock('../renderOrchestration/subscribedEvents', () => ({
    ...(jest.requireActual('../renderOrchestration/subscribedEvents') as object),
    sendRenderRequested: jest.fn(),
}))

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('select response payoff: an ambiguous take is asked, answered and committed', () => {
    const characterId = 'CHARACTER#Tess'
    const sessionId = 'SESSION-A'
    const roomId = 'ROOM#Bridge' as EphemeraRoomId
    const redCupId = 'OBJECT#RedCup' as EphemeraObjectId
    const blueCupId = 'OBJECT#BlueCup' as EphemeraObjectId
    const cupIds = [redCupId, blueCupId]

    const published = () => mockMessageBus.publish.mock.calls.map(([call]) => call as any)
    const transcriptRevisions = () => published().filter(({ displayProtocol }) => displayProtocol === 'CommandTranscriptMessage')

    const receive = async (type: string, content: Record<string, unknown>, streamEvent: jest.Mock) => {
        await ephemeraActionsDataSource.receiveEvents!({
            events: [{
                header: { dataSourceKey: 'api.ephemera', streamKey: characterId, timestamp: Date.now(), type },
                getContent: async () => ({ characterId, sessionId, ...content }),
            }] as any,
            streamEvent,
            streamEnvelope: jest.fn(async () => {}),
        } as any)
    }
    const getCup = (streamEvent: jest.Mock) => receive('Parse Requested', { command: 'get cup' }, streamEvent)
    const answer = (messageId: string, optionId: string, streamEvent: jest.Mock) => receive('Answer Submitted', { messageId, optionId }, streamEvent)
    const takes = (streamEvent: jest.Mock): string[][] => streamEvent.mock.calls
        .map(([event]) => event)
        .filter((event) => event.header.type === 'Ludic Network Change Requested')
        .map((event) => event.update.attempt.referents.map(({ id }: { id: string }) => id))

    /** Asks the question, then answers it with the option at `index`. */
    const askThenAnswer = async (index: number) => {
        const streamEvent = jest.fn(async () => {})
        await getCup(streamEvent)
        const select = transcriptRevisions().find(({ outcome }) => outcome?.Kind === 'Select')
        const optionId = select.outcome.Options[index].OptionId
        mockMessageBus.publish.mockClear()
        await answer(select.messageId, optionId, streamEvent)
        return { streamEvent, select, optionId }
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockTable.clear()
        mockMessageBus.publish.mockReturnValue(undefined)
        ;(getRoomExitTargetsForCharacter as jest.Mock).mockResolvedValue({ fromRoomId: roomId, toRoomIds: [], exits: [] })
        ;(getRoomObjectCatalogForCharacter as jest.Mock).mockResolvedValue({
            roomId,
            entries: cupIds.map((objectId) => ({ objectId, normalizedShortName: 'cup' })),
        })
        ;(getHeldInventoryCatalogForCharacter as jest.Mock).mockResolvedValue({ entries: [] })
        ;(collectCoyoteOccupiedStableKeys as jest.Mock).mockResolvedValue(new Set<string>())
        internalCacheMock.ObjectEmbedding.get.mockResolvedValue({})
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue([roomId])
        internalCacheMock.Positions.getLudicGraph.mockImplementation(async (hostId: any) => testLudicGraph(hostId, {
            nodes: hostId === roomId ? cupIds.map((universalKey) => ({ tag: 'Object' as const, universalKey })) : [],
        }))
    })

    it('asks which cup on the command\'s own bubble and commits nothing yet', async () => {
        const streamEvent = jest.fn(async () => {})
        await getCup(streamEvent)

        const [echo, select, ...rest] = transcriptRevisions()
        expect(rest).toEqual([])
        expect(echo.outcome).toBeUndefined()
        expect(select.messageId).toBe(echo.messageId)
        expect(select.sessionId).toBe(sessionId)
        expect(select.message).toEqual(['get cup'])
        expect(select.outcome.Kind).toBe('Select')
        expect(select.outcome.Options).toHaveLength(2)
        expect(takes(streamEvent)).toEqual([])
    })

    it.each([0, 1])('commits the take of the cup that option %i stands for, and clears the Select', async (index) => {
        const { streamEvent, select } = await askThenAnswer(index)

        expect(takes(streamEvent)).toHaveLength(1)
        expect(transcriptRevisions()).toEqual([expect.objectContaining({ messageId: select.messageId, message: ['get cup'] })])
        expect(transcriptRevisions()[0].outcome).toBeUndefined()
    })

    it('maps the two options to the two different cups', async () => {
        const first = await askThenAnswer(0)
        mockTable.clear()
        const second = await askThenAnswer(1)

        const [firstTaken] = takes(first.streamEvent)
        const [secondTaken] = takes(second.streamEvent)
        expect(firstTaken).toHaveLength(1)
        expect(secondTaken).toHaveLength(1)
        expect(firstTaken[0]).not.toBe(secondTaken[0])
        expect(cupIds).toContain(firstTaken[0])
        expect(cupIds).toContain(secondTaken[0])
    })

    it('ignores a second answer to the same question, whichever option it names', async () => {
        const { streamEvent, select } = await askThenAnswer(0)
        mockMessageBus.publish.mockClear()

        await answer(select.messageId, select.outcome.Options[0].OptionId, streamEvent)
        await answer(select.messageId, select.outcome.Options[1].OptionId, streamEvent)

        expect(takes(streamEvent)).toHaveLength(1)
        expect(published()).toEqual([])
    })

    it('tells the player the choice is gone when a new command has overwritten the question', async () => {
        const streamEvent = jest.fn(async () => {})
        await getCup(streamEvent)
        const stale = transcriptRevisions().find(({ outcome }) => outcome?.Kind === 'Select')
        // A second "get cup" asks a fresh question in the same row, on a new bubble, with fresh option ids.
        await getCup(streamEvent)
        mockMessageBus.publish.mockClear()

        await answer(stale.messageId, stale.outcome.Options[0].OptionId, streamEvent)

        expect(takes(streamEvent)).toEqual([])
        // The old bubble is not the row's, so the client-supplied messageId is not trusted and the line goes out of character.
        expect(published()).toEqual([expect.objectContaining({ displayProtocol: 'WorldOOCMessage', message: ['That choice is no longer available.'] })])
    })
})
