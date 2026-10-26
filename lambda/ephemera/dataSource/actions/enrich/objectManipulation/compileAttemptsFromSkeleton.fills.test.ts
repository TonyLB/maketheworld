import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'
import { compileAttemptsFromSkeleton, type SkeletonFill } from './compileAttemptsFromSkeleton'
import type { ParseTokenDraft } from './parse/parseToken'
import { tokenize } from '../../deterministicTemplate/granuleTokens'
import { sameSegmentation } from './plan/attemptTemplateFixture'
import { PLAN_GRANULES, planTokens } from './plan/planSkeleton'
import type { ResumeAnswers } from './resumeAnswers'

const actor = 'CHARACTER#Tess' as EphemeraCharacterId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const manInTheMoonId = 'OBJECT#ManInTheMoon' as EphemeraObjectId
const manId = 'OBJECT#Man' as EphemeraObjectId
const moonId = 'OBJECT#Moon' as EphemeraObjectId
const cupId = 'OBJECT#Cup' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId

const text = (value: string): ParseTokenDraft => ({ type: 'text', text: value })
const span = (value: string): ParseTokenDraft => ({ type: 'objectSpan', span: value })

/**
 * Plan's fills for a command, as parseCommand hands them to the producer, checked to be exactly
 * the segmentations listed (in any order).
 */
const fillsOf = (command: string, drafts: ParseTokenDraft[][]): SkeletonFill[] => {
    const fills = planTokens(tokenize(PLAN_GRANULES, command), command)
    expect(fills).toHaveLength(drafts.length)
    expect(drafts.every((draft) => fills.some(({ skeleton }) => sameSegmentation(skeleton, draft)))).toBe(true)
    return fills
}

const compile = (
    command: string,
    drafts: ParseTokenDraft[][],
    catalog: [EphemeraObjectId, string][],
    hostsOf: Record<string, EphemeraMembershipHostId[]>,
    answers?: ResumeAnswers
) => compileAttemptsFromSkeleton(
    {
        command,
        fills: fillsOf(command, drafts),
        characterId: actor,
        hostRoomId: roomId,
        roomObjectCatalog: catalog.map(([objectId, normalizedShortName]) => ({ objectId, normalizedShortName })),
        ...(answers ? { answers } : {}),
    },
    1,
    {
        embedSpan: jest.fn().mockResolvedValue({ success: false, errorMessage: 'embedding stubbed as unavailable' }),
        positionsReadDeps: {
            getMembershipContainers: jest.fn(async (id: string) => hostsOf[id] ?? []),
            getLudicGraph: jest.fn(async (hostId: string) => testLudicGraph(hostId as EphemeraRoomId)),
        },
    }
)

/** The object a take moves: its last action's transfer. */
const movedId = (result: { type: string; attempt?: unknown }): unknown => {
    const actions = (result.attempt as { actions: { desiredResult?: { object?: { groundedId?: unknown } } }[] }).actions
    return actions[actions.length - 1]?.desiredResult?.object?.groundedId
}

describe('compileAttemptsFromSkeleton (several fills)', () => {
    const takeManInTheMoonFromTable = [
        [text('take'), span('man in the moon from table')],
        [text('take'), span('man'), text('in'), span('the moon from table')],
        [text('take'), span('man in the moon'), text('from'), span('table')],
        [text('take'), span('man'), text('in'), span('the moon'), text('from'), span('table')],
    ]

    it('takes the man in the moon from the table: the fill whose spans all match exactly is read', async () => {
        const result = await compile(
            'take man in the moon from table',
            takeManInTheMoonFromTable,
            [[manInTheMoonId, 'man in the moon'], [moonId, 'moon'], [tableId, 'table']],
            { [manInTheMoonId]: [tableId], [moonId]: [roomId], [tableId]: [roomId] }
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 1 })
        expect(movedId(result)).toBe(manInTheMoonId)
    })

    it('judges each attempt against its own fill: an uncut fill that reads its one span is not dropped for another fill\'s spans', async () => {
        const result = await compile(
            'take man in the moon',
            [[text('take'), span('man in the moon')], [text('take'), span('man'), text('in'), span('the moon')]],
            [[manInTheMoonId, 'man in the moon']],
            { [manInTheMoonId]: [roomId] }
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 1 })
        expect(movedId(result)).toBe(manInTheMoonId)
    })

    it('answers with the exact fill\'s refusal, not a legal fuzzy reading of a longer span (the exact-fill bridge)', async () => {
        const result = await compile(
            'take cup from table',
            [[text('take'), span('cup from table')], [text('take'), span('cup'), text('from'), span('table')]],
            [[cupId, 'cup'], [tableId, 'table']],
            { [cupId]: [roomId], [tableId]: [roomId] }
        )

        expect(result).toEqual({ type: 'Error', errorMessage: 'The table has no cup.' })
    })

    describe('two exact fills that mean different things', () => {
        const takeManInTheMoon = [[text('take'), span('man in the moon')], [text('take'), span('man'), text('in'), span('the moon')]]
        // The moon's name drops the article the span keeps, so the cut fill's option reads differently.
        const catalog: [EphemeraObjectId, string][] = [[manInTheMoonId, 'man in the moon'], [manId, 'man'], [moonId, 'moon']]
        const hosts = { [manInTheMoonId]: [roomId], [manId]: [moonId], [moonId]: [roomId] } as Record<string, EphemeraMembershipHostId[]>

        it('asks, each option worded from its own fill', async () => {
            const result = await compile('take man in the moon', takeManInTheMoon, catalog, hosts)

            expect(result.type).toBe('Consult')
            if (result.type === 'Consult') {
                expect(result.alternatives.map(({ label }) => label).sort()).toEqual(['take man in moon', 'take man in the moon'])
                expect(result.root?.fills).toHaveLength(2)
            }
        })

        it('resumes on the fill the answer names: the other fill\'s reading does not ask again', async () => {
            const result = await compile('take man in the moon', takeManInTheMoon, catalog, hosts, {
                referentAnswers: { manRef: manId, theMoonRef: moonId },
            })

            expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 1 })
            expect(movedId(result)).toBe(manId)
        })
    })
})
