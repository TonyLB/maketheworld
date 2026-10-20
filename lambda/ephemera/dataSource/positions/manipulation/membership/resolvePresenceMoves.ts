import { isEphemeraAreaId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { GroundedPresence } from '../../../actions/enrich/objectManipulation/plan/planStep'
import type { EphemeraLudicGraphStructureNode, EphemeraPresenceCover, EphemeraPresenceCoverEntry } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { childParentBindingIdOf, unpointedBindingOf, bindingHasParent, bindingHasParentOn, parentHostsOf, parentsOf } from '../../ludicGraph/presenceParent'
import type { ParentBinding } from '../../ludicGraph/presenceParent'
import type { MutationKernelStep } from '../kernel/kernelStep'

export type ResolvePresenceMovesArgs = {
    moved: EphemeraMembershipHostId
    froms: readonly EphemeraMembershipHostId[]
    to: EphemeraMembershipHostId | null
    /**
     * Where the destination is seen in the host that holds it (`groundedPresence`): narrows which of
     * the destination's own bindings the mover lands under. Absent, the destination's only binding.
     */
    toGroundedPresence?: readonly GroundedPresence[]
    /**
     * Where the mover is seen in the host it leaves (`groundedPresence`): names which of that host's
     * buckets it sits in, so a mover holding several bindings under one host (a plank under two
     * bindings of a table) is told apart by binding. Absent, the host alone must be enough.
     */
    moverGroundedPresence?: readonly GroundedPresence[]
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
}

export type ResolvedPresenceMoves =
    | { ok: true; steps: MutationKernelStep[] }
    | { ok: false; errorCode: 'destinationBindingMissing' | 'destinationBindingAmbiguous' | 'moverBindingAmbiguous' }

/**
 * The hosts whose bindings a set of moves into one receiver may merge below it: a child listed under
 * more than one of the covers ends holding several bindings under the receiver, which the move merges
 * one level down, re-pointing the merged bindings' own children, and so on. Names only the hosts; the
 * handler verifies each read under the lock.
 */
const cascadeHostsOf = async (
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>,
    covers: readonly EphemeraPresenceCover[]
): Promise<EphemeraMembershipHostId[]> => {
    const hosts = new Set<EphemeraMembershipHostId>()
    const visit = async (entries: readonly EphemeraPresenceCoverEntry[]): Promise<void> => {
        const byHost = new Map<EphemeraMembershipHostId, EphemeraPresenceCoverEntry[]>()
        for (const entry of entries) {
            byHost.set(entry.host as EphemeraMembershipHostId, [...(byHost.get(entry.host as EphemeraMembershipHostId) ?? []), entry])
        }
        for (const [host, colliding] of byHost) {
            if (colliding.length < 2) {
                continue
            }
            const graph = await getGraph(host)
            const grandchildren = colliding.flatMap(({ presence }) => (
                graph.presenceNodes.find(({ universalKey }) => universalKey === presence)?.cover.members ?? []
            ))
            grandchildren.forEach(({ host: grandchildHost }) => hosts.add(grandchildHost as EphemeraMembershipHostId))
            await visit(grandchildren)
        }
    }
    await visit(covers.flatMap((cover) => cover.members))
    return [...hosts]
}

/** Whether a binding's parent pointer names one of the buckets where its whole is seen. */
const sitsUnderSeenBucket = (
    binding: EphemeraLudicGraphStructureNode,
    seen: readonly GroundedPresence[]
): boolean => seen.some((bucket) => (
    parentsOf(binding).some((parent) => (
        typeof bucket === 'string'
            ? parent.host === bucket
            : parent.host === bucket.host && parent.presence === bucket.presence
    ))
))

/** The bindings of a destination's own graph whose pointer names a bucket where it is seen. */
const bindingsUnderSeenBuckets = (
    destGraph: EphemeraLudicGraph,
    seen: readonly GroundedPresence[]
): EphemeraPresenceNodeId[] => (
    destGraph.presenceNodes
        .filter((node) => sitsUnderSeenBucket(node, seen))
        .map(({ universalKey }) => universalKey)
)

/**
 * The binding of the destination that a mover will sit under: a Room's or Area's hostless
 * remainder; otherwise the one named by where the destination is seen, else its only binding.
 * Never a guess: none, or several, is a refusal the caller reports.
 */
export const destinationBindingOf = (
    destGraph: EphemeraLudicGraph,
    seen: readonly GroundedPresence[] | undefined
): { presence: EphemeraPresenceNodeId } | { errorCode: 'destinationBindingMissing' | 'destinationBindingAmbiguous' } => {
    if (isEphemeraRoomId(destGraph.hostId) || isEphemeraAreaId(destGraph.hostId)) {
        const base = childParentBindingIdOf(destGraph)
        return base ? { presence: base } : { errorCode: 'destinationBindingMissing' }
    }
    if (seen && seen.length > 0) {
        const matches = bindingsUnderSeenBuckets(destGraph, seen)
        if (matches.length === 1) {
            return { presence: matches[0] }
        }
        if (matches.length > 1) {
            return { errorCode: 'destinationBindingAmbiguous' }
        }
    }
    const only = childParentBindingIdOf(destGraph)
    if (only) {
        return { presence: only }
    }
    return { errorCode: destGraph.presenceNodes.length === 0 ? 'destinationBindingMissing' : 'destinationBindingAmbiguous' }
}

const hostsOfCover = (cover: EphemeraPresenceCover): EphemeraMembershipHostId[] => (
    [...new Set(cover.members.map(({ host }) => host as EphemeraMembershipHostId))]
)

/**
 * The joins that put `toJoin` into `into` (one host's bindings, all about to sit under one parent),
 * and then the joins one level down for the children that now collide beneath `into`. The survivor of
 * a child join is a binding already in `into`'s cover when there is one (PS-5), never decided by
 * comparing covers (PS-7). Each step names the hosts it reads: the parents of every binding it
 * joins (their covers are the index) and the hosts of the children it re-parents.
 */
const joinStepsFor = async (
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>,
    hostId: EphemeraMembershipHostId,
    into: EphemeraLudicGraphStructureNode,
    toJoin: readonly EphemeraLudicGraphStructureNode[],
    extraParents: readonly ParentBinding[]
): Promise<MutationKernelStep[]> => {
    const parentHosts = [...new Set([
        ...extraParents.map(({ host }) => host),
        ...[into, ...toJoin].flatMap(parentHostsOf),
    ])]
    const joinedEntries = toJoin.flatMap(({ cover }) => cover.members)
    const childHosts = hostsOfCover({ members: [...into.cover.members, ...joinedEntries] })
    const cascadeHosts = [...new Set([...parentHosts, ...childHosts])]
    const step: MutationKernelStep = {
        kind: 'joinPresenceBindings',
        hostId,
        into: into.universalKey,
        toJoin: toJoin.map(({ universalKey }) => universalKey),
        ...(cascadeHosts.length > 0 ? { cascadeHosts } : {}),
    }
    const kept = new Set(into.cover.members.map(({ presence }) => presence))
    const below: MutationKernelStep[] = []
    for (const childHost of childHosts) {
        const entries = [...new Map([...into.cover.members, ...joinedEntries]
            .filter((entry) => entry.host === childHost)
            .map((entry) => [entry.presence, entry])).values()]
        if (entries.length < 2 || entries.every(({ presence }) => kept.has(presence))) {
            continue
        }
        const graph = await getGraph(childHost)
        const bindings = entries.flatMap(({ presence }) => {
            const found = graph.presenceNodes.find(({ universalKey }) => universalKey === presence)
            return found ? [found] : []
        })
        const survivor = bindings.find(({ universalKey }) => kept.has(universalKey)) ?? bindings[0]
        if (!survivor) {
            continue
        }
        below.push(...await joinStepsFor(getGraph, childHost, survivor, bindings.filter((binding) => binding !== survivor), []))
    }
    return [step, ...below]
}

/**
 * Splits a part of a binding's cover off as a fresh piece and gives the fresh piece the parents the
 * request names (PS-2, M9/M9a): the kept piece holds the rest of the cover under all the original's
 * parents, and the fresh piece starts under the same parents and is then reparented (`lose` the ones it
 * must not keep, `gain` its new ones). So the part leaves the binding's cover everywhere and Base's own
 * parents never change as a side effect (PS-3(b)). A split whose pieces take *different parents*, so
 * that one parent's view changes and another's does not (M6, M17), is written as a split by hand; no
 * caller asks for either yet (PS-4), so this is only the tested seam a part-move request will use.
 */
export const partMoveSteps = (args: {
    hostId: EphemeraMembershipHostId
    binding: EphemeraLudicGraphStructureNode
    part: readonly EphemeraPresenceCoverEntry[]
    presenceUuid: string
    lose?: readonly ParentBinding[]
    gain?: readonly ParentBinding[]
}): MutationKernelStep[] => {
    const { hostId, binding, part, presenceUuid } = args
    const parents = parentsOf(binding)
    const inPart = (entry: EphemeraPresenceCoverEntry) => part.some(({ host, presence }) => host === entry.host && presence === entry.presence)
    const fresh = PresenceKey(presenceUuid) as EphemeraPresenceNodeId
    const hosts = hostsOfCover({ members: [...part] })
    return [
        {
            kind: 'splitPresenceBinding',
            hostId,
            presence: binding.universalKey,
            pieces: [
                { presence: binding.universalKey, parents, cover: { members: binding.cover.members.filter((entry) => !inPart(entry)) } },
                { presenceUuid, parents, cover: { members: [...part] } },
            ],
        },
        {
            kind: 'reparentPresenceBinding',
            hostId,
            presence: fresh,
            ...(args.lose && args.lose.length > 0 ? { lose: args.lose } : {}),
            ...(args.gain && args.gain.length > 0 ? { gain: args.gain } : {}),
            ...(hosts.length > 0 ? { cascadeHosts: hosts } : {}),
        },
    ]
}

/**
 * The planner's half of a binding-addressed move: reads the mover's graph and the destination's and
 * writes the Framework F steps that make the move (`reparentPresenceBinding`, `joinPresenceBindings`).
 * The kernel re-verifies each inside the lock, so a read gone stale is `stale`, not a wrong write.
 *
 * - **A departure** (`to: null`) reparents every binding of the mover that has a parent on a `from`
 *   host, losing every parent on those hosts (PR-25 rule 1). The run's end removes a binding left with
 *   no parent and drops its children to Unplaced (F-R1). A mover with none names nothing, and any node
 *   it holds in those hosts is drift the kernel leaves to the sweeps.
 * - **A mover with a binding under a `from` host** reparents that binding: it loses every parent on the
 *   `from` hosts and gains the destination binding, keeping its id. Several distinct bindings under one
 *   host are told apart by where the mover is seen (`moverGroundedPresence`); still several, or no such
 *   name, is a refusal. One shared binding with several parents on the host is one mover.
 * - **Convergence.** Several bindings (a scrub), or a mover already holding a binding under the
 *   destination, end up under one parent. A join follows the reparents (the binding already under the
 *   destination survives, Base always does), then the joins for the children that collide beneath it.
 *   Covers are never compared.
 * - **A mover with none** (a first placement, a connect, or a legacy whole) gains the destination for its
 *   hostless binding; if it holds no hostless binding, a Base is minted ahead of the reparent.
 */
export const resolvePresenceMoves = async (args: ResolvePresenceMovesArgs): Promise<ResolvedPresenceMoves> => {
    const hostId = args.moved
    if (args.to === null) {
        const departing = (await args.getGraph(args.moved)).presenceNodes.filter((node) => args.froms.some((from) => bindingHasParentOn(node, from)))
        const cascadeHosts = await cascadeHostsOf(args.getGraph, departing.map(({ cover }) => cover))
        return {
            ok: true,
            steps: departing.map((node): MutationKernelStep => {
                const hosts = [...new Set([...hostsOfCover(node.cover), ...cascadeHosts])]
                return {
                    kind: 'reparentPresenceBinding',
                    hostId,
                    presence: node.universalKey,
                    lose: parentsOf(node).filter(({ host }) => args.froms.includes(host)),
                    ...(hosts.length > 0 ? { cascadeHosts: hosts } : {}),
                }
            }),
        }
    }
    const destination = destinationBindingOf(await args.getGraph(args.to), args.toGroundedPresence)
    if ('errorCode' in destination) {
        return { ok: false, errorCode: destination.errorCode }
    }
    const to: ParentBinding = { host: args.to, presence: destination.presence }

    const moverGraph = await args.getGraph(args.moved)
    const departing = args.froms.map((fromHostId) => {
        const underHost = moverGraph.presenceNodes.filter((node) => bindingHasParentOn(node, fromHostId))
        const seen = args.moverGroundedPresence
        const narrowed = underHost.length > 1 && seen && seen.length > 0
            ? underHost.filter((node) => sitsUnderSeenBucket(node, seen))
            : underHost
        return narrowed.length > 0 ? narrowed : underHost
    })
    if (departing.some((nodes) => nodes.length > 1)) {
        return { ok: false, errorCode: 'moverBindingAmbiguous' }
    }
    const named = [...new Map(departing.flatMap((nodes) => nodes).map((node) => [node.universalKey, node])).values()]

    // A mover with no binding under a `from` host is placed from its hostless one, or from a Base minted now.
    const hostless = named.length > 0 ? undefined : unpointedBindingOf(moverGraph)
    const mintsBase = named.length === 0 && !hostless
    const movers = named.length > 0 ? named : hostless ? [hostless] : []
    const moverIds = new Set(movers.map(({ universalKey }) => universalKey))

    const mintedId = PresenceKey('Base') as EphemeraPresenceNodeId
    const reparents = (mintsBase ? [{ universalKey: mintedId, lose: [] as ParentBinding[] }] : movers.map((node) => ({
        universalKey: node.universalKey,
        lose: parentsOf(node).filter(({ host }) => args.froms.includes(host)),
    }))).map(({ universalKey, lose }): MutationKernelStep => ({
        kind: 'reparentPresenceBinding',
        hostId,
        presence: universalKey,
        ...(lose.length > 0 ? { lose } : {}),
        gain: [to],
    }))

    const existing = moverGraph.presenceNodes.filter((node) => !moverIds.has(node.universalKey) && bindingHasParent(node, to))
    const under = [...movers, ...existing]
    const joins: MutationKernelStep[] = []
    if (under.length > 1) {
        const survivor = under.find(({ universalKey }) => universalKey === BASE_PRESENCE_ID) ?? existing[0] ?? movers[0]
        joins.push(...await joinStepsFor(args.getGraph, hostId, survivor, under.filter((node) => node !== survivor), [to]))
    }
    return {
        ok: true,
        steps: [
            ...(mintsBase ? [{ kind: 'addPresenceBinding' as const, hostId, fromHostPresences: [], presenceUuid: 'Base' }] : []),
            ...reparents,
            ...joins,
        ],
    }
}
