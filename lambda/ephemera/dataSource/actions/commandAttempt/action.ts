import type { PlanStep } from '../enrich/objectManipulation/plan/planStep'
import type { Challenge, ChallengeData } from './challenge'
import { challengeFromJSON, challengeToJSON } from './challenge'

/**
 * Action family (slice 1.7, per 1.6's decision that actions grow along the member
 * axis --- kinds keep arriving: position today, later narration, state, intent-parking,
 * construction/deconstruction, effects along relations, divide/merge). Every member
 * answers the same three questions: describe your desired result, list your challenges,
 * give your outcome (the eventual kernel-vocabulary result, once something adjudicates).
 */
export interface AttemptActionMember {
    describe(): string | undefined
    challenges(): Challenge[]
    /** Pure: returns a new action of the same kind holding these challenges. */
    withChallenges(challenges: Challenge[]): AttemptActionMember
    toJSON(): AttemptActionData
}

/**
 * The only member today. Plan's `PlanStep` already discriminates five
 * primitive shapes (`transferMembership` / `establishRelation` / `dissolveRelation` /
 * `containedBy` / `isolatedFromRelations`), but all five are one *outcome class* ---
 * position --- so they share this one action member rather than five. `desiredResult`
 * is the structural intent; `desiredResultDescription` is its prose gloss, read by
 * `describe()` since nothing deterministic reads the structural half yet.
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

    describe(): string | undefined {
        return this.desiredResultDescription
    }

    challenges(): Challenge[] {
        return this._challenges
    }

    withChallenges(challenges: Challenge[]): PositionAttemptAction {
        return new PositionAttemptAction(challenges, this.desiredResult, this.desiredResultDescription)
    }
}

export type AttemptActionData = {
    kind: 'position'
    desiredResult?: PlanStep
    desiredResultDescription?: string
    challenges: ChallengeData[]
}

export type AttemptAction = AttemptActionMember

export const attemptActionFromJSON = (data: AttemptActionData): AttemptAction => {
    switch (data.kind) {
        case 'position':
            return PositionAttemptAction.fromJSON(data)
    }
}

export const attemptActionToJSON = (action: AttemptAction): AttemptActionData => action.toJSON()
