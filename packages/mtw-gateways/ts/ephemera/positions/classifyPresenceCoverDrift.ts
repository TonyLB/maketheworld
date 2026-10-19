/**
 * Lives in the shared package, not in either caller, on the same ground as
 * `classifyLudicGraphPortMismatch`: this comparison is the diagnostics sweep's classifier
 * (`lambda/diagnostics/presenceCoverDriftSweep/`) and the ephemera cover-rebuild heal's recheck
 * (`positions/ludicGraph/healPresenceCover.ts`). One definition of *drift* across both.
 *
 * It judges pointer versus cover, in both directions. A member's `fromHostPresences` govern; the whole's
 * `cover` is a stored index of it. From the whole's side (`classifyPresenceCoverDrift`) it walks the nodes the
 * whole lists; from the member's side (`orphanedPointersOf`) it walks the pointers the member holds, which is the
 * only way to see a pointer whose host lacks the member's node. Plain structural types, so the sweep can feed raw stored rows and the heal
 * can feed parsed graphs.
 *
 * This comparison is the one authority for the binding-set rules (`SecondHostless`, `BadUnplaced`, and the
 * `lacksBase` check) for every kind, alongside pointer/node/cover agreement. Conformance of a never-moving
 * nesting to its authored asset is not judged here; that is `FixedContainmentDriftSweep`.
 */

export type PresenceCoverMember = { host: string; presence?: string }

export type PresenceBindingView = {
    universalKey: string
    fromHostPresences: { host: string; presence: string }[]
    cover: { members: PresenceCoverMember[] }
}

/** Every parent pointer of a binding, empty for a hostless one. The one read of the stored field in this package. */
export const parentPointersOf = (binding: PresenceBindingView): { host: string; presence: string }[] => binding.fromHostPresences

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
    /**
     * Judged from the member's side: the member's pointer names `host`'s binding `presence`, and `host`'s graph
     * lacks the member's node (or has no graph at all). Reported against the member, not the host.
     */
    | { kind: 'Orphaned'; host: string; presence: string }

export type PresenceCoverDriftVerdict = {
    findings: PresenceCoverDriftFinding[]
}

/** Presence nodes are not members of any bucket. */
const isComponentId = (id: string): boolean => !id.startsWith('PRESENCE#')

const listedHosts = (binding: PresenceBindingView): string[] => binding.cover.members.map((entry) => entry.host)

/** The component nodes of the whole that are members: everything but the root (in every bucket) and presence nodes. */
const BASE_ID = 'PRESENCE#Base'
const UNPLACED_ID = 'PRESENCE#Unplaced'

/** A whole that holds presence bindings but none is `PRESENCE#Base`: every writer mints Base, so this is drift, reported and never healed. */
export const lacksBase = (whole: PresenceGraphView): boolean => (
    whole.presenceNodes.length > 0 && !whole.presenceNodes.some((binding) => binding.universalKey === BASE_ID)
)

export const wholeMembersOf = (whole: PresenceGraphView): string[] => (
    [...new Set(whole.nodeIds)].filter((id) => isComponentId(id) && id !== whole.hostId)
)

/** What each binding of the whole covers: its listed entries that are members of the whole. */
export const coveredByBinding = (whole: PresenceGraphView): Map<string, Set<string>> => {
    const members = new Set(wholeMembersOf(whole))
    return new Map(whole.presenceNodes.map((binding) => [
        binding.universalKey,
        new Set(listedHosts(binding).filter((id) => members.has(id))),
    ]))
}

/**
 * The coverage invariant, judged on the whole's own graph: every member is covered by at least one
 * binding, and a
 * whole has at most one hostless binding, meaning one with no parent pointer. `hostlessBindings`
 * lists every hostless binding's key, and only when there is more than one.
 */
export const coverageViolationsOf = (whole: PresenceGraphView): { uncovered: string[]; hostlessBindings: string[]; badUnplaced: string[] } => {
    const covered = new Set([...coveredByBinding(whole).values()].flatMap((members) => [...members]))
    const hostless = whole.presenceNodes.filter((binding) => parentPointersOf(binding).length === 0).map((binding) => binding.universalKey)
    const base = whole.presenceNodes.find((binding) => binding.universalKey === BASE_ID)
    const unplaced = whole.presenceNodes.find((binding) => binding.universalKey === UNPLACED_ID)
    return {
        uncovered: wholeMembersOf(whole).filter((member) => !covered.has(member)),
        hostlessBindings: hostless.length > 1 ? hostless : [],
        badUnplaced: unplaced && (parentPointersOf(unplaced).length > 0 || !base || parentPointersOf(base).length === 0) ? [unplaced.universalKey] : [],
    }
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
    const findings: PresenceCoverDriftFinding[] = []
    const violations = coverageViolationsOf(whole)

    for (const member of wholeMembersOf(whole)) {
        const graph = memberGraph(member)
        if (!graph) {
            continue
        }
        const pointers = graph.presenceNodes
            .flatMap(parentPointersOf)
            .filter((pointer) => pointer.host === whole.hostId)
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
        findings: [
            ...findings,
            ...violations.uncovered.map((member): PresenceCoverDriftFinding => ({ kind: 'Uncovered', member })),
            ...violations.hostlessBindings.slice(1).map((presence): PresenceCoverDriftFinding => ({ kind: 'SecondHostless', presence })),
            ...violations.badUnplaced.map((presence): PresenceCoverDriftFinding => ({ kind: 'BadUnplaced', presence })),
        ],
    }
}

