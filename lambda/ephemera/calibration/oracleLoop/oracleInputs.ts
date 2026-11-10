//
// What passes into the oracle (oracleLoop Slice 3, a Prototype): Slice 2's type sketch, as far as the cases in scope use it. A guess,
// revised by the drafts that read it. A field resting on an open row is marked with it. Nothing in production reads these types.
//
import type { ProposedMove } from '../../dataSource/positions/manipulation/proposedMoves'

/** Who supplied a step, or named a slot. */
export type Supplier = 'player' | 'system'

/** Something a candidate needs that isn't established (JF-6 sets what counts). Found by the oracle. */
export type Slot = {
    /** "the cloth" in "wipe the table with the cloth", "something sharp". */
    says: string
    /** Whether the request named it, read from its words. */
    namedBy: Supplier // JF-7
}

/** An improvised fact that fills a slot: an object as the common case (a bar-rag), or a fact (the trees' canopy). */
export type Improvisation = { fills: Slot; proposes: string }

/**
 * An action in words, and where the kernel knows it, the record change it makes, which the dry run checks. Every record change has an
 * action in the fiction behind it (something puts the saucer in your hands), while an action need not change the record (waving a flag),
 * or makes a change the kernel can't compute (a pry, a tilt). Slice 2's sketch, restored: Slice 3 had made a step one or the other.
 */
export type CandidateStep = {
    says: string
    change?: ProposedMove
    /**
     * The handles of the rules the action sets out to void (L-31): the generator's declared intent, which the oracle judges, both whether
     * the action voids the rule and when. A guess about what the engine will emit.
     */
    voids?: readonly string[]
    suppliedBy: Supplier // JF-16
}

export type Candidate = {
    id: string
    source: 'template' | 'handWritten' | 'engine'
    polarity: 'yes' | 'no'
    /** A finished answer's words. A candidate with no steps has one (OC-30's A). */
    sentence?: string
    steps: readonly CandidateStep[]
    /** Handles, rule handles or scene phrases: [table1], teapot-secured-to-table, "smoky from the hearth". */
    reuses: readonly string[]
    /** What fills the candidate's slots. Written into hand-written cases; later from the engine. */
    improvisations: readonly Improvisation[]
}

export type AnswerToBeat = { kind: 'floor' } | { kind: 'answer'; candidate: Candidate }

/** What the oracle asks for to make a candidate better: a filler for a slot, a repair, or (no candidateId) a new candidate. */
export type ImprovementRequest = {
    candidateId?: string
    says: string
    slot?: Slot
}

/** What earlier rounds since the last restart produced. */
export type RoundRecord = {
    knownIssues: readonly string[]
    tried: readonly { candidateId: string; lostBecause: string }[]
    /** At most two. */
    frontier: readonly { candidate: Candidate; improvements: readonly ImprovementRequest[] }[]
}

/** Typed, not rendered: no case sets a dial yet. The first case that does books the render (JF-15, JF-17). */
export type Dials = {
    method?: 'zero' | 'open' // JF-15
    factRoles?: Readonly<Record<string, 'challenge' | 'texture'>> // JF-17
    exposition?: 'zero' | 'high'
}

/** One oracle call: a round of the loop over one request. */
export type OracleRoundInput = {
    /** A fixture name. The render is the harness's. */
    scene: { fixture: string }
    /** In the player's words, as first typed. */
    request: string
    /** The player's answers to questions the loop asked: it restarts from the request with them (JF-19). */
    answers: readonly { asked: string; answer: string }[]
    answerToBeat: AnswerToBeat
    /** Zero is a valid round (OC-5, OC-20). */
    candidates: readonly Candidate[]
    dials: Dials
    rounds: RoundRecord
}

/** A corpus case's oracle part, as the harness asks it. */
export type OracleCase = OracleRoundInput & {
    /**
     * The oracle's end result for this round, what the case tests, read by hand: the verdict, what potential the candidate has, and
     * where the direction goes. A round is one call, so this is the oracle step's end result and binds a draft; what the player ends up
     * with across rounds is the loop's.
     */
    endResult: string
    /** Why the case reads as it does, where that isn't the corpus's plain statement. */
    note?: string
}

export const noRounds: RoundRecord = { knownIssues: [], tried: [], frontier: [] }
