import type { EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraThingId } from '../thing'

/**
 * The id a referent grounds to --- the same union a `ReferentAssignment`'s two namespaces
 * carry (below).
 */
export type GroundedId = EphemeraThingId | EphemeraMembershipHostId

/**
 * A presence bucket, named by its owner: `presence` is one of `host`'s own bindings, and lives on
 * `host`'s graph. The owner is whichever host's graph holds the thing (the referent itself only
 * when it is seen through its own binding), so a bare `PRESENCE#` id would leave the walk
 * guessing which graph to read.
 */
export type GroundedPresenceBinding = { host: EphemeraMembershipHostId; presence: EphemeraPresenceNodeId }

/**
 * One place a referent is seen: a presence bucket (a binding of the host whose graph holds the
 * thing), or the room itself when the thing sits in the room's own graph (a room is a
 * perspective root, so what sits in its graph is seen there without a binding). A referent's `groundedPresence` lists every one, so an audience walks up from all of
 * them to every room that can see the thing change. (Which part of the object a command means is the referent's `view`, not this.) Learned alongside `groundedId`, by whoever
 * learns it (Grounding, from the `ludicCache`; Expansion, from the graph it read). Optional:
 * absent means not learned, never "in the room".
 */
export type GroundedPresence = EphemeraRoomId | GroundedPresenceBinding

/**
 * A referent is grounded or ungrounded by what is known about it, not by where it
 * sits in the pipeline. Every arm says how the thing was named (a phrase, the actor,
 * a derived host) and carries an optional `groundedId` once its id is known; Grounding
 * adds the id without discarding the rest, so a grounded `objectSpan` keeps the
 * `stableRefKey` tie the attempt's prose reads.
 *
 * stableRefKey is optional here, for a referent with no skeleton key to pass. The Plan
 * templates pass the key from Parse's skeleton. Don't invent placeholder values.
 */
export type ObjectSpanReferent = {
    referentType: 'objectSpan'
    span: string
    stableRefKey?: string
    groundedId?: GroundedId
    groundedPresence?: GroundedPresence[]
    /**
     * The part meant: the object's own bindings (bare ids, the host being `groundedId`), as against
     * `groundedPresence`, which is everywhere the object is seen. An object with several positions is
     * stamped with the part meant (the actor's own, a part the player chose, or every own binding for
     * the whole); absent means the object has one position to mean. A binding an earlier extend step of
     * the same attempt mints (`PresenceKey(presenceUuid)`) is a valid entry before it exists;
     * `viewMintedByExtend` reads that off the attempt. A transfer moves exactly these bindings.
     */
    view?: EphemeraPresenceNodeId[]
    /** Names the thing for the attempt's prose once known (stamped by key, `stampCandidateReferents.ts`). */
    shortName?: string
    gloss?: string
}
export type ActingCharacterReferent = { referentType: 'actingCharacter'; groundedId?: GroundedId }
export type CurrentHostReferent = { referentType: 'currentHost'; referentTarget: Referent; groundedId?: GroundedId }
/**
 * Born grounded: a thing known only by its id in a graph, which no phrase named ---
 * e.g. the post at the far end of a boundary edge that Expansion must dissolve.
 */
export type GraphNodeReferent = { referentType: 'graphNode'; groundedId: GroundedId; groundedPresence?: GroundedPresence[] }
export type Referent = ObjectSpanReferent | ActingCharacterReferent | CurrentHostReferent | GraphNodeReferent
export type GroundedReferent = Referent & { groundedId: GroundedId }

export type TransferMembershipChange<R extends Referent = Referent> = {
    kind: 'change'
    primitive: 'transferMembership'
    object: R
    from: R
    to: R
    /**
     * A containment move: the transfer also establishes an `On`/`In` edge whose
     * host is always `to` by construction, not discovered by ancestry walk --- containment's
     * producer (`compileAttemptsFromSkeleton.ts`) sets this; `PartOf` never reaches
     * here (ND-4, `parseCommand.ts` hard-errors it earlier).
     */
    containment?: 'On' | 'In'
}

/**
 * Extend: the object (one that has extent --- a rope, a cloth) gains a second presence binding in
 * place, under the same parents as the binding it extends and connected to it by `ConnectedTo`.
 * Changes nothing anyone sees; a move of the new binding follows. `presenceUuid` is minted by
 * whoever plans the step, so a later step can name the new binding before it exists. Phrase-free,
 * so the LLM Plan fallback can produce it as a template does. `object.groundedPresence` names the
 * binding it extends; absent, the object's only binding.
 */
export type ExtendChange<R extends Referent = Referent> = {
    kind: 'change'
    primitive: 'extend'
    object: R
    presenceUuid: string
}

