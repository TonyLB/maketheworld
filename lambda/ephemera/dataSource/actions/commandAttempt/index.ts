import type { EphemeraThingId } from '../enrich/objectManipulation/thing'
import type { AttemptAction, AttemptActionData } from './action'
import { attemptActionFromJSON, attemptActionToJSON } from './action'
import type { Verdict } from './verdict'

export type { AttemptAction, AttemptActionData, AttemptActionMember, PositionAttemptAction } from './action'
export type { Challenge, ChallengeData } from './challenge'
export { CustomEdgeChallenge, UnderDeferChallenge, WorldKnowledgeChallenge } from './challenge'
export type { Verdict, VerdictData } from './verdict'
export { MetVerdict, ImpossibleVerdict } from './verdict'

/**
 * Prose data for one phrase the player used (section 2 of CA-1's format): the phrase's
 * `refKey`, the id it grounded to, and how to describe that thing. It is not how an
 * action's steps name the thing --- those hold `plan/planStep.ts`'s `Referent`, which
 * carries its own `groundedId` once known --- and nothing deterministic reads it.
 * Referents are not a member family (1.6): every kind answers the same questions as
 * data, differing only in where the data is looked up, so this stays a plain type.
 */
export type CommandAttemptReferent = {
    refKey: string
    id: EphemeraThingId
    shortName: string
    gloss?: string
}

export type AttemptResult =
    | { status: 'pending' }
    | { status: 'succeeded'; outcome: string }
    | { status: 'impossible'; reason: string }

/**
 * CA-1: room context (section 4) is filled by a scope function, not owned by the
 * attempt --- no scope function exists yet (downstream of the reasoning-gloss
 * pipeline), so `renderProse` takes it as an optional render-time input.
 */
export type RoomContextSection = {
    hostShortName: string
    nodes: string[]
    edges: string[]
}

export type CommandAttemptData = {
    words: string
    referents: CommandAttemptReferent[]
    actions: AttemptActionData[]
}

const cloneReferent = (referent: CommandAttemptReferent): CommandAttemptReferent => ({ ...referent })

/**
 * A player's attempted command: an ordered list of actions, each an optional desired
 * result plus the challenges that make it non-trivial (see
 * `taskPlanning/lambda/ephemera/dataSource/actions/AGENT.commandAttemptPhase.planning.md`).
 * Composes the action, challenge and verdict families (slice 1.7): `renderProse` and
 * `result` delegate to members rather than holding bespoke per-kind logic. The plain-data
 * shape (`CommandAttemptData`, and each family's own `*Data`) appears only at
 * `fromJSON`/`toJSON`.
 */
export class CommandAttempt {
    readonly words: string

    private readonly _referents: CommandAttemptReferent[]
    private readonly _actions: AttemptAction[]

    private constructor(words: string, referents: CommandAttemptReferent[], actions: AttemptAction[]) {
        this.words = words
        this._referents = referents
        this._actions = actions
    }

    /** Domain constructor: an attempt built in-pipeline from its referents and actions. */
    static create(words: string, referents: readonly CommandAttemptReferent[], actions: readonly AttemptAction[]): CommandAttempt {
        return new CommandAttempt(words, referents.map(cloneReferent), [...actions])
    }

    static fromJSON(data: CommandAttemptData): CommandAttempt {
        return new CommandAttempt(
            data.words,
            data.referents.map(cloneReferent),
            data.actions.map(attemptActionFromJSON)
        )
    }

    toJSON(): CommandAttemptData {
        return {
            words: this.words,
            referents: this._referents.map(cloneReferent),
            actions: this._actions.map(attemptActionToJSON),
        }
    }

    referents(): CommandAttemptReferent[] {
        return this._referents.map(cloneReferent)
    }

    actions(): AttemptAction[] {
        return this._actions
    }

