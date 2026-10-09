import type { EphemeraThingId } from '../enrich/objectManipulation/thing'
import type { AttemptAction, AttemptActionData } from './action'
import { attemptActionFromJSON, attemptActionToJSON } from './action'
import { buildCommandAttemptReferent, objectSpansIn } from './referent'
import type { NarrationUnit } from './narrationUnit'
import type { Verdict } from './verdict'

export type { AttemptAction, AttemptActionData, AttemptActionMember, PositionAttemptAction, NarrateAttemptAction } from './action'
export type { Challenge, ChallengeData } from './challenge'
export { CustomEdgeChallenge, ExitEdgeChallenge, WorldKnowledgeChallenge } from './challenge'
export type { NarrationAudience, NarrationUnit, NarrationWitnessVariant } from './narrationUnit'
export type { Verdict, VerdictData } from './verdict'
export { MetVerdict, ImpossibleVerdict } from './verdict'

/**
 * Prose data for one phrase the player used (section 2 of CA-1's format): the phrase's
 * `refKey`, the id it grounded to, and how to describe that thing. Never stored: it is
 * derived from the actions' referents (`CommandAttempt.referents()`), so a name and id live
 * only on the referents that carry them. Referents are not a member family (1.6): every kind
 * answers the same questions as data, so this stays a plain type.
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
    narrationUnits: NarrationUnit[]
}

const cloneReferent = (referent: CommandAttemptReferent): CommandAttemptReferent => ({ ...referent })

/**
 * Derives the prose's referents section from the actions, in order of first appearance of
 * each `stableRefKey`. A span contributes once it is both keyed and grounded with a name;
 * an ungrounded span (a plan that has not been through Grounding) has no prose entry yet.
 */
const referentsFromActions = (actions: readonly AttemptAction[]): CommandAttemptReferent[] => {
    const seen = new Map<string, CommandAttemptReferent>()
    for (const action of actions) {
        for (const referent of action.referents()) {
            for (const span of objectSpansIn(referent)) {
                if (span.stableRefKey === undefined || span.groundedId === undefined || span.shortName === undefined || seen.has(span.stableRefKey)) {
                    continue
                }
                seen.set(span.stableRefKey, buildCommandAttemptReferent(
                    span.stableRefKey,
                    span.groundedId as EphemeraThingId,
                    span.shortName,
                    span.gloss
                ))
            }
        }
    }
    return [...seen.values()]
}

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

    private readonly _actions: AttemptAction[]

    private readonly _narrationUnits: NarrationUnit[]

    private constructor(words: string, actions: AttemptAction[], narrationUnits: NarrationUnit[]) {
        this.words = words
        this._actions = actions
        this._narrationUnits = narrationUnits
    }

    /**
     * Domain constructor: an attempt built in-pipeline from its actions. `narrationUnits` are
     * the lines the actions' author (Plan's templates, Expansion) declares; it defaults to none,
     * and an action no unit covers narrates nothing.
     */
    static create(words: string, actions: readonly AttemptAction[], narrationUnits: readonly NarrationUnit[] = []): CommandAttempt {
        return new CommandAttempt(words, [...actions], [...narrationUnits])
    }

    /** `data.referents` is ignored: it is derived from the actions, and is only published. */
    static fromJSON(data: CommandAttemptData): CommandAttempt {
        return new CommandAttempt(data.words, data.actions.map(attemptActionFromJSON), [...data.narrationUnits])
    }

    toJSON(): CommandAttemptData {
        return {
            words: this.words,
            referents: this.referents(),
            actions: this._actions.map(attemptActionToJSON),
            narrationUnits: [...this._narrationUnits],
        }
    }

    referents(): CommandAttemptReferent[] {
        return referentsFromActions(this._actions).map(cloneReferent)
    }

    actions(): AttemptAction[] {
        return this._actions
    }

    /** The narration units this attempt's author(s) declared. `commitAttempt` delivers exactly these; it synthesizes none. */
    narrationUnits(): NarrationUnit[] {
        return this._narrationUnits
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
        return new CommandAttempt(this.words, actions, this._narrationUnits)
    }

    /**
     * CA-2: derived from the challenge verdicts, never stored. Folds by asking each
     * recorded verdict whether it refuses (1.6) rather than comparing verdict strings:
     * any verdict that refuses (impossible) wins over everything else; an `undefined`
     * verdict keeps the attempt pending; otherwise every challenge has a verdict that
     * proceeds, and the attempt succeeds.
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
        for (const referent of this.referents()) {
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
