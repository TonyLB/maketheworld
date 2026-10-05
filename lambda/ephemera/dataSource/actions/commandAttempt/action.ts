import type { PlanStep, Referent } from '../enrich/objectManipulation/plan/planStep'
import { stepReferents } from '../enrich/objectManipulation/plan/planStep'
import { stampCandidateReferents, stampReferent, type SpanName } from '../enrich/objectManipulation/stampCandidateReferents'
import type { Challenge, ChallengeData } from './challenge'
import { challengeFromJSON, challengeToJSON } from './challenge'

/**
 * Action family (slice 1.7, per 1.6's decision that actions grow along the member
 * axis --- kinds keep arriving: position and narration today, later state, intent-parking,
 * construction/deconstruction, effects along relations, divide/merge). Every member
 * answers the same three questions: describe your desired result, list your challenges,
 * give your outcome (the eventual kernel-vocabulary result, once something adjudicates).
 */
export interface AttemptActionMember {
    /** The structural intent, in Plan's step vocabulary: what deterministic code lowers. */
    readonly desiredResult?: PlanStep
    /** Every referent the action names: a position's step slots, or a narration's subject. */
    referents(): Referent[]
    describe(): string | undefined
    challenges(): Challenge[]
    /** Pure: returns a new action of the same kind holding these challenges. */
    withChallenges(challenges: Challenge[]): AttemptActionMember
    /**
     * Pure: returns a new action of the same kind with each span key's identity written onto
     * the referents this action names (PI-9). Identify and Enumerate read `referents()`;
     * grounding is how an assignment reaches the action, and each kind owns that write.
     */
    grounded(names: ReadonlyMap<string, SpanName>): AttemptActionMember
    toJSON(): AttemptActionData
}

/**
 * One of two members today. Plan's `PlanStep` already discriminates four
 * primitive shapes (`transferMembership` / `establishRelation` / `dissolveRelation` /
 * `containedBy`), but all four are one *outcome class* --- position --- so they share
 * this one action member rather than four. `desiredResult` is the structural intent,
 * which the membership dry run lowers to executor steps; `desiredResultDescription` is
 * its prose gloss, read by `describe()`.
 */
export class PositionAttemptAction implements AttemptActionMember {
    readonly desiredResult?: PlanStep
    readonly desiredResultDescription?: string
    private readonly _challenges: Challenge[]

    constructor(challenges: Challenge[], desiredResult?: PlanStep, desiredResultDescription?: string) {
        this._challenges = challenges
        this.desiredResult = desiredResult
        this.desiredResultDescription = desiredResultDescription
    }

    static fromJSON(data: Extract<AttemptActionData, { kind: 'position' }>): PositionAttemptAction {
        return new PositionAttemptAction(
            data.challenges.map(challengeFromJSON),
            data.desiredResult,
            data.desiredResultDescription
        )
    }

    toJSON(): AttemptActionData {
        return {
            kind: 'position',
            ...(this.desiredResult !== undefined ? { desiredResult: this.desiredResult } : {}),
            ...(this.desiredResultDescription !== undefined ? { desiredResultDescription: this.desiredResultDescription } : {}),
            challenges: this._challenges.map(challengeToJSON),
        }
    }

    referents(): Referent[] {
        return this.desiredResult === undefined ? [] : stepReferents(this.desiredResult)
    }

    describe(): string | undefined {
        return this.desiredResultDescription
    }

    challenges(): Challenge[] {
        return this._challenges
    }

    withChallenges(challenges: Challenge[]): PositionAttemptAction {
        return new PositionAttemptAction(challenges, this.desiredResult, this.desiredResultDescription)
    }

    grounded(names: ReadonlyMap<string, SpanName>): PositionAttemptAction {
        if (this.desiredResult === undefined) {
            return this
        }
        return new PositionAttemptAction(
            this._challenges,
            stampCandidateReferents(this.desiredResult, names),
            this.desiredResultDescription
        )
    }
}

/**
 * The first member of the queued **narration** outcome class: describing a referent is not a
 * world mutation, so it has no `PlanStep` shape and `desiredResult` is always
 * `undefined` --- narration doesn't belong in `PlanStep`'s vocabulary at all, not just
 * an unfilled field. `description` is the prose gloss, read by `describe()`, the same
 * role `PositionAttemptAction.desiredResultDescription` plays. No describe-time
 * challenge is detectable yet, so every instance today carries zero challenges.
 */
export class NarrateAttemptAction implements AttemptActionMember {
    readonly desiredResult = undefined
    readonly description?: string
    private readonly _challenges: Challenge[]
    private readonly _referents: Referent[]

    /**
     * `referents` is what the narration names (a look's one object span). It is the only place
     * a narration's referent lives: with no desired result there are no steps to derive it from.
     */
    constructor(challenges: Challenge[], description?: string, referents: Referent[] = []) {
        this._challenges = challenges
        this.description = description
        this._referents = referents
    }

    static fromJSON(data: Extract<AttemptActionData, { kind: 'narrate' }>): NarrateAttemptAction {
        return new NarrateAttemptAction(
            data.challenges.map(challengeFromJSON),
            data.description,
            data.referents
        )
    }

    toJSON(): AttemptActionData {
        return {
            kind: 'narrate',
            ...(this.description !== undefined ? { description: this.description } : {}),
            referents: this._referents,
            challenges: this._challenges.map(challengeToJSON),
        }
    }

    referents(): Referent[] {
        return this._referents
    }

    describe(): string | undefined {
        return this.description
    }

    challenges(): Challenge[] {
        return this._challenges
    }

    withChallenges(challenges: Challenge[]): NarrateAttemptAction {
        return new NarrateAttemptAction(challenges, this.description, this._referents)
    }

    grounded(names: ReadonlyMap<string, SpanName>): NarrateAttemptAction {
        return new NarrateAttemptAction(
            this._challenges,
            this.description,
            this._referents.map((referent) => stampReferent(referent, names))
        )
    }
}

export type AttemptActionData =
    | {
        kind: 'position'
        desiredResult?: PlanStep
        desiredResultDescription?: string
        challenges: ChallengeData[]
    }
    | {
        kind: 'narrate'
        description?: string
        referents: Referent[]
        challenges: ChallengeData[]
    }

export type AttemptAction = AttemptActionMember

export const attemptActionFromJSON = (data: AttemptActionData): AttemptAction => {
    switch (data.kind) {
        case 'position':
            return PositionAttemptAction.fromJSON(data)
        case 'narrate':
            return NarrateAttemptAction.fromJSON(data)
    }
}

export const attemptActionToJSON = (action: AttemptAction): AttemptActionData => action.toJSON()
