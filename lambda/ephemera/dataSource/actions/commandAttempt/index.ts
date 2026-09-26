import type { EphemeraThingId } from '../enrich/objectManipulation/thing'
import type { UngroundedPlanStep } from '../enrich/objectManipulation/plan/ungroundedPrimitive'

/**
 * A grounded, described participant in an attempt --- distinct from
 * `plan/ungroundedPrimitive.ts`'s `Referent`, which names an ungrounded, span-based
 * reference. This one names whatever Identify has already resolved a span to, carried
 * here purely for prose (section 2 of CA-1's format); nothing deterministic reads it.
 */
export type CommandAttemptReferent = {
    refKey: string
    id: EphemeraThingId
    shortName: string
    gloss?: string
}

export type ChallengeVerdict = 'pending' | 'met' | 'impossible'

/**
 * `description` is the challenge sentence, fixed before adjudication runs (CA-1's
 * confirmed wording rule: a `Custom` edge's challenge phrases directly off its
 * `relationLabel`). `reason` is populated only once a verdict of `impossible` is
 * recorded --- the human-readable "why," which is not the same text as the neutral
 * pre-adjudication description (CA-6's worked example, row 5).
 */
export type Challenge = {
    description: string
    verdict: ChallengeVerdict
    reason?: string
}

/**
 * `desiredResult` is Plan's ungrounded primitive (the action's structural intent);
 * `desiredResultDescription` is its prose gloss. Nothing deterministic reads the
 * description --- it exists only so `renderProse`/`result` can stay pure renderers
 * over structured data (CA-2) instead of taking hand-authored strings out of band.
 */
export type AttemptAction = {
    desiredResult?: UngroundedPlanStep
    desiredResultDescription?: string
    challenges: Challenge[]
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
    actions: AttemptAction[]
}

const cloneReferent = (referent: CommandAttemptReferent): CommandAttemptReferent => ({ ...referent })

const cloneChallenge = (challenge: Challenge): Challenge => ({ ...challenge })

const cloneAction = (action: AttemptAction): AttemptAction => ({
    ...(action.desiredResult !== undefined ? { desiredResult: action.desiredResult } : {}),
    ...(action.desiredResultDescription !== undefined ? { desiredResultDescription: action.desiredResultDescription } : {}),
    challenges: action.challenges.map(cloneChallenge),
})

/**
 * A player's attempted command: an ordered list of actions, each an optional desired
 * result plus the challenges that make it non-trivial (see
 * `taskPlanning/lambda/ephemera/dataSource/actions/AGENT.commandAttemptPhase.planning.md`).
 * This slice's prototype rule: every operation on an attempt, small helpers included, is
 * a method here, and the plain-data shape (`CommandAttemptData`) appears only at
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

    static fromJSON(data: CommandAttemptData): CommandAttempt {
        return new CommandAttempt(
            data.words,
            data.referents.map(cloneReferent),
            data.actions.map(cloneAction)
        )
    }

    toJSON(): CommandAttemptData {
        return {
            words: this.words,
            referents: this._referents.map(cloneReferent),
            actions: this._actions.map(cloneAction),
        }
    }

    referents(): CommandAttemptReferent[] {
        return this._referents.map(cloneReferent)
    }

    actions(): AttemptAction[] {
        return this._actions.map(cloneAction)
    }

    /**
     * CA-2's deterministic result update: records a verdict (and, for `impossible`, its
     * reason) on one action's challenge, without touching the player's words. Pure ---
     * returns a new attempt rather than mutating this one.
     */
    recordVerdict(actionIndex: number, challengeIndex: number, verdict: ChallengeVerdict, reason?: string): CommandAttempt {
        const actions = this._actions.map((action, actionIdx) => {
            if (actionIdx !== actionIndex) {
                return cloneAction(action)
            }
            return {
                ...cloneAction(action),
                challenges: action.challenges.map((challenge, challengeIdx) => {
                    if (challengeIdx !== challengeIndex) {
                        return cloneChallenge(challenge)
                    }
                    return {
                        ...cloneChallenge(challenge),
                        verdict,
                        ...(reason !== undefined ? { reason } : {}),
                    }
                }),
            }
        })
        return new CommandAttempt(this.words, this._referents.map(cloneReferent), actions)
    }

    /**
     * CA-2: derived from the challenge verdicts, never stored. Impossibility wins over a
     * still-pending or already-met challenge elsewhere in the attempt (one impossible
     * reading refuses the whole attempt); any still-pending challenge keeps the attempt
     * pending; only once every challenge across every action is met does it succeed.
     */
    get result(): AttemptResult {
        const allChallenges = this._actions.flatMap((action) => action.challenges)
        const impossible = allChallenges.find((challenge) => challenge.verdict === 'impossible')
        if (impossible) {
            return { status: 'impossible', reason: impossible.reason ?? impossible.description }
        }
        if (allChallenges.some((challenge) => challenge.verdict === 'pending')) {
            return { status: 'pending' }
        }
        const outcome = this._actions
            .map((action) => action.desiredResultDescription)
            .filter((description): description is string => Boolean(description))
            .join(' and ')
        return { status: 'succeeded', outcome }
    }

    /**
     * CA-1's six-section format, in order: words, referents, state (always present, empty
     * until a state axis exists), room context, actions, result.
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
            lines.push(`- desired result: ${action.desiredResultDescription ?? '(none)'}`)
            if (action.challenges.length === 0) {
                lines.push('  challenges: none detected')
            } else {
                lines.push('  challenges:')
                for (const challenge of action.challenges) {
                    lines.push(`  - ${challenge.description} (${challenge.verdict})`)
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
