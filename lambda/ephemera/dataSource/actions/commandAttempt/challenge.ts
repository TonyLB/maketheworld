import type { HostRelationalEdge } from '../../positions/ludicGraph/baseClasses'
import type { Verdict, VerdictData } from './verdict'
import { verdictFromJSON, verdictToJSON } from './verdict'

/**
 * Challenge family (slice 1.7, per 1.6's decision that challenges grow along the
 * member axis). Every member answers: its wording (`describe`), its detection source
 * (deterministic from the graph, or invisible to the fast path --- world-knowledge),
 * and its verdict. A graph challenge carries the edge it judges, but propagates nothing:
 * the change a met verdict permits is its action's own `desiredResult`. Which members a
 * given adjudicator may judge is that adjudicator's policy (`adjudicate.ts`), not a member
 * question.
 */
export interface Challenge {
    readonly id: string
    readonly verdict: Verdict | undefined
    readonly detectionSource: 'graph' | 'worldKnowledge'
    describe(): string
    /** Pure: returns a new challenge with this verdict recorded. */
    withVerdict(verdict: Verdict): Challenge
    toJSON(): ChallengeData
}

export type ChallengeData =
    | { kind: 'customEdge'; id: string; edge: HostRelationalEdge; description: string; verdict?: VerdictData }
    | { kind: 'underDefer'; id: string; edge: HostRelationalEdge; description: string; verdict?: VerdictData }
    | { kind: 'worldKnowledge'; id: string; description: string; verdict?: VerdictData }

/**
 * A `Custom` boundary edge deferring to adjudication. CA-1 (slice 0, rows 3/6) confirmed
 * a `Custom` challenge's wording phrases directly off `relationLabel` for the "is there a
 * challenge at all" question, but not a generic sentence-synthesis rule --- row 6's full
 * sentence ("the rope is lashed to the post; that lashing must be undone.") has an
 * authored second clause no transform of `relationLabel` alone reliably reproduces. So
 * this member carries the edge (what Adjudicate judges) alongside the
 * wording as given, rather than synthesizing prose from `relationLabel`.
 */
export class CustomEdgeChallenge implements Challenge {
    readonly id: string
    readonly edge: HostRelationalEdge
    readonly description: string
    readonly verdict: Verdict | undefined
    readonly detectionSource = 'graph' as const

    constructor(id: string, edge: HostRelationalEdge, description: string, verdict?: Verdict) {
        this.id = id
        this.edge = edge
        this.description = description
        this.verdict = verdict
    }

    static fromJSON(data: Extract<ChallengeData, { kind: 'customEdge' }>): CustomEdgeChallenge {
        return new CustomEdgeChallenge(data.id, data.edge, data.description, data.verdict && verdictFromJSON(data.verdict))
    }

    toJSON(): ChallengeData {
        return {
            kind: 'customEdge',
            id: this.id,
            edge: this.edge,
            description: this.description,
            ...(this.verdict !== undefined ? { verdict: verdictToJSON(this.verdict) } : {}),
        }
    }

    describe(): string {
        return this.description
    }

    withVerdict(verdict: Verdict): Challenge {
        return new CustomEdgeChallenge(this.id, this.edge, this.description, verdict)
    }
}

/**
 * An `Under` subject-move defer. Structurally identical to `CustomEdgeChallenge` today
 * (edge + authored wording), kept as its own member per 1.6's explicit direction so
 * future divergent behavior (once `Under` wording is designed) has a home. **`Under`
 * wording stays carried forward as CA-1's open item** --- no worked example produces an
 * `Under`-defer case, so no wording is invented here.
 */
export class UnderDeferChallenge implements Challenge {
    readonly id: string
    readonly edge: HostRelationalEdge
    readonly description: string
    readonly verdict: Verdict | undefined
    readonly detectionSource = 'graph' as const

    constructor(id: string, edge: HostRelationalEdge, description: string, verdict?: Verdict) {
        this.id = id
        this.edge = edge
        this.description = description
        this.verdict = verdict
    }

    static fromJSON(data: Extract<ChallengeData, { kind: 'underDefer' }>): UnderDeferChallenge {
        return new UnderDeferChallenge(data.id, data.edge, data.description, data.verdict && verdictFromJSON(data.verdict))
    }

    toJSON(): ChallengeData {
        return {
            kind: 'underDefer',
            id: this.id,
            edge: this.edge,
            description: this.description,
            ...(this.verdict !== undefined ? { verdict: verdictToJSON(this.verdict) } : {}),
        }
    }

    describe(): string {
        return this.description
    }

    withVerdict(verdict: Verdict): Challenge {
        return new UnderDeferChallenge(this.id, this.edge, this.description, verdict)
    }
}

/**
 * A world-knowledge challenge (CA-6): invisible to deterministic code, so its wording is
 * always authored or LLM-produced free text, with no graph edge underneath it. Also the eventual home for lock state, stability,
 * and strength (1.6), which share this shape until a concrete case demands otherwise.
 */
export class WorldKnowledgeChallenge implements Challenge {
    readonly id: string
    readonly description: string
    readonly verdict: Verdict | undefined
    readonly detectionSource = 'worldKnowledge' as const

    constructor(id: string, description: string, verdict?: Verdict) {
        this.id = id
        this.description = description
        this.verdict = verdict
    }

    static fromJSON(data: Extract<ChallengeData, { kind: 'worldKnowledge' }>): WorldKnowledgeChallenge {
        return new WorldKnowledgeChallenge(data.id, data.description, data.verdict && verdictFromJSON(data.verdict))
    }

    toJSON(): ChallengeData {
        return {
            kind: 'worldKnowledge',
            id: this.id,
            description: this.description,
            ...(this.verdict !== undefined ? { verdict: verdictToJSON(this.verdict) } : {}),
        }
    }

    describe(): string {
        return this.description
    }

    withVerdict(verdict: Verdict): Challenge {
        return new WorldKnowledgeChallenge(this.id, this.description, verdict)
    }
}

export const challengeFromJSON = (data: ChallengeData): Challenge => {
    switch (data.kind) {
        case 'customEdge':
            return CustomEdgeChallenge.fromJSON(data)
        case 'underDefer':
            return UnderDeferChallenge.fromJSON(data)
        case 'worldKnowledge':
            return WorldKnowledgeChallenge.fromJSON(data)
    }
}

export const challengeToJSON = (challenge: Challenge): ChallengeData => challenge.toJSON()