/**
 * Whether a referent's `view` names a binding that an `extend` among `steps` mints, so the binding does
 * not exist until the attempt commits (a spread's move). Read off the attempt rather than flagged on the
 * referent: the view names the binding, the extend step says it is not there yet.
 */
export const viewMintedByExtend = (object: Referent, steps: readonly PlanStep[]): boolean => {
    if (object.referentType !== 'objectSpan' || object.view === undefined) {
        return false
    }
    const minted = new Set<string>(steps.flatMap((step) => (
        step.kind === 'change' && step.primitive === 'extend' ? [PresenceKey(step.presenceUuid)] : []
    )))
    return object.view.some((binding) => minted.has(binding))
}

export type EstablishRelationChange<R extends Referent = Referent> = {
    kind: 'change'
    primitive: 'establishRelation'
    subject: R
    target: R
} & RelationalKindAndLabel

export type DissolveRelationChange<R extends Referent = Referent> = {
    kind: 'change'
    primitive: 'dissolveRelation'
    subject: R
    target: R
} & RelationalKindAndLabel

/** An edge relation's end that names another entry's edge, by that entry's `edgeRef`. */
export type EdgeRefEnd = { edgeRef: string }

/** An end of an edge relation: a thing (a referent), or another entry's edge. */
export type EdgeRelationEnd<R extends Referent = Referent> = R | EdgeRefEnd

export const isEdgeRefEnd = <R extends Referent>(end: EdgeRelationEnd<R>): end is EdgeRefEnd => 'edgeRef' in end

/**
 * One edge of an `assignEdgeRelations` / `dissolveEdgeRelations` change, all in one graph. `edgeRef`
 * declares a name for this entry's edge that another entry's end can use (`{ edgeRef }`): a
 * `Justifies` names the two edges it relates that way.
 */
export type EdgeRelationEntry<R extends Referent = Referent> = {
    edgeRef?: string
    from: EdgeRelationEnd<R>
    to: EdgeRelationEnd<R>
} & RelationalKindAndLabel

/**
 * Writes several edge relations in one graph together (`tie`: the `Custom` manner edge, the
 * `SecuredTo` it justifies, and the `Justifies` between them). Phrase-free, so the LLM Plan fallback
 * can produce it as a template does.
 *
 * **A prototype.** The entries are the interface kept; `mintedEdgeIds` is not. It holds an id for
 * every declared `edgeRef`, minted by whoever plans the step (`mintEdgeRefs`) so dry run and commit
 * agree, and is the ad-hoc ref handling that `AGENT.stableRefs.planning.md` replaces.
 */
export type AssignEdgeRelationsChange<R extends Referent = Referent> = {
    kind: 'change'
    primitive: 'assignEdgeRelations'
    entries: EdgeRelationEntry<R>[]
    mintedEdgeIds: Readonly<Record<string, string>>
}

/**
 * Removes edge relations from one graph together (`untie`). Removes every listed edge that is
 * present, and refuses when none is, or when a `mustBePresent` entry is absent. A declared `edgeRef`
 * names the stored edge its entry matches, so a `Justifies` entry can name the edges it relates.
 * Listed in the order dissolved: a dissolve takes the edges naming the one removed, so an entry
 * naming another's edge comes first.
 */
export type DissolveEdgeRelationsChange<R extends Referent = Referent> = {
    kind: 'change'
    primitive: 'dissolveEdgeRelations'
    entries: (EdgeRelationEntry<R> & { mustBePresent: boolean })[]
}

export type EdgeRelationsChange<R extends Referent = Referent> = AssignEdgeRelationsChange<R> | DissolveEdgeRelationsChange<R>

/** The things an edge-relations change names (every end that is not another entry's edge). */
export const edgeRelationReferents = <R extends Referent>(change: EdgeRelationsChange<R>): R[] => (
    (change.entries as EdgeRelationEntry<R>[]).flatMap(({ from, to }) => [from, to].filter((end): end is R => !isEdgeRefEnd(end)))
)

/** Maps every referent end of an edge-relations change, leaving the ends that name another entry's edge. */
export const mapEdgeRelationReferents = <R extends Referent, S extends Referent>(change: EdgeRelationsChange<R>, f: (referent: R) => S): EdgeRelationsChange<S> => {
    const end = (value: EdgeRelationEnd<R>): EdgeRelationEnd<S> => (isEdgeRefEnd(value) ? value : f(value))
    return change.primitive === 'assignEdgeRelations'
        ? { ...change, entries: change.entries.map((entry) => ({ ...entry, from: end(entry.from), to: end(entry.to) })) }
        : { ...change, entries: change.entries.map((entry) => ({ ...entry, from: end(entry.from), to: end(entry.to) })) }
}

