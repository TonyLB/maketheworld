/**
 * Lives in the shared package, not in either caller, on the same ground as
 * `classifyLudicGraphPortMismatch`: this comparison is the diagnostics sweep's classifier
 * (`lambda/diagnostics/presenceCoverDriftSweep/`) and the ephemera cover-rebuild heal's recheck
 * (`positions/ludicGraph/healPresenceCover.ts`). One definition of *drift* across both.
 *
 * It judges pointer versus cover. A member's `fromHostPresence` governs; the whole's `cover` is a
 * stored index of it. Plain structural types, so the sweep can feed raw stored rows and the heal
 * can feed parsed graphs.
 */

export type PresenceCoverMember = { host: string; presence?: string } | { tag: 'Remainder' }

export type PresenceBindingView = {
    universalKey: string
    fromHostPresence?: { host: string; presence: string }
    cover: { members: PresenceCoverMember[] }
}

/** The part of a host's graph this comparison reads. `nodeIds` are component nodes, root included. */
export type PresenceGraphView = {
    hostId: string
    nodeIds: string[]
    presenceNodes: PresenceBindingView[]
}

export type PresenceCoverDriftFinding =
    /** A covered member holds no binding at all into the whole. Reported, never minted. */
    | { kind: 'Unbound'; member: string; presence: string }
    /** A covered member holds more than one binding naming the same whole binding. */
    | { kind: 'Duplicate'; member: string; presence: string }
    /** A member binding names a whole binding that is absent, or whose cover does not include the member. */
    | { kind: 'Stale'; member: string; presence?: string }
    /** A component node of the whole that no binding covers (the coverage invariant). */
    | { kind: 'Uncovered'; member: string }
    /** A binding with no parent pointer beyond the first: a whole has at most one hostless binding. */
    | { kind: 'SecondHostless'; presence: string }
    /** An `Unplaced` binding that holds a parent pointer, or that exists while `Base` is hostless or absent. */
    | { kind: 'BadUnplaced'; presence: string }

export type PresenceCoverDriftVerdict = {
    /** The whole holds no remainder: legal only while every member is listed explicitly. */
    noRemainder: boolean
    findings: PresenceCoverDriftFinding[]
}

const isRemainder = (entry: PresenceCoverMember): entry is { tag: 'Remainder' } => 'tag' in entry && entry.tag === 'Remainder'

/** Presence nodes are not members of any bucket. */
const isComponentId = (id: string): boolean => !id.startsWith('PRESENCE#')

const listedHosts = (binding: PresenceBindingView): string[] => (
    binding.cover.members.flatMap((entry) => isRemainder(entry) ? [] : [entry.host])
)

/** The component nodes of the whole that are members: everything but the root (in every bucket) and presence nodes. */
const BASE_ID = 'PRESENCE#Base'
const UNPLACED_ID = 'PRESENCE#Unplaced'

export const wholeMembersOf = (whole: PresenceGraphView): string[] => (
    [...new Set(whole.nodeIds)].filter((id) => isComponentId(id) && id !== whole.hostId)
)

/** What each binding of the whole covers, with `Remainder` expanded against the whole's claimed set. */
export const coveredByBinding = (whole: PresenceGraphView): Map<string, Set<string>> => {
    const members = wholeMembersOf(whole)
    const claimed = new Set(whole.presenceNodes.flatMap(listedHosts))
    const unclaimed = members.filter((id) => !claimed.has(id))
    return new Map(whole.presenceNodes.map((binding) => [
        binding.universalKey,
        new Set([
            ...listedHosts(binding).filter((id) => members.includes(id)),
            ...(binding.cover.members.some(isRemainder) ? unclaimed : []),
        ]),
    ]))
}

/**
 * The coverage invariant, judged on the whole's own graph: every member is covered by at least one
 * binding (a `Remainder` covers every unlisted member, so it satisfies this while it exists), and a
 * whole has at most one hostless binding, meaning one with no parent pointer. `hostlessBindings`
 * lists every hostless binding's key, and only when there is more than one.
 */
export const coverageViolationsOf = (whole: PresenceGraphView): { uncovered: string[]; hostlessBindings: string[]; badUnplaced: string[] } => {
    const covered = new Set([...coveredByBinding(whole).values()].flatMap((members) => [...members]))
    const hostless = whole.presenceNodes.filter((binding) => !binding.fromHostPresence).map((binding) => binding.universalKey)
    const base = whole.presenceNodes.find((binding) => binding.universalKey === BASE_ID)
    const unplaced = whole.presenceNodes.find((binding) => binding.universalKey === UNPLACED_ID)
    return {
        uncovered: wholeMembersOf(whole).filter((member) => !covered.has(member)),
        hostlessBindings: hostless.length > 1 ? hostless : [],
        badUnplaced: unplaced && (unplaced.fromHostPresence || !base?.fromHostPresence) ? [unplaced.universalKey] : [],
    }
}

/**
 * The binding the Base migration works on: `PRESENCE#Base` if the whole has one; otherwise a Room's
 * or Area's hostless binding, else any other whole's only binding. Never guesses: no binding, or
 * several with none to pick, is `undefined` (the whole is unmigratable and is reported, not healed).
 */
