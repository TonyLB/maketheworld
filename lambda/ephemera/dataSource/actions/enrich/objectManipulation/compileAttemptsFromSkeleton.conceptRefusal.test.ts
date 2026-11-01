/**
 * The name-only Concept refusal (AK-8, option B; `actions/AGENT.contract.md`): a span that names a Concept and
 * matches nothing physical answers an Error, not an Abstain that climbs the ladder.
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../../../internalCache'
import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'
import { compileAttemptsFromSkeleton } from './compileAttemptsFromSkeleton'
import { conceptErrorMessages } from './conceptRefusal'
import type { ParseSkeleton } from './parse/parseToken'
import { planSkeleton } from './plan/attemptTemplateFixture'
import { containersCache, scopedCatalog } from '../../objectCatalogTestSupport'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: { SpanEmbeddings: { get: jest.fn() } },
}))

const mockGet = internalCache.SpanEmbeddings.get as jest.Mock

beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ success: false, errorMessage: 'embedding stubbed as unavailable' })
})

const roomId = 'ROOM#Ring' as EphemeraRoomId
const actor = 'CHARACTER#Tess' as EphemeraCharacterId
const terminalId = 'OBJECT#Terminal' as EphemeraObjectId
const lookalikeId = 'OBJECT#ControlSystem' as EphemeraObjectId

const takeSkeleton = (span: string): ParseSkeleton => [
    { type: 'text', text: 'get' },
    { type: 'objectSpan', span, stableRefKey: 'subjectRef' },
]

const lookSkeleton = (span: string): ParseSkeleton => [
    { type: 'text', text: 'look at' },
    { type: 'objectSpan', span, stableRefKey: 'subjectRef' },
]

const compile = (
    skeleton: ParseSkeleton,
    command: string,
    catalog: { objectId: EphemeraObjectId; normalizedShortName: string }[],
    conceptNames: string[] = ['habitat control system']
) => compileAttemptsFromSkeleton(
    {
        command,
        fills: planSkeleton(skeleton, command).fills,
        characterId: actor,
        hostRoomId: roomId,
        objectCatalog: scopedCatalog(catalog),
        actorCache: { ...containersCache(() => [roomId]), conceptNames: () => conceptNames },
    },
    0.9,
    { positionsReadDeps: {
        getMembershipContainers: jest.fn(async () => [roomId] as any),
        getLudicGraph: jest.fn(async (hostId: string) => testLudicGraph(hostId as EphemeraRoomId)),
    } }
)

const terminal = { objectId: terminalId, normalizedShortName: 'terminal' }

describe('the Concept refusal', () => {
    it('refuses a take of a Concept by name', async () => {
        const result = await compile(takeSkeleton('habitat control system'), 'get habitat control system', [terminal])
        expect(result).toEqual({ type: 'Error', errorMessage: conceptErrorMessages.notPhysical })
    })

    it('reads the name with its leading article peeled', async () => {
        const result = await compile(takeSkeleton('the habitat control system'), 'get the habitat control system', [terminal])
        expect(result).toMatchObject({ type: 'Error', errorMessage: conceptErrorMessages.notPhysical })
    })

    it('refuses a look at a Concept: it is not a command, only a courteous refusal (AK-9)', async () => {
        const result = await compile(lookSkeleton('the habitat control system'), 'look at the habitat control system', [terminal])
        expect(result).toMatchObject({ type: 'Error', errorMessage: conceptErrorMessages.notPhysical })
    })

    it('refuses when the room holds nothing physical to name (the empty-catalog path)', async () => {
        const result = await compile(takeSkeleton('habitat control system'), 'get habitat control system', [])
        expect(result).toMatchObject({ type: 'Error', errorMessage: conceptErrorMessages.notPhysical })
    })

    it('still abstains on a name that is no Concept', async () => {
        const result = await compile(takeSkeleton('rocket skates'), 'get rocket skates', [terminal])
        expect(result.type).toBe('Abstain')
    })

    it('still abstains when the cache holds no Concept (a stale binding gone, or none reached)', async () => {
        const result = await compile(takeSkeleton('habitat control system'), 'get habitat control system', [terminal], [])
        expect(result.type).toBe('Abstain')
    })

    it('lets a real object win over a Concept of the same name', async () => {
        const result = await compile(
            takeSkeleton('habitat control system'),
            'get habitat control system',
            [{ objectId: lookalikeId, normalizedShortName: 'habitat control system' }]
        )
        expect(result).toMatchObject({ type: 'CommandAttempt' })
    })
})
