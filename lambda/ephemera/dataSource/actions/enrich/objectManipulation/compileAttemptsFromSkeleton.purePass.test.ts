/**
 * Payoff test for the pure pass (`actions/AGENT.contract.md` "Qualifier", "The pure pass"): a span that is
 * an ordered word subsequence of a name grounds by the lexical channel alone, so `SpanEmbeddings.get`
 * (the Bedrock call) is never made. It terminates at the observable: the result and the embed calls.
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../../../internalCache'
import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'
import type { PersistentCommandPayload } from '../../persistentCommand/payload'
import { resumePersistentCommand } from '../../persistentCommand/resume'
import { compileAttemptsFromSkeleton } from './compileAttemptsFromSkeleton'
import type { ParseSkeleton } from './parse/parseToken'
import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import { makeEmbeddingFromAxis } from './embeddingMatch/testing/mockVectors'
import { planSkeleton } from './plan/attemptTemplateFixture'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: { SpanEmbeddings: { get: jest.fn() } },
}))

const mockGet = internalCache.SpanEmbeddings.get as jest.Mock

beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ success: false, errorMessage: 'embedding stubbed as unavailable' })
})

const roomId = 'ROOM#Bridge' as EphemeraRoomId
const actor = 'CHARACTER#Tess' as EphemeraCharacterId
const redCupId = 'OBJECT#RedCup' as EphemeraObjectId
const blueCupId = 'OBJECT#BlueCup' as EphemeraObjectId
const switchId = 'OBJECT#LightSwitch' as EphemeraObjectId
const lampId = 'OBJECT#Lamp' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId

const entry = (objectId: EphemeraObjectId, normalizedShortName: string, embedding?: SemanticEmbedding) => ({ objectId, normalizedShortName, ...(embedding !== undefined ? { embedding } : {}) })

const readsWith = (hostsOf: Record<string, EphemeraRoomId[] | string[]> = {}) => ({
    getMembershipContainers: jest.fn(async (id: string) => (hostsOf[id] ?? [roomId]) as any),
    getLudicGraph: jest.fn(async (hostId: string) => testLudicGraph(hostId as EphemeraRoomId)),
})

const takeSkeleton = (span: string): ParseSkeleton => [
    { type: 'text', text: 'get' },
    { type: 'objectSpan', span, stableRefKey: 'subjectRef' },
]

const takeFrom = (span: string, host: string): ParseSkeleton => [
    { type: 'text', text: 'take' },
    { type: 'objectSpan', span, stableRefKey: 'subjectRef' },
    { type: 'text', text: 'from' },
    { type: 'objectSpan', span: host, stableRefKey: 'hostRef' },
]

const compile = (
    skeleton: ParseSkeleton,
    command: string,
    catalog: ReturnType<typeof entry>[],
    extra: { startPass?: 'pure' | 'full'; answers?: { referentAnswers: Record<string, string> } } = {},
    reads = readsWith()
) => compileAttemptsFromSkeleton(
    { command, fills: planSkeleton(skeleton, command).fills, characterId: actor, hostRoomId: roomId, roomObjectCatalog: catalog, ...extra },
    0.9,
    { positionsReadDeps: reads }
)

const takenObjectOf = (result: { type: string; attempt?: unknown }): any => {
    const actions = (result.attempt as { actions: { desiredResult?: any }[] }).actions
    return actions[actions.length - 1]?.desiredResult?.object?.groundedId
}

describe('compileAttemptsFromSkeleton pure pass', () => {
    it('takes the red cup for "get cup" with no embed', async () => {
        const result = await compile(takeSkeleton('cup'), 'get cup', [entry(redCupId, 'red cup')])

        expect(result.type).toBe('CommandAttempt')
        expect(takenObjectOf(result)).toBe(redCupId)
        expect(mockGet).not.toHaveBeenCalled()
    })

    it('consults between a red and a blue cup with no embed', async () => {
        const result = await compile(takeSkeleton('cup'), 'get cup', [entry(redCupId, 'red cup'), entry(blueCupId, 'blue cup')])

        expect(result).toMatchObject({ type: 'Consult', pass: 'pure' })
        expect((result as any).alternatives).toHaveLength(2)
        expect(mockGet).not.toHaveBeenCalled()
    })

    it('takes the light switch for "get light", where the lamp is not scored (the literal-name policy)', async () => {
        const result = await compile(takeSkeleton('light'), 'get light', [entry(switchId, 'light switch'), entry(lampId, 'lamp')])

        expect(result.type).toBe('CommandAttempt')
        expect(takenObjectOf(result)).toBe(switchId)
        expect(mockGet).not.toHaveBeenCalled()
    })

    it.each([
        ['get cup red', 'cup red'],
        ['get mug', 'mug'],
    ])('runs the full pass, and embeds, for "%s" with a red cup', async (command, span) => {
        await compile(takeSkeleton(span), command, [entry(redCupId, 'red cup')])

        expect(mockGet).toHaveBeenCalled()
    })

    it('falls through to the full pass when the pure reading is refused by the dry run, and answers as the full pass alone does', async () => {
        const cupEmbedding = makeEmbeddingFromAxis(0)
        const run = (startPass?: 'full') => compile(
            takeFrom('cup', 'table'),
            'take cup from table',
            [entry(redCupId, 'red cup', cupEmbedding), entry(tableId, 'table')],
            startPass === undefined ? {} : { startPass },
            // The table holds no cup, so the pure reading (cup, table) is illegal.
            readsWith({ [redCupId]: [roomId], [tableId]: [roomId] })
        )
        mockGet.mockResolvedValue({ success: true, embedding: cupEmbedding })
        const fullOnly = await run('full')
        mockGet.mockClear()

        const result = await run()

        expect(mockGet).toHaveBeenCalled()
        const desiredOf = (r: any) => r.attempt.actions.map((action: any) => action.desiredResult)
        expect(result.type).toBe(fullOnly.type)
        expect(desiredOf(result)).toEqual(desiredOf(fullOnly))
    })

    describe('resume', () => {
        const command = 'get cup'
        const skeleton = takeSkeleton('cup')
        const twoCups = [entry(redCupId, 'red cup'), entry(blueCupId, 'blue cup')]

        const consulted = async () => {
            const result = await compile(skeleton, command, twoCups)
            if (result.type !== 'Consult' || !result.root) {
                throw new Error('expected a Consult with a frozen root')
            }
            return { root: result.root, pass: result.pass, answers: result.alternatives[0]!.referentAnswers! }
        }
        const rowFor = (root: PersistentCommandPayload['root'], answers: Record<string, string>, pass?: 'pure' | 'full'): PersistentCommandPayload => ({
            root,
            ...(pass !== undefined ? { pass } : {}),
            referentAnswers: answers,
            challengeAnswers: {},
        })
        const world = (catalog: ReturnType<typeof entry>[]) => ({ characterId: actor, hostRoomId: roomId, roomObjectCatalog: catalog })

        it('answers a pure Consult without an embed', async () => {
            const { root, pass, answers } = await consulted()
            expect(pass).toBe('pure')

            const result = await resumePersistentCommand(rowFor(root, answers, pass), world(twoCups), { positionsReadDeps: readsWith() })

            expect(result.type).toBe('CommandAttempt')
            expect(takenObjectOf(result)).toBe(redCupId)
            expect(mockGet).not.toHaveBeenCalled()
        })

        it.each([['full', 'full' as const], ['no pass', undefined]])('starts at the full pass for a payload with %s', async (_label, pass) => {
            const { root, answers } = await consulted()

            await resumePersistentCommand(rowFor(root, answers, pass), world(twoCups), { positionsReadDeps: readsWith() })

            expect(mockGet).toHaveBeenCalled()
        })

        it('falls through to the full pass when the world changed so the pure pass no longer succeeds', async () => {
            const { root, pass, answers } = await consulted()

            await resumePersistentCommand(rowFor(root, answers, pass), world([entry(redCupId, 'teapot'), entry(blueCupId, 'kettle')]), { positionsReadDeps: readsWith() })

            expect(mockGet).toHaveBeenCalled()
        })
    })
})
