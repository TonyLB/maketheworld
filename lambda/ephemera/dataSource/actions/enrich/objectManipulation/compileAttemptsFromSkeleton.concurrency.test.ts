/**
 * Payoff test for concurrent Identify (`internalCache.SpanEmbeddings`): a command whose fills segment
 * into several distinct spans starts every span's Bedrock embed before any returns, and spans that
 * differ only by a leading article or case share one call. Terminates at the observable: the embedder
 * calls in flight.
 *
 * The `internalCache` mock holds a real `SpanEmbeddingsCache`; only its embedder (the Bedrock call)
 * is replaced, with promises this test holds open.
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'
import { compileAttemptsFromSkeleton } from './compileAttemptsFromSkeleton'
import { tokenize } from '../../deterministicTemplate/granuleTokens'
import { COMMAND_GRANULES, planTokens } from './plan/planSkeleton'

import { embedObjectSpan } from '../../../../internalCache/spanEmbeddings/embedObjectSpan'

jest.mock('../../../../internalCache/spanEmbeddings/embedObjectSpan')
jest.mock('../../../../internalCache', () => {
    const { SpanEmbeddingsCache } = jest.requireActual('../../../../internalCache/spanEmbeddings')
    return { __esModule: true, default: { SpanEmbeddings: new SpanEmbeddingsCache() } }
})

const mockEmbed = embedObjectSpan as jest.Mock

const actor = 'CHARACTER#Tess' as EphemeraCharacterId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const teapotId = 'OBJECT#Teapot' as EphemeraObjectId

type Held = { span: string; release: () => void }

/** Each embed call returns a promise held open until released; `unavailable` is the sequential baseline's result. */
const holdEmbeds = () => {
    const held: Held[] = []
    mockEmbed.mockImplementation((span: string) => new Promise((resolve) => {
        held.push({ span, release: () => resolve({ success: false, errorMessage: 'embedding stubbed as unavailable' }) })
    }))
    return held
}

const compile = (command: string) => compileAttemptsFromSkeleton(
    {
        command,
        fills: planTokens(tokenize(COMMAND_GRANULES, command), command),
        characterId: actor,
        hostRoomId: roomId,
        roomObjectCatalog: [{ objectId: teapotId, normalizedShortName: 'teapot' }],
    },
    1,
    {
        positionsReadDeps: {
            getMembershipContainers: jest.fn(async () => []),
            getLudicGraph: jest.fn(async (hostId: string) => testLudicGraph(hostId as EphemeraRoomId)),
        },
    }
)

const flushMicrotasks = async () => {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve()
    }
}

describe('compileAttemptsFromSkeleton (concurrent Identify)', () => {
    beforeEach(() => {
        mockEmbed.mockReset()
        jest.requireMock('../../../../internalCache').default.SpanEmbeddings.clear()
    })

    it('starts every distinct span\'s embed before any is released', async () => {
        const held = holdEmbeds()

        const pending = compile('take cup from table')
        await flushMicrotasks()

        const started = held.map(({ span }) => span)
        expect(started).toEqual(expect.arrayContaining(['cup', 'table', 'cup from table']))
        expect(new Set(started).size).toBe(started.length)

        held.forEach(({ release }) => release())
        await expect(pending).resolves.toBeDefined()
    })

    it('shares one embed between spans that differ only by a leading article or case', async () => {
        const held = holdEmbeds()

        const pending = compile('take cup from the Cup')
        await flushMicrotasks()

        const started = held.map(({ span }) => span)
        expect(started.filter((span) => span === 'cup')).toHaveLength(1)

        held.forEach(({ release }) => release())
        await pending
    })

    it('reads the same result as when each embed returns immediately', async () => {
        const held = holdEmbeds()
        const concurrent = compile('take cup from table')
        await flushMicrotasks()
        held.forEach(({ release }) => release())
        const concurrentResult = await concurrent

        mockEmbed.mockReset()
        jest.requireMock('../../../../internalCache').default.SpanEmbeddings.clear()
        mockEmbed.mockResolvedValue({ success: false, errorMessage: 'embedding stubbed as unavailable' })

        expect(concurrentResult).toEqual(await compile('take cup from table'))
    })
})
