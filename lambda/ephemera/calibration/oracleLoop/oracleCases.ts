//
// The oracle harness's cases, keyed by corpus case ID (`AGENT.oracleLoop.corpus.planning.md`), with a round suffix where one case runs
// over several rounds. The candidates are the template's where a fixture holds a proposal, otherwise written by hand, standing in for the
// engine. Each `endResult` is the oracle's end result for that round, from the corpus, attributed as the corpus attributes it. Cases are written when a draft
// step first asks them: these are the ones oracleLoop Slice 4 names, with OC-19 and OC-20.
//
import { teaTableProposals } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { ProposedMove } from '../../dataSource/positions/manipulation/proposedMoves'
import { noRounds, type Candidate, type ImprovementRequest, type OracleCase } from './oracleInputs'

/** A template's candidate: its one record change, with the action in words that stand in for the request the template answers (a guess). */
const template = (id: string, says: string, [change]: readonly [ProposedMove]): Candidate => ({
    id, source: 'template', polarity: 'yes', steps: [{ says, change, suppliedBy: 'system' }], reuses: [], improvisations: [],
})

const ask = (fixture: string, request: string): Pick<OracleCase, 'scene' | 'request' | 'answers' | 'dials'> => ({
    scene: { fixture }, request, answers: [], dials: {},
})

const pour = 'I want to pour tea from [teapot1].'
const tipToPour = 'tip [table1] so that [teapot1] pours [tea2] into [cup1]'

/** OC-12 and OC-13's candidate, and OC-30's B: the system supplies the tilt through the table. */
const tipTheTable = (id: string): Candidate => ({
    id, source: 'handWritten', polarity: 'yes', steps: [{ says: tipToPour, suppliedBy: 'system' }], reuses: ['teapot-secured-to-table'], improvisations: [],
})

const glued: Candidate = {
    id: 'A', source: 'handWritten', polarity: 'no',
    sentence: "The teapot is glued to the table, so you can't pour from it.",
    steps: [], reuses: ['teapot-secured-to-table'], improvisations: [],
}
const slidesOff = 'tipping [table1] slides [saucer1] and [cup1] off'
const moveTheSaucerOff = (candidateId: string): ImprovementRequest => ({ candidateId, says: 'move [saucer1] off [table1] first' })

/** The tipping candidate repaired (user, 2026-11-09): the saucer off first, carrying the cup, then the tilt. */
const saucerOffThenTip = (id: string): Candidate => ({
    id, source: 'handWritten', polarity: 'yes',
    steps: [{ says: 'pick up [saucer1]', change: teaTableProposals.pickUpSaucer[0], suppliedBy: 'system' }, { says: tipToPour, suppliedBy: 'system' }],
    reuses: ['teapot-secured-to-table'],
    improvisations: [],
})

/** After a round in which tipping the table got past the glue and slid the saucer and cup off. */
const afterTheSlide = (candidateId: string): OracleCase['rounds'] => ({
    knownIssues: [slidesOff],
    tried: [{ candidateId, lostBecause: slidesOff }],
    frontier: [{ candidate: tipTheTable(candidateId), improvements: [moveTheSaucerOff(candidateId)] }],
})

export const oracleCases: Readonly<Record<string, OracleCase>> = {
    'OC-1': {
        ...ask('teaTable', 'I want to pick up [table1].'),
        answerToBeat: { kind: 'floor' },
        candidates: [template('T', 'pick up [table1]', teaTableProposals.pickUpTable)],
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
        candidates: [template('T', 'pour [tea2] from [teapot1] into [cup1]', teaTableProposals.pour)],
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
        candidates: [template('T', 'put [table1] in [cup1]', teaTableProposals.tableInCupOnFloor)],
        rounds: noRounds,
        endResult: 'The candidate loses on the size, with no direction to the engine.',
    },
    'OC-12': {
        ...ask('teaTableDungeon', pour),
        answerToBeat: { kind: 'floor' },
        candidates: [tipTheTable('T')],
        rounds: noRounds,
        endResult: "(user) It \"just gets\" an obstructed-style reply. Tipping is a method the system supplied, on a fact the scene makes a challenge, so it has no potential (the method dial): no frontier, and the direction goes to the player.",
    },
    'OC-13/1': {
        ...ask('teaTableDollHouse', pour),
        answerToBeat: { kind: 'floor' },
        candidates: [tipTheTable('B')],
        rounds: noRounds,
        endResult: '(user) Not better yet: tipping gets past the glue, which is its potential, and slides the saucer and cup off the tipped table. To the frontier with "move [saucer1] off [table1] first", a direction to the engine.',
    },
    'OC-13/2': {
        ...ask('teaTableDollHouse', pour),
        answerToBeat: { kind: 'floor' },
        candidates: [saucerOffThenTip('C')],
        rounds: afterTheSlide('B'),
        endResult: '(user) A delighted yes: "The miniature teapot is glued to its table, so you heft the table up at an angle to pour the tea into the tiny cup."',
    },
    'OC-19': {
        ...ask('teaTableHammerHeld', 'I want to pry [teapot1] off [table1] with [hammer1].'),
        answerToBeat: { kind: 'floor' },
        candidates: [{
            id: 'P', source: 'handWritten', polarity: 'yes',
            steps: [{ says: 'pry [teapot1] off [table1] with [hammer1]', voids: ['teapot-secured-to-table'], suppliedBy: 'player' }],
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
        endResult: '(user) B is not better than A: it gets past the glue, which is its potential, and slides the saucer and cup off the tipped table. B goes to the frontier with "move [saucer1] off [table1] first"; the slide joins the known issues and the tried list.',
    },
    'OC-30/3': {
        ...ask('teaTable', pour),
        answerToBeat: { kind: 'answer', candidate: glued },
        candidates: [saucerOffThenTip('C')],
        rounds: afterTheSlide('B'),
        endResult: "Whether C beats A is the method dial's, which this scene doesn't set (OC-12, OC-13).",
        note: 'C is B repaired (user, 2026-11-09): the saucer off first, carrying the cup, as a change the kernel knows, then the tilt in words.',
    },
}

export const oracleCaseIds = Object.keys(oracleCases)