    /**
     * CA-2's deterministic result update, domain-addressed (slice 1.7): finds the
     * challenge carrying `challengeId` across every action and records this verdict on
     * it. Pure --- returns a new attempt rather than mutating this one. Throws if no
     * challenge with that id exists, since a caller addressing a challenge that isn't
     * there is a bug, not a legal no-op.
     */
    recordVerdict(challengeId: string, verdict: Verdict): CommandAttempt {
        let found = false
        const actions = this._actions.map((action) => {
            const challenges = action.challenges()
            if (!challenges.some((challenge) => challenge.id === challengeId)) {
                return action
            }
            found = true
            return action.withChallenges(
                challenges.map((challenge) => (challenge.id === challengeId ? challenge.withVerdict(verdict) : challenge))
            )
        })
        if (!found) {
            throw new Error(`CommandAttempt.recordVerdict: no challenge with id '${challengeId}'`)
        }
        return new CommandAttempt(this.words, this._referents.map(cloneReferent), actions)
    }

    /**
     * CA-2: derived from the challenge verdicts, never stored. Folds by asking each
     * recorded verdict its proceed/refuse question (1.6) rather than comparing verdict
     * strings: an `undefined` verdict keeps the attempt pending; any verdict that
     * refuses (impossible) wins over everything else; only once every challenge has a
     * verdict that proceeds does the attempt succeed. A verdict that neither proceeds nor
     * refuses (e.g. a future `failed`) has no result status yet, so it throws rather than
     * falling through to success --- adding such a member must extend `AttemptResult`.
     */
    get result(): AttemptResult {
        const allChallenges = this._actions.flatMap((action) => action.challenges())
        const refusal = allChallenges.find((challenge) => challenge.verdict?.refuses())
        if (refusal && refusal.verdict) {
            return { status: 'impossible', reason: refusal.verdict.resultText() }
        }
        if (allChallenges.some((challenge) => challenge.verdict === undefined)) {
            return { status: 'pending' }
        }
        const stalled = allChallenges.find((challenge) => !challenge.verdict?.proceeds())
        if (stalled) {
            throw new Error(
                `CommandAttempt.result: verdict '${stalled.verdict?.kind}' on challenge '${stalled.id}' neither proceeds nor refuses`
            )
        }
        const outcome = this._actions
            .map((action) => action.describe())
            .filter((description): description is string => Boolean(description))
            .join(' and ')
        return { status: 'succeeded', outcome }
    }

    /**
     * CA-1's six-section format, in order: words, referents, state (always present, empty
     * until a state axis exists), room context, actions, result. Delegates each action's
     * and challenge's own line to its member.
     */
    renderProse(roomContext?: RoomContextSection): string {
        const lines: string[] = []
        lines.push(`Player's words: ${this.words}`)
        lines.push('')
        lines.push('Referents:')
        for (const referent of this._referents) {
            const gloss = referent.gloss !== undefined ? `, gloss: ${referent.gloss}` : ''
            lines.push(`- ${referent.refKey} -> ${referent.id}, ${referent.shortName}${gloss}`)
        }
        lines.push('')
        lines.push('State: (none)')
        lines.push('')
        if (roomContext) {
            const edges = roomContext.edges.length > 0 ? roomContext.edges.join('; ') : 'none'
            lines.push(`Room context: ${roomContext.hostShortName} --- nodes: ${roomContext.nodes.join(', ')}. Edges: ${edges}.`)
        } else {
            lines.push('Room context: (none)')
        }
        lines.push('')
        lines.push('Actions:')
        for (const action of this._actions) {
            lines.push(`- desired result: ${action.describe() ?? '(none)'}`)
            const challenges = action.challenges()
            if (challenges.length === 0) {
                lines.push('  challenges: none detected')
            } else {
                lines.push('  challenges:')
                for (const challenge of challenges) {
                    lines.push(`  - ${challenge.describe()} (${challenge.verdict?.kind ?? 'pending'})`)
                }
            }
        }
        lines.push('')
        const result = this.result
        if (result.status === 'pending') {
            lines.push('Result: pending')
        } else if (result.status === 'succeeded') {
            lines.push(`Result: succeeded: ${result.outcome}`)
        } else {
            lines.push(`Result: impossible: ${result.reason}`)
        }
        return lines.join('\n')
    }
}