export type OrphanedPointer = {
    host: string
    presence: string
    /** The host's graph exists and holds the binding the pointer names, so a same-pointer repair can re-seat the node. */
    repairable: boolean
}

/** A character at a room is a bystander: never a node of the room's graph, so never an orphan. */
const isBystanderPointer = (member: string, host: string): boolean => member.startsWith('CHARACTER#') && host.startsWith('ROOM#')

/**
 * The member-side direction: each pointer the member holds whose host's graph lacks the member's node.
 * A pointer with no `presence` (a retired shape) is skipped; the whole's side reads it as `Stale`.
 * `repairable` is false when the host has no graph, or no binding with the pointer's `presence`: the repair
 * mints nothing, so it can only re-seat the node into a binding that exists.
 */
export const orphanedPointersOf = (
    member: PresenceGraphView,
    viewOf: (hostId: string) => PresenceGraphView | undefined
): OrphanedPointer[] => (
    member.presenceNodes.flatMap(parentPointersOf).flatMap((pointer): OrphanedPointer[] => {
        if (!pointer.presence || isBystanderPointer(member.hostId, pointer.host)) {
            return []
        }
        const host = viewOf(pointer.host)
        if (host?.nodeIds.includes(member.hostId)) {
            return []
        }
        const repairable = !!host?.presenceNodes.some((node) => node.universalKey === pointer.presence)
        return [{ host: pointer.host, presence: pointer.presence, repairable }]
    })
)

/** The bindings of the member a heal can repair in place: shared by the sweep (healable or not) and the heal. */
export const orphanRepairsFor = (
    member: PresenceGraphView,
    viewOf: (hostId: string) => PresenceGraphView | undefined
): { bindingId: string; fromHostPresence: { host: string; presence: string } }[] => {
    const repairable = new Set(orphanedPointersOf(member, viewOf).filter((orphan) => orphan.repairable).map((orphan) => `${orphan.host}|${orphan.presence}`))
    return member.presenceNodes.flatMap((binding) => (
        parentPointersOf(binding)
            .filter((pointer) => repairable.has(`${pointer.host}|${pointer.presence}`))
            .map((pointer) => ({ bindingId: binding.universalKey, fromHostPresence: pointer }))
    ))
}

/**
 * The cover entries a binding should list, rebuilt from members' pointers: the
 * members whose pointer names it..
 */
export const rebuiltCoverEntries = (
    whole: PresenceGraphView,
    bindingId: string,
    memberGraph: (memberId: string) => PresenceGraphView | undefined
): { host: string; presence: string }[] => (
    wholeMembersOf(whole).flatMap((member) => {
        const graph = memberGraph(member)
        const pointed = graph?.presenceNodes.find((binding) => (
            parentPointersOf(binding).some((pointer) => pointer.host === whole.hostId && pointer.presence === bindingId)
        ))
        return pointed ? [{ host: member, presence: pointed.universalKey }] : []
    })
)

const entryKey = (entry: { host: string; presence?: string }): string => `${entry.host}|${entry.presence ?? ''}`

/**
 * The covers the heal can rewrite: each binding whose listed entries differ from
 * `rebuiltCoverEntries`. One definition shared by the sweep (it emits a finding only when this is
 * non-empty, so a report-only finding never keeps a rerun from reading zero) and the heal.
 */
export const coverRebuildsFor = (
    whole: PresenceGraphView,
    memberGraph: (memberId: string) => PresenceGraphView | undefined
): { bindingId: string; entries: { host: string; presence: string }[] }[] => (
    whole.presenceNodes.flatMap((binding) => {
        const entries = rebuiltCoverEntries(whole, binding.universalKey, memberGraph)
        const stored = new Set(binding.cover.members.map(entryKey))
        const rebuilt = new Set(entries.map(entryKey))
        const same = stored.size === rebuilt.size && [...stored].every((key) => rebuilt.has(key))
        return same ? [] : [{ bindingId: binding.universalKey, entries }]
    })
)
