/**
 * Lives in the shared package, not in either caller, on the same ground as
 * `classifyLudicGraphPortMismatch`: this comparison is the diagnostics sweep's classifier
 * (`lambda/diagnostics/presenceCoverDriftSweep/`) and the ephemera cover-rebuild heal's recheck
 * (`positions/ludicGraph/healPresenceCover.ts`). One definition of *drift* across both.
 *
 * It judges pointer versus cover, in both directions. A member's `fromHostPresences` govern; the host's
 * `cover` is a stored index of it. The rule is positive (PR-25): for every parent binding whose cover lists
 * a member, exactly one of that member's bindings has that parent binding in its parent set. From the host's side (`classifyPresenceCoverDrift`) it walks the nodes the
 * host lists; from the member's side (`orphanedPointersOf`) it walks the pointers the member holds, which is the
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
    /** A covered member holds no binding at all into the host. Reported, never minted. */
    | { kind: 'Unbound'; member: string; presence: string }
    /** A covered member holds more than one binding naming the same host binding. */
    | { kind: 'Duplicate'; member: string; presence: string }
    /** A member binding names a host binding that is absent, or whose cover does not include the member. */
    | { kind: 'Stale'; member: string; presence?: string }
    /** A component node of the host that no binding covers (the coverage invariant). */
    | { kind: 'Uncovered'; member: string }
    /** A binding with no parent pointer beyond the first: a host has at most one hostless binding. */
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

/** The component nodes of the host that are members: everything but the root (in every bucket) and presence nodes. */
const BASE_ID = 'PRESENCE#Base'
const UNPLACED_ID = 'PRESENCE#Unplaced'

/** A host that holds presence bindings but none is `PRESENCE#Base`: every writer mints Base, so this is drift, reported and never healed. */
export const lacksBase = (host: PresenceGraphView): boolean => (
    host.presenceNodes.length > 0 && !host.presenceNodes.some((binding) => binding.universalKey === BASE_ID)
)

export const hostMembersOf = (host: PresenceGraphView): string[] => (
    [...new Set(host.nodeIds)].filter((id) => isComponentId(id) && id !== host.hostId)
)

/** What each binding of the host covers: its listed entries that are members of the host. */
export const coveredByBinding = (host: PresenceGraphView): Map<string, Set<string>> => {
    const members = new Set(hostMembersOf(host))
    return new Map(host.presenceNodes.map((binding) => [
        binding.universalKey,
        new Set(listedHosts(binding).filter((id) => members.has(id))),
    ]))
}

/**
 * The coverage invariant, judged on the host's own graph: every member is covered by at least one
 * binding, and a
 * host has at most one hostless binding, meaning one with no parent pointer. `hostlessBindings`
 * lists every hostless binding's key, and only when there is more than one.
 */
export const coverageViolationsOf = (host: PresenceGraphView): { uncovered: string[]; hostlessBindings: string[]; badUnplaced: string[] } => {
    const covered = new Set([...coveredByBinding(host).values()].flatMap((members) => [...members]))
    const hostless = host.presenceNodes.filter((binding) => parentPointersOf(binding).length === 0).map((binding) => binding.universalKey)
    const base = host.presenceNodes.find((binding) => binding.universalKey === BASE_ID)
    const unplaced = host.presenceNodes.find((binding) => binding.universalKey === UNPLACED_ID)
    return {
        uncovered: hostMembersOf(host).filter((member) => !covered.has(member)),
        hostlessBindings: hostless.length > 1 ? hostless : [],
        badUnplaced: unplaced && (parentPointersOf(unplaced).length > 0 || !base || parentPointersOf(base).length === 0) ? [unplaced.universalKey] : [],
    }
}

/**
 * `memberGraph` returns a member's own graph view, or `undefined` when it cannot be read; an
 * unreadable member is skipped (its absence is not drift this comparison can see).
 *
 * A member pointer with no `presence` (written into a parent with several bindings) is compared at host
 * grain only: it satisfies "bound into this host" and is never a count mismatch.
 */
export const classifyPresenceCoverDrift = (
    host: PresenceGraphView,
    memberGraph: (memberId: string) => PresenceGraphView | undefined
): PresenceCoverDriftVerdict => {
    const covered = coveredByBinding(host)
    const findings: PresenceCoverDriftFinding[] = []
    const violations = coverageViolationsOf(host)

    for (const member of hostMembersOf(host)) {
        const graph = memberGraph(member)
        if (!graph) {
            continue
        }
        const pointers = graph.presenceNodes
            .flatMap(parentPointersOf)
            .filter((pointer) => pointer.host === host.hostId)
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
 * A pointer with no `presence` (a retired shape) is skipped; the host's side reads it as `Stale`.
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
 * The cover entries a binding should list, rebuilt from members' pointers: one entry for every binding of
 * every member whose parent set names it (a shared binding is listed by each parent it names; a second
 * binding naming it too is listed as well, so the cover stays an index of the pointers and the
 * `Duplicate` finding stays visible).
 */
export const rebuiltCoverEntries = (
    host: PresenceGraphView,
    bindingId: string,
    memberGraph: (memberId: string) => PresenceGraphView | undefined
): { host: string; presence: string }[] => (
    hostMembersOf(host).flatMap((member) => {
        const graph = memberGraph(member)
        return (graph?.presenceNodes ?? [])
            .filter((binding) => parentPointersOf(binding).some((pointer) => pointer.host === host.hostId && pointer.presence === bindingId))
            .map((binding) => ({ host: member, presence: binding.universalKey }))
    })
)

const entryKey = (entry: { host: string; presence?: string }): string => `${entry.host}|${entry.presence ?? ''}`

/**
 * The covers the heal can rewrite: each binding whose listed entries differ from
 * `rebuiltCoverEntries`. One definition shared by the sweep (it emits a finding only when this is
 * non-empty, so a report-only finding never keeps a rerun from reading zero) and the heal.
 */
export const coverRebuildsFor = (
    host: PresenceGraphView,
    memberGraph: (memberId: string) => PresenceGraphView | undefined
): { bindingId: string; entries: { host: string; presence: string }[] }[] => (
    host.presenceNodes.flatMap((binding) => {
        const entries = rebuiltCoverEntries(host, binding.universalKey, memberGraph)
        const stored = new Set(binding.cover.members.map(entryKey))
        const rebuilt = new Set(entries.map(entryKey))
        const same = stored.size === rebuilt.size && [...stored].every((key) => rebuilt.has(key))
        return same ? [] : [{ bindingId: binding.universalKey, entries }]
    })
)
