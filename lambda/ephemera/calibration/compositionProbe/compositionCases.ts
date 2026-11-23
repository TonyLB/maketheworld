//
// The composition probe's starting cases (AGENT.compositionProbe.planning.md, "The first chain"), each with its mocked judge. The fixture, the
// plan, what is also shown and the detail asked for are the case's `playByPlay` cell's, so the chain's first live call is the cell's own.
// `things` is listed by hand, as `consequences`' cells list theirs.
//
import { playByPlayCells } from '../imaginationPieces/playByPlay'
import type { ActionPlan, PlannedStep } from '../oracleLoop/actionPlan'
import type { PieceState } from '../pieceProbe/piecePart'
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import type { Mock } from './mocks'

export const JUDGE = 'judge'

/** A starting case: what the pieces share at the start, the mocks it runs with, and where its inputs come from. */
export type CompositionCase = { start: PieceState; mocks: readonly Mock[]; source: string }

/** The plan's first step, by its place: its path changes when a restatement changes its words. */
const firstStep = ({ plan }: { plan: ActionPlan }): PlannedStep => plan.steps[0]

const answers = (step: PlannedStep, missing: string): boolean => (step.alreadyAnswers ?? []).includes(missing)

/**
 * Whether a step holds an outcome settled by its authority. `playByPlay`'s consequences are unchecked, so its proposals don't count. A
 * `consequences` reply that adds nothing leaves this false, and the judge asks again until the cap: it sees only the plan.
 */
const outcomeSettled = ({ items }: PlannedStep): boolean =>
    items.some(({ kind, standing }) => (kind === 'consequence' || kind === 'possibility' || kind === 'concern') && standing === 'confirmed')

/** The first chain's judge: it asks how the first step is done, then what comes of it, then allows the plan. */
export const mockedJudge = ({ missing, consequencesMissing }: { missing: string; consequencesMissing: string }): Mock => ({
    piece: JUDGE,
    answers: [],
    entries: [
        {
            name: 'needs detail of the action',
            when: (state) => !answers(firstStep(state), missing),
            give: (state) => ({ request: { kind: 'action', target: firstStep(state).path, missing } }),
        },
        {
            name: 'needs detail of the consequences',
            when: (state) => answers(firstStep(state), missing) && !outcomeSettled(firstStep(state)),
            give: (state) => ({ request: { kind: 'consequences', target: firstStep(state).path, missing: consequencesMissing } }),
        },
        {
            name: 'allows',
            when: (state) => answers(firstStep(state), missing) && outcomeSettled(firstStep(state)),
            give: () => ({ verdict: 'allows' }),
        },
    ],
})

const fromCell = (id: string, things: readonly SceneHandle[], consequencesMissing: string): CompositionCase => {
    const { inputs: { fixture, plan, missing, alsoShown } } = playByPlayCells[id]
    return { start: { fixture, plan, things, alsoShown }, mocks: [mockedJudge({ missing, consequencesMissing })], source: `playByPlay cell ${id}` }
}

export const compositionCases: Record<string, CompositionCase> = {
    'OC-6': fromCell('OC-6', ['table1', 'saucer1'], 'what happens to [table1] and [saucer1] as [teapot1] is moved'),
    // The wall is listed so the chain stays in `consequences`' scene when the live plan doesn't name the wall.
    'OC-20': fromCell('OC-20', ['teapot1', 'cup1', 'saucer1', 'wall1'], 'what happens to the other things as [table1] is lifted'),
}