export type Change<R extends Referent = Referent> =
    | TransferMembershipChange<R>
    | ExtendChange<R>
    | EstablishRelationChange<R>
    | DissolveRelationChange<R>
    | AssignEdgeRelationsChange<R>
    | DissolveEdgeRelationsChange<R>

/**
 * BD-14: `negate` rather than paired predicate names (e.g. `notContainedBy`) ---
 * a flag reuses one evaluation path instead of forking the (disjunctive)
 * predicate logic into two copies that must be kept in sync. Single member
 * today; grow this union as concrete cases demand (BD-14 scope discipline).
 *
 * `containedBy(subject, object)`: the subject is held by the object. A qualifier ("the cup on the
 * table") is one, judged in the dry run (`attemptDryRun`), where a candidate it rules out is illegal.
 * `relation` records what the words said (`On`, `In`); absent means held there, how unspecified
 * ("from"). The dry run is lenient for now: every host of the subject's view must be the object
 * directly, whatever the relation.
 */
export type ContainedByAssertion<R extends Referent = Referent> = {
    kind: 'assertion'
    predicate: 'containedBy'
    subject: R
    object: R
    negate: boolean
    relation?: 'On' | 'In'
}

export type Assertion<R extends Referent = Referent> = ContainedByAssertion<R>

/**
 * A Plan step, generic over what is known about its referents: `PlanStep` (the default)
 * admits any mix, and `PlanStep<GroundedReferent>` names a step whose every referent has
 * a known id, which Expansion emits and the executor can seed without grounding.
 */
export type PlanStep<R extends Referent = Referent> = Change<R> | Assertion<R>

export const objectSpanRef = (span: string, stableRefKey?: string): Referent => ({
    referentType: 'objectSpan',
    span,
    ...(stableRefKey !== undefined ? { stableRefKey } : {}),
})

export const actingCharacterRef: Referent = { referentType: 'actingCharacter' }

export const currentHostRef = (referentTarget: Referent): Referent => ({
    referentType: 'currentHost',
    referentTarget,
})

export const graphNodeRef = (groundedId: GroundedId, groundedPresence?: GroundedPresence[]): GraphNodeReferent => ({
    referentType: 'graphNode',
    groundedId,
    ...(groundedPresence !== undefined ? { groundedPresence } : {}),
})

/** Adds a known id to a referent, keeping everything already known about it. */
export const withGroundedId = <R extends Referent>(referent: R, groundedId: GroundedId): R & { groundedId: GroundedId } => ({
    ...referent,
    groundedId,
})

/**
 * A structural key for a referent with no `stableRefKey` of its own: `'actingCharacter'`, `` `currentHost(actingCharacter)` ``,
 * `` `currentHost(span:<key>)` ``. Total over `Referent` so a `currentHost` nested on any kind stays
 * nameable: membership nests both live (a take's `from` is `currentHost(span:<key>)`, a
 * drop's `to` is `currentHost(actingCharacter)`).
 */
export type DerivedReferentKey = string

export const derivedReferentKey = (referent: Referent): DerivedReferentKey => {
    switch (referent.referentType) {
        case 'actingCharacter':
            return 'actingCharacter'
        case 'objectSpan':
            return `span:${referent.stableRefKey}`
        case 'currentHost':
            return `currentHost(${derivedReferentKey(referent.referentTarget)})`
        case 'graphNode':
            return `graphNode:${referent.groundedId}`
    }
}

/**
 * Grounding's input: one value per referent, in two namespaces with different
 * lifetimes. A span's value is decided once, when identities are selected, and belongs to
 * the candidate wherever it goes --- keyed by `stableRefKey` (Identify/Plan's key). A derived
 * value (`actingCharacter`, `currentHost(X)`) is a fact about one snapshot of the world, built
 * fresh by whoever holds that snapshot --- keyed structurally, by `derivedReferentKey`.
 */
export type ReferentAssignment = {
    spans: ReadonlyMap<string, GroundedId>
    derived: ReadonlyMap<DerivedReferentKey, GroundedId>
}

/** Every referent slot of a step, whatever its kind. */
export const stepReferents = (step: PlanStep): Referent[] =>
    step.kind === 'assertion'
        ? [step.subject, step.object]
        : step.primitive === 'transferMembership'
            ? [step.object, step.from, step.to]
            : step.primitive === 'extend'
                ? [step.object]
                : step.primitive === 'assignEdgeRelations' || step.primitive === 'dissolveEdgeRelations'
                    ? edgeRelationReferents(step)
                    : [step.subject, step.target]

/** True when every referent of this step carries a known id. */
export const isGroundedStep = (step: PlanStep): step is PlanStep<GroundedReferent> =>
    stepReferents(step).every((referent) => referent.groundedId !== undefined)
