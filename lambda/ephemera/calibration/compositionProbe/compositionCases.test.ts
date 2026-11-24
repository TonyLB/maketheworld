import { planOf, planSteps, mergeStepChanges, type ActionPlan, type MergeOptions } from '../oracleLoop/actionPlan'
import { CONSEQUENCES_MERGE } from '../imaginationPieces/consequences'
import { PLAY_BY_PLAY_MERGE } from '../imaginationPieces/playByPlay'
import type { PieceState } from '../pieceProbe/piecePart'
import { compositionCases, JUDGE, mockedJudge } from './compositionCases'
import { matchMock } from './mocks'

const MISSING = 'how it is held'
const judge = mockedJudge({ missing: MISSING, consequencesMissing: 'what happens' })
const plan = planOf([{ step: { says: 'pick up the table', suppliedBy: 'system' }, items: [{ kind: 'intent', says: 'pick up the table' }] }])

const merged = (into: ActionPlan, changes: unknown[], options: MergeOptions): ActionPlan => {
    const result = mergeStepChanges(into, into.steps[0].path, { changes }, [], options)
    if ('problems' in result) {
        throw new Error(result.problems.join('; '))
    }
    return result.plan
}
const stateOf = (given: ActionPlan): PieceState => ({ fixture: 'teaTable', plan: given, things: [], alsoShown: [] })
const given = (into: ActionPlan) => {
    const state = stateOf(into)
    return matchMock(judge, state, undefined)?.give(state, undefined)
}

const restated = merged(plan, [{ restate: 'step', says: 'lift [table1] straight up', answered: MISSING }, { add: 'consequence', says: 'things rise' }], PLAY_BY_PLAY_MERGE)

describe('the mocked judge', () => {
    it('asks how the first step is done, until the plan answers it', () => {
        expect(given(plan)).toEqual({ request: { kind: 'action', target: 'pick-up-table', missing: MISSING } })
    })

    it('then asks what comes of it, finding the step by its place when a restatement changed its path, and not counting an unchecked proposal', () => {
        expect(planSteps(restated)[0].path).toBe('lift-table1-straight')
        expect(given(restated)).toEqual({ request: { kind: 'consequences', target: 'lift-table1-straight', missing: 'what happens' } })
    })

    it.each([
        ['consequence', [{ add: 'consequence', says: 'the cup rises' }]],
        ['possibility', [{ add: 'possibility', kind: 'execution', says: 'it stays level', branches: [[], []] }]],
        ['concern', [{ add: 'concern', says: 'the cup may spill' }]],
    ])('then allows the plan, once it holds a confirmed %s', (_kind, changes) => {
        expect(given(merged(restated, changes, CONSEQUENCES_MERGE))).toEqual({ verdict: 'allows' })
    })

    it('asks again when the consequences reply added nothing', () => {
        expect(given(merged(restated, [], CONSEQUENCES_MERGE))).toEqual({ request: { kind: 'consequences', target: 'lift-table1-straight', missing: 'what happens' } })
    })
})

describe('a mock', () => {
    it('gives nothing when no entry matches', () => {
        expect(matchMock({ piece: JUDGE, answers: [], entries: [judge.entries[2]] }, stateOf(plan), undefined)).toBeUndefined()
    })
})

describe('the cases', () => {
    it('carry the inputs a request doesn\'t give', () => {
        expect(Object.entries(compositionCases).map(([id, { start: { fixture, things, alsoShown } }]) => [id, fixture, things, alsoShown])).toEqual([
            ['OC-6', 'teaTable', ['table1', 'saucer1', 'cup1'], ['table1']],
            ['OC-20', 'teaTableChained', ['teapot1', 'cup1', 'saucer1', 'wall1'], ['wall1']],
        ])
    })
})
