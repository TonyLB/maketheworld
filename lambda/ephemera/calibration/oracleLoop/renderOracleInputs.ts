//
// The oracle's inputs as a draft reads them (oracleLoop Slice 3, a Prototype): one block after `End of scene.` and before `Request:`. The
// wording belongs to the drafts, so every heading is a default a draft can override (`framing`), as `proposedOutcome`'s framing and
// explanation are. A step is its action, with the record change it makes on a line under it in the dry run's words; a template candidate
// gets the built explanation, since only the dry run has checked it. The after-state is off by default: Slice 2.5 showed it shown and not read.
//
import { PROPOSED_OUTCOME_EXPLANATION } from '../../dataSource/actions/sceneProse/frame'
import { moveText, renderProposedOutcome, type ProposedOutcomeAfter } from '../../dataSource/actions/sceneProse/renderProposedOutcome'
import type { JudgeRulesWording } from '../../dataSource/actions/sceneProse/sceneRules'
import { buildSceneFixture, type SceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { ProposedMove } from '../../dataSource/positions/manipulation/proposedMoves'
import { proposalAfter } from '../sceneReasoning/proposedOutcomeBlocks'
import type { Candidate, CandidateStep, OracleRoundInput } from './oracleInputs'

export type OracleFraming = {
    answerToBeat: string
    floor: string
    answers: string
    asked: string
    answered: string
    knownIssues: string
    tried: string
    frontier: string
    improvements: string
    candidate: string
    templateExplanation: string
    says: string
    moves: string
    /** The label of a step's record line, and the verb of its move: "record: [tea2] moves from [teapot1] into [cup1]". */
    record: string
    recordVerb: string
    /** The label of a step's declared intent: "sets out to void: teapot-secured-to-table". */
    voids: string
    reuses: string
    improvises: string
    player: string
    system: string
}

export const ORACLE_FRAMING: OracleFraming = {
    answerToBeat: 'Best answer so far',
    floor: "I don't see how.",
    answers: 'What the player has answered',
    asked: 'Asked',
    answered: 'Answered',
    knownIssues: 'Known issues',
    tried: 'Tried already',
    frontier: 'Worth another try',
    improvements: 'Would do better with',
    candidate: 'Candidate',
    templateExplanation: PROPOSED_OUTCOME_EXPLANATION,
    says: 'Says',
    moves: 'Moves',
    record: 'record',
    recordVerb: 'moves',
    voids: 'sets out to void',
    reuses: 'Reuses',
    improvises: 'Improvises',
    player: 'from the player',
    system: 'from the system',
}

export const ORACLE_FRAMING_KEYS = Object.keys(ORACLE_FRAMING) as (keyof OracleFraming)[]

export type OracleShow = {
    /** The scene after a candidate's changes, for the candidates being judged. */
    after: 'none' | ProposedOutcomeAfter
    /** Who supplied each step, after the step. */
    suppliedBy: boolean
}

export const ORACLE_SHOW: OracleShow = { after: 'none', suppliedBy: true }

export type OracleInputsRender =
    | { status: 'rendered'; text: string }
    | { status: 'refused'; candidateId: string; reason: string }

const changesOf = (candidate: Candidate): ProposedMove[] => candidate.steps.flatMap(({ change }) => (change === undefined ? [] : [change]))

const list = (heading: string, lines: readonly string[]): string => [`${heading}:`, ...lines.map((line) => `- ${line}`)].join('\n')

export const renderOracleInputs = async (
    fixture: SceneFixture,
    input: OracleRoundInput,
    { framing = ORACLE_FRAMING, show = ORACLE_SHOW, rules = 'v45' }: { framing?: OracleFraming; show?: OracleShow; rules?: JudgeRulesWording } = {}
): Promise<OracleInputsRender> => {
    const { handles, scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
    const everyCandidate = [
        ...(input.answerToBeat.kind === 'answer' ? [input.answerToBeat.candidate] : []),
        ...input.rounds.frontier.map(({ candidate }) => candidate),
        ...input.candidates,
    ]
    const outcomes = await Promise.all(everyCandidate
        .filter((candidate) => changesOf(candidate).length > 0)
        .map(async (candidate) => [candidate, await proposalAfter(fixture, handles, changesOf(candidate))] as const))
    const refused = outcomes.find(([, outcome]) => outcome.status === 'refused')
    if (refused !== undefined && refused[1].status === 'refused') {
        return { status: 'refused', candidateId: refused[0].id, reason: refused[1].reason }
    }
    const afters = new Map(outcomes.flatMap(([candidate, outcome]) => (outcome.status === 'legal' ? [[candidate, outcome] as const] : [])))
    const stepLine = (step: CandidateStep): string => {
        const action = `${step.says}${show.suppliedBy ? ` (${framing[step.suppliedBy]})` : ''}.`
        return [
            action,
            ...(step.change === undefined ? [] : [`  ${framing.record}: ${moveText(step.change, handles, scene, framing.recordVerb)}.`]),
            ...(step.voids === undefined || step.voids.length === 0 ? [] : [`  ${framing.voids}: ${step.voids.join(', ')}`]),
        ].join('\n')
    }
    const body = (candidate: Candidate, withAfter: boolean): string[] => {
        const after = afters.get(candidate)
        return [
            ...(candidate.sentence === undefined ? [] : [`${framing.says}: ${candidate.sentence}`]),
            ...(candidate.steps.length === 0 ? [] : [list(framing.moves, candidate.steps.map(stepLine))]),
            ...(candidate.reuses.length === 0 ? [] : [`${framing.reuses}: ${candidate.reuses.join(', ')}`]),
            ...(candidate.improvisations.length === 0 ? [] : [list(framing.improvises, candidate.improvisations.map(({ fills, proposes }) => `${fills.says}: ${proposes}`))]),
            ...(withAfter && after !== undefined && show.after !== 'none'
                ? [renderProposedOutcome({ moves: after.moves, handles, scene: after.scene, form: 'after', after: show.after, rulesWording: rules })]
                : []),
        ]
    }
    const named = (candidate: Candidate): string => (input.candidates.length > 1 ? `${framing.candidate} ${candidate.id}` : framing.candidate)
    const { answerToBeat, answers, rounds, candidates } = input
    const blocks = [
        answerToBeat.kind === 'floor'
            ? `${framing.answerToBeat}: ${framing.floor}`
            : [`${framing.answerToBeat}:`, ...body(answerToBeat.candidate, false)].join('\n\n'),
        ...(answers.length === 0 ? [] : [[`${framing.answers}:`, ...answers.map(({ asked, answer }) => `- ${framing.asked}: ${asked}\n  ${framing.answered}: ${answer}`)].join('\n')]),
        ...(rounds.knownIssues.length === 0 ? [] : [list(framing.knownIssues, rounds.knownIssues)]),
        ...(rounds.tried.length === 0 ? [] : [list(framing.tried, rounds.tried.map(({ candidateId, lostBecause }) => `${framing.candidate} ${candidateId}: ${lostBecause}`))]),
        ...rounds.frontier.map(({ candidate, improvements }) => [
            `${framing.frontier}: ${framing.candidate} ${candidate.id}`,
            ...body(candidate, false),
            ...(improvements.length === 0 ? [] : [list(framing.improvements, improvements.map(({ says }) => says))]),
        ].join('\n\n')),
        ...candidates.map((candidate) => [
            `${named(candidate)}:${candidate.source === 'template' ? ` ${framing.templateExplanation}` : ''}`,
            ...body(candidate, true),
        ].join('\n\n')),
    ]
    return { status: 'rendered', text: blocks.join('\n\n') }
}
