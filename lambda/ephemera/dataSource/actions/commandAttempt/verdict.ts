/**
 * Verdict family (CA-2, slice 1.7): a challenge's `verdict` is a `Verdict | undefined`,
 * not a three-way string --- `undefined` means "no verdict recorded yet" (formerly
 * `'pending'`), and is deliberately not a member of this family (it is the *absence*
 * of one, per `AGENT.architecture.codeOrganization.md`'s worked example). Two members
 * ship now (`met`, `impossible`).
 *
 * Every member answers the same three questions (1.6): does it refuse the attempt; what
 * goes to narration; how does it render in the result section. The process question has
 * only two answers --- a verdict that does not refuse lets the attempt proceed. Failing
 * at the player's goal (CA-2's roadmap `failed`) is a narrative outcome, not a third
 * process answer: such a member proceeds, and differs in what commits and how it
 * narrates. `CommandAttempt.result` folds over these answers instead of comparing
 * verdict strings.
 */
export interface Verdict {
    readonly kind: 'met' | 'impossible'
    /** Does this verdict, alone, refuse the whole attempt regardless of any other challenge? */
    refuses(): boolean
    /** Detail for narration --- e.g. a manner or a failure reason. Not consumed yet: no narration unit reads a verdict. */
    narrationDetail(): string | undefined
    /** Text for the attempt's result section when this verdict is the one that decides the outcome. */
    resultText(): string
    toJSON(): VerdictData
}

export type VerdictData =
    | { kind: 'met' }
    | { kind: 'impossible'; reason: string }

export class MetVerdict implements Verdict {
    readonly kind = 'met' as const

    static fromJSON(): MetVerdict {
        return new MetVerdict()
    }

    toJSON(): VerdictData {
        return { kind: 'met' }
    }

    refuses(): boolean {
        return false
    }

    narrationDetail(): string | undefined {
        return undefined
    }

    resultText(): string {
        return 'met'
    }
}

export class ImpossibleVerdict implements Verdict {
    readonly kind = 'impossible' as const
    readonly reason: string

    constructor(reason: string) {
        this.reason = reason
    }

    static fromJSON(data: Extract<VerdictData, { kind: 'impossible' }>): ImpossibleVerdict {
        return new ImpossibleVerdict(data.reason)
    }

    toJSON(): VerdictData {
        return { kind: 'impossible', reason: this.reason }
    }

    refuses(): boolean {
        return true
    }

    narrationDetail(): string | undefined {
        return this.reason
    }

    resultText(): string {
        return this.reason
    }
}

export const verdictFromJSON = (data: VerdictData): Verdict =>
    data.kind === 'met' ? MetVerdict.fromJSON() : ImpossibleVerdict.fromJSON(data)

export const verdictToJSON = (verdict: Verdict): VerdictData => verdict.toJSON()
