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
    return { noRemainder, findings }
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
