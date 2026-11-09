//
// The oracle harness's cases, keyed by corpus case ID (`AGENT.oracleLoop.corpus.planning.md`), with a round suffix where one case runs
// over several rounds. The candidates are the template's where a fixture holds a proposal, otherwise written by hand, standing in for the
// engine. Each `endResult` is the corpus's expected end result, attributed as the corpus attributes it. Cases are written when a draft
// step first asks them: these are the ones oracleLoop Slice 4 names, with OC-19 and OC-20.
//
import { teaTableProposals } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { ProposedMove } from '../../dataSource/positions/manipulation/proposedMoves'
import { noRounds, type Candidate, type ImprovementRequest, type OracleCase } from './oracleInputs'

const template = (id: string, moves: readonly ProposedMove[]): Candidate => ({
    id, source: 'template', polarity: 'yes', steps: moves.map((change) => ({ change, suppliedBy: 'system' })), reuses: [], improvisations: [],
})

const ask = (fixture: string, request: string): Pick<OracleCase, 'scene' | 'request' | 'answers' | 'dials'> => ({
    scene: { fixture }, request, answers: [], dials: {},
})

const pour = 'I want to pour tea from [teapot1].'
const tipToPour = 'tip [table1] so that [teapot1] pours into [cup1]'

/** OC-12 and OC-13's candidate, and OC-30's B: the system supplies the tilt through the table. */
const tipTheTable = (id: string): Candidate => ({
    id, source: 'handWritten', polarity: 'yes', steps: [{ says: tipToPour, suppliedBy: 'system' }], reuses: ['teapot-secured-to-table'], improvisations: [],
})

const glued: Candidate = {
    id: 'A', source: 'handWritten', polarity: 'no',
    sentence: "The teapot is glued to the table, so you can't pour from it.",
    steps: [], reuses: ['teapot-secured-to-table'], improvisations: [],
}
const liftTheCupOff: ImprovementRequest = { candidateId: 'B', says: 'lift [cup1] off first' }
const slidesOff = 'tipping [table1] slides [saucer1] and [cup1] off'

export const oracleCases: Readonly<Record<string, OracleCase>> = {
    'OC-1': {
        ...ask('teaTable', 'I want to pick up [table1].'),
        answerToBeat: { kind: 'floor' },
        candidates: [template('T', teaTableProposals.pickUpTable)],
        rounds: noRounds,
        endResult: 'The candidate beats the floor, with no direction. The risk is reading the glue as blocking the table.',
    },
    'OC-5': {
        ...ask('teaTable', 'I want to pick up [teapot1].'),
        answerToBeat: { kind: 'floor' },
        candidates: [],
        rounds: noRounds,
        endResult: 'The floor, with the glue named as the fact in the way and no fix prescribed.',
        note: "The template's literal move is refused (securedToBlocksMove), so there is no candidate.",
    },
    'OC-6': {
        ...ask('teaTable', pour),
        answerToBeat: { kind: 'floor' },
        candidates: [template('T', teaTableProposals.pour)],
        rounds: noRounds,
        endResult: 'The candidate loses on the fiction, with the missing tilt as its known issue. A `better` is the wrong `simple` again.',
    },
    'OC-7': {
        ...ask('teaTable', 'I want to wipe [table1] with a cloth.'),
        answerToBeat: { kind: 'floor' },
        candidates: [{
            id: 'W', source: 'handWritten', polarity: 'yes',
            steps: [{ says: 'wipe [table1] with a cloth', suppliedBy: 'player' }],
            reuses: [],
            improvisations: [{ fills: { says: 'the cloth', namedBy: 'player' }, proposes: 'a cloth at hand in the parlour' }],
        }],
        rounds: noRounds,
        endResult: 'The candidate beats the floor, with the cloth as its one stretch.',
        note: "Written as the corpus states it, with the cloth improvised. The type sketch's illustration has the cloth unfilled, so the candidate doesn't work and the floor stands; the corpus's outcome predates that rule (for Slice 4).",
    },
    'OC-11': {
        ...ask('teaTableCupOnFloor', 'I want to put [table1] in [cup1].'),
        answerToBeat: { kind: 'floor' },
        candidates: [template('T', teaTableProposals.tableInCupOnFloor)],
        rounds: noRounds,
        endResult: 'The candidate loses on the size, with no direction to the engine.',
    },
    'OC-12': {
        ...ask('teaTableDungeon', pour),
        answerToBeat: { kind: 'floor' },
        candidates: [tipTheTable('T')],
        rounds: noRounds,
        endResult: "(user) It \"just gets\" an obstructed-style reply: the system's method doesn't compete, and the direction goes to the player.",
    },
    'OC-13': {
        ...ask('teaTableDollHouse', pour),
        answerToBeat: { kind: 'floor' },
        candidates: [tipTheTable('T')],
        rounds: noRounds,
        endResult: '(user) A delighted yes: "The miniature teapot is glued to its table, so you heft the table up at an angle to pour the tea into the tiny cup."',
    },
    'OC-19': {
        ...ask('teaTableHammerHeld', 'I want to pry [teapot1] off [table1] with [hammer1].'),
        answerToBeat: { kind: 'floor' },
        candidates: [{
            id: 'P', source: 'handWritten', polarity: 'yes',
            steps: [{ says: 'pry [teapot1] off [table1] with [hammer1]', suppliedBy: 'player' }],
            reuses: ['[hammer1]', 'teapot-secured-to-table'],
            improvisations: [],
        }],
        rounds: noRounds,
        endResult: 'Yes, credited to the player as a found out, with the glue as what it changes. Whether the pry works is a skill question (JP-14).',
    },
    'OC-20': {
        ...ask('teaTableChained', 'I want to pick up [table1].'),
        answerToBeat: { kind: 'floor' },
        candidates: [],
        rounds: noRounds,
        endResult: 'The floor, with the chain named as the fact in the way; the glued teapot plays no part.',
        note: "The template's move is refused (the chain's securing), so there is no candidate.",
    },
    'OC-30/1': {
        ...ask('teaTable', pour),
        answerToBeat: { kind: 'floor' },
        candidates: [glued],
        rounds: noRounds,
        endResult: 'A beats the floor and becomes the answer-to-beat.',
    },
    'OC-30/2': {
        ...ask('teaTable', pour),
        answerToBeat: { kind: 'answer', candidate: glued },
        candidates: [tipTheTable('B')],
        rounds: noRounds,
        endResult: 'B loses as a product and A stays; B goes to the frontier with its repair, the cup lifted off first; the broken invariant joins the known issues and the tried list.',
    },
    'OC-30/3': {
        ...ask('teaTable', pour),
        answerToBeat: { kind: 'answer', candidate: glued },
        candidates: [{
            id: 'C', source: 'handWritten', polarity: 'yes',
            steps: [{ change: teaTableProposals.pickUpCup[0], suppliedBy: 'system' }, { says: tipToPour, suppliedBy: 'system' }],
            reuses: ['teapot-secured-to-table'],
            improvisations: [],
        }],
        rounds: {
            knownIssues: [slidesOff],
            tried: [{ candidateId: 'B', lostBecause: slidesOff }],
            frontier: [{ candidate: tipTheTable('B'), improvements: [liftTheCupOff] }],
        },
        endResult: "Whether C beats A is the method dial's, which this scene doesn't set (OC-12, OC-13).",
        note: 'C is B repaired: the cup lifted off first, as a change the kernel knows, then the tilt in words.',
    },
}

export const oracleCaseIds = Object.keys(oracleCases)