export const baseMigrationHolderOf = (whole: PresenceGraphView): PresenceBindingView | undefined => {
    const base = whole.presenceNodes.find((binding) => binding.universalKey === BASE_ID)
    if (base) {
        return base
    }
    if (whole.hostId.startsWith('ROOM#') || whole.hostId.startsWith('AREA#')) {
        return whole.presenceNodes.find((binding) => !binding.fromHostPresence)
    }
    return whole.presenceNodes.length === 1 ? whole.presenceNodes[0] : undefined
}

/**
 * Stored data that predates monotone covers, judged on the whole's own graph through its migration
 * holder: the holder is not named `PRESENCE#Base` (`NoBase`, the missing-Base finding), or its cover
 * holds a `Remainder`. Kept apart from `classifyPresenceCoverDrift`'s findings, which the cover-drift
 * sweep reports on every whole: this is the containment sweep's trigger for the migration, and it
 * clears once the whole is migrated. A whole with no holder yields none.
 */
export type PresenceBaseMigrationDrift = 'RemainderCover' | 'NoBase'

export const baseMigrationDriftOf = (whole: PresenceGraphView): PresenceBaseMigrationDrift[] => {
    const holder = baseMigrationHolderOf(whole)
    return holder ? [
        ...(holder.universalKey !== BASE_ID ? ['NoBase' as const] : []),
        ...(holder.cover.members.some(isRemainder) ? ['RemainderCover' as const] : []),
    ] : []
}

/**
 * `memberGraph` returns a member's own graph view, or `undefined` when it cannot be read; an
 * unreadable member is skipped (its absence is not drift this comparison can see).
 *
 * A member pointer with no `presence` (written into a parent with several bindings) is compared at host
 * grain only: it satisfies "bound into this whole" and is never a count mismatch.
 */
export const classifyPresenceCoverDrift = (
    whole: PresenceGraphView,
    memberGraph: (memberId: string) => PresenceGraphView | undefined
): PresenceCoverDriftVerdict => {
    const covered = coveredByBinding(whole)
    const noRemainder = !whole.presenceNodes.some((binding) => binding.cover.members.some(isRemainder))
    const findings: PresenceCoverDriftFinding[] = []
    const violations = coverageViolationsOf(whole)

    for (const member of wholeMembersOf(whole)) {
        const graph = memberGraph(member)
        if (!graph) {
            continue
        }
        const pointers = graph.presenceNodes
            .map((binding) => binding.fromHostPresence)
            .filter((pointer): pointer is { host: string; presence: string } => !!pointer && pointer.host === whole.hostId)
        for (const [presence, members] of covered) {
            if (!members.has(member)) {
                continue
            }
            const count = pointers.filter((pointer) => pointer.presence === presence).length
            if (count === 0) {
                findings.push({ kind: pointers.length === 0 ? 'Unbound' : 'Stale', member, presence })
            }
            else if (count > 1) {
                findings.push({ kind: 'Duplicate', member, presence })
            }
        }
        for (const pointer of pointers) {
            if (!covered.get(pointer.presence)?.has(member)) {
                findings.push({ kind: 'Stale', member, presence: pointer.presence })
            }
        }
    }
    return {
        noRemainder,
        findings: [
            ...findings,
            ...violations.uncovered.map((member): PresenceCoverDriftFinding => ({ kind: 'Uncovered', member })),
            ...violations.hostlessBindings.slice(1).map((presence): PresenceCoverDriftFinding => ({ kind: 'SecondHostless', presence })),
            ...violations.badUnplaced.map((presence): PresenceCoverDriftFinding => ({ kind: 'BadUnplaced', presence })),
        ],
    }
}

/**
 * The cover entries a **remainder-free** binding should list, rebuilt from members' pointers: the
 * members whose pointer names it. A binding that holds a `Remainder` is never rebuilt (its
 * unlisted members are the remainder's, indistinguishable from stale pointers), only reported.
 */
export const rebuiltCoverEntries = (
    whole: PresenceGraphView,
    bindingId: string,
    memberGraph: (memberId: string) => PresenceGraphView | undefined
): { host: string; presence: string }[] => (
    wholeMembersOf(whole).flatMap((member) => {
        const graph = memberGraph(member)
        const pointed = graph?.presenceNodes.find((binding) => (
            binding.fromHostPresence?.host === whole.hostId && binding.fromHostPresence.presence === bindingId
        ))
        return pointed ? [{ host: member, presence: pointed.universalKey }] : []
    })
)

const entryKey = (entry: { host: string; presence?: string }): string => `${entry.host}|${entry.presence ?? ''}`

/**
 * The covers the heal can rewrite: each **remainder-free** binding whose listed entries differ from
 * `rebuiltCoverEntries`. One definition shared by the sweep (it emits a finding only when this is
 * non-empty, so a report-only finding never keeps a rerun from reading zero) and the heal.
 */
export const coverRebuildsFor = (
    whole: PresenceGraphView,
    memberGraph: (memberId: string) => PresenceGraphView | undefined
): { bindingId: string; entries: { host: string; presence: string }[] }[] => (
    whole.presenceNodes.flatMap((binding) => {
        if (binding.cover.members.some(isRemainder)) {
            return []
        }
        const entries = rebuiltCoverEntries(whole, binding.universalKey, memberGraph)
        const stored = new Set(binding.cover.members.flatMap((entry) => isRemainder(entry) ? [] : [entryKey(entry)]))
        const rebuilt = new Set(entries.map(entryKey))
        const same = stored.size === rebuilt.size && [...stored].every((key) => rebuilt.has(key))
        return same ? [] : [{ bindingId: binding.universalKey, entries }]
    })
)
