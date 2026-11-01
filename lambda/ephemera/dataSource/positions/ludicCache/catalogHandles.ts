/**
 * The handle boundary (CC3): the catalog's projection of a cache into flat handles. `buildLudicCache`
 * stays a pure function; `handlesFromCache` is the projection a consumer reads through, today only
 * `ActorLudicCache.handles()` (`actorCache.ts`, private behind its `entries()` catalog). Nothing past this function's return
 * type is `EphemeraLudicCacheData`-shaped --- a caller gets flat `{ objectId, shortName }` handles,
 * never `nodes`/`edges`/`ports`. This is the catalog's boundary type, not a P6 rule: P6 clause 3
 * says only that the cache never authorizes a change (acting traverses `ludicGraph`), so planning
 * may read cache structure elsewhere; the catalog needs only handles.
 *
 * **Exhaustive, not bucket-filtered, by deliberate choice this slice.** The cache is presence-aware
 * internally (its own `cover` structure), but this projection still returns every object node the
 * walk reaches, matching `collectNestedObjectIds`'s old scope exactly. Filtering the pool to the
 * caller's own presence bucket (AB-9's read-path half) is open debt, not built here.
 *
 * **Each handle names every bucket it is seen in** (`presence`, the flat projection of `placement`, which also pairs each own binding with the parents it sits under): each binding in the cache whose
 * cover holds the object, plus each of the object's own bindings (a host is the root of its own
 * graph, so it is in each of its own buckets, though `cover` leaves the root out) --- walked or
 * not. The caller's perspective decides *which* thing a phrase means, not who can see it change,
 * so a bucket bound into a room the walk never reached counts, and a whole bound into several
 * rooms names every one. The seed room when it is in no bucket (the object sits in the room's own
 * graph and has no binding of its own; a room is a perspective root, so what sits in its graph is
 * seen in the room without one). Still flat scalars, and still not
 * a filter: this records where each thing is seen and drops nothing.
 *
 * **Physical presence only (AK-8).** The cache may reach an Object through a Concept (room -> Concept -> member), and
 * delivers more than it promises, but the catalog is built on physical presence: placements come only from the bindings a
 * walk down the DAG reaches from the rooms and characters (`physicallyReachedBindings`), and the walk treats a Concept as a
 * leaf it neither records nor passes through. So a terminal in the room and associated with a Concept has one reading (its
 * binding under the room), not a second part under the Concept; and an Object reached only through a Concept has no
 * placement and is not a handle.
 *
 * The rebuild log (`logLudicCacheRebuild`) is written where the cache is read, in `actorCache.ts`, and carries only counts
 * --- never `cache.nodes`/`edges` --- so log output stays as narrow as the handle boundary.
 */
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraConceptId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicCacheData, EphemeraLudicCacheNode, EphemeraLudicCachePresenceNode } from './types'
import { audienceBuckets, type PlacementBinding, type PresencePlacement } from '../../actions/objectViews'
import type { GroundedPresence } from '../../actions/enrich/objectManipulation/plan/planStep'

export type LudicCacheObjectHandle = {
    objectId: EphemeraObjectId
    shortName: string
    /** Reasoning gloss, present only where authored or improvised (see `AGENT.concepts.md`'s `CommandAttempt` section). Still a flat scalar, not a widening past the handle boundary this file's own header comment states. */
    gloss?: string
    /** Where the object is seen, structured: each owner's run of bindings, the object's own with the parents each sits under (see the header). The source of `presence`. */
    placement?: PresencePlacement[]
    /** Every presence bucket this object is seen in, each named with the host that owns it, or the seed room (see the header): `audienceBuckets(placement)`, set only where the handle is built. */
    presence?: GroundedPresence[]
}

const bindingKey = (host: string, presence: string) => `${host}|${presence}`

/**
 * The bindings a walk down the DAG reaches from the rooms and characters in the cache, through each binding's cover. A Concept
 * is a leaf the walk never records and never passes through, so a binding that hangs only under a Concept's (an associated
 * member's) is never reached (AK-8). Rooms the seed walk never reached still root the walk, so a whole bound into several rooms
 * keeps every part (the cache over-delivers, and the catalog keeps what it is given); so does a non-Concept parent the cache
 * does not hold, the edge of what was walked.
 */
const physicallyReachedBindings = (cache: EphemeraLudicCacheData): Set<string> => {
    // A binding's children are the bindings whose parent pointers name it (which govern), and the cover entries that name a binding.
    const children = cache.nodes
        .filter(({ universalKey }) => !isEphemeraConceptId(universalKey))
        .flatMap((node) => node.presenceNodes.flatMap((binding) => [
            ...binding.fromHostPresences.map((parent) => [bindingKey(parent.host, parent.presence), bindingKey(node.universalKey, binding.universalKey)] as const),
            ...binding.cover.members.flatMap(({ host, presence }) => (
                presence === undefined || isEphemeraConceptId(host) ? [] : [[bindingKey(node.universalKey, binding.universalKey), bindingKey(host, presence)] as const]
            )),
        ]))
        .reduce((byParent, [parent, child]) => byParent.set(parent, [...(byParent.get(parent) ?? []), child]), new Map<string, string[]>())
    // A room or character roots the walk whether or not its node is in the cache, and so does any other host the cache does not
    // hold (the edge of what was walked, such as the table a half-held rope is tied to, in an actor-only fold), unless it is a Concept.
    const held = new Set(cache.nodes.map(({ universalKey }) => universalKey as string))
    const isRoot = (host: string) => isEphemeraRoomId(host) || isEphemeraCharacterId(host) || (!held.has(host) && !isEphemeraConceptId(host))
    const roots = [
        ...cache.nodes.filter(({ universalKey }) => isRoot(universalKey))
            .flatMap((node) => node.presenceNodes.map((binding) => bindingKey(node.universalKey, binding.universalKey))),
        ...cache.nodes.flatMap((node) => node.presenceNodes.flatMap((binding) => binding.fromHostPresences))
            .filter(({ host }) => isRoot(host))
            .map(({ host, presence }) => bindingKey(host, presence)),
    ]
    const walk = (reached: Set<string>, key: string): Set<string> => (
        reached.has(key) ? reached : (children.get(key) ?? []).reduce(walk, new Set([...reached, key]))
    )
    return roots.reduce(walk, new Set<string>())
}

/**
 * Each host's placement: its own bindings and every binding in the cache whose cover holds it, deduped, in cache order (which the fold keeps byte-identical),
 * as runs of one owner's bindings (`audienceBuckets` flattens them back, in the same order).
 * Each bucket names its owner (the node whose binding it is), since the binding lives on the owner's graph, not the member's.
 * An own binding also records the parents it sits under and the rooms they reach (`PlacementBinding`), read from the binding's own parent pointers, which govern.
 * Only the bindings in `reached` count, as buckets and as own bindings, and a Concept is never a member here.
 */
const placementsByMember = (cache: EphemeraLudicCacheData, reached: ReadonlySet<string>): Map<string, PresencePlacement[]> => {
    const bindings = new Map(cache.nodes.flatMap((node) => node.presenceNodes.map((binding) => [bindingKey(node.universalKey, binding.universalKey), binding] as const)))
    const roomsReached = (host: EphemeraMembershipHostId, presence: EphemeraPresenceNodeId, seen: ReadonlySet<string> = new Set()): EphemeraRoomId[] => {
        if (isEphemeraRoomId(host)) {
            return [host]
        }
        const key = bindingKey(host, presence)
        const binding = bindings.get(key)
        return binding === undefined || seen.has(key)
            ? []
            : binding.fromHostPresences.flatMap((parent) => roomsReached(parent.host, parent.presence, new Set([...seen, key])))
    }
    const placementBinding = (node: EphemeraLudicCacheNode, binding: EphemeraLudicCachePresenceNode, forHost: string): PlacementBinding => {
        if (node.universalKey !== forHost) {
            return { presence: binding.universalKey }
        }
        return {
            presence: binding.universalKey,
            under: binding.fromHostPresences.map(({ host, presence }) => ({ host, presence })),
            rooms: [...new Set(binding.fromHostPresences.flatMap(({ host, presence }) => roomsReached(host, presence)))],
        }
    }
    const addBucket = (placements: Map<string, PresencePlacement[]>, host: string, owner: EphemeraMembershipHostId, binding: PlacementBinding) => {
        const held = placements.get(host) ?? []
        if (held.some((run) => run.host === owner && run.bindings.some(({ presence }) => presence === binding.presence))) {
            return placements
        }
        const last = held[held.length - 1]
        return new Map(placements).set(host, last?.host === owner
            ? [...held.slice(0, -1), { host: owner, bindings: [...last.bindings, binding] }]
            : [...held, { host: owner, bindings: [binding] }]
        )
    }
    return cache.nodes.reduce(
        (byNode, node) => node.presenceNodes.filter((binding) => reached.has(bindingKey(node.universalKey, binding.universalKey))).reduce(
            (byBinding, binding) => [node.universalKey, ...binding.cover.members.map(({ host }) => host).filter((host) => !isEphemeraConceptId(host))].reduce(
                (byHost, host) => addBucket(byHost, host, node.universalKey as EphemeraMembershipHostId, placementBinding(node, binding, host)),
                byBinding
            ),
            byNode
        ),
        new Map<string, PresencePlacement[]>()
    )
}

export const handlesFromCache = (
    cache: EphemeraLudicCacheData,
    seedHostId: EphemeraMembershipHostId
): LudicCacheObjectHandle[] => {
    const handles: LudicCacheObjectHandle[] = []
    const placements = placementsByMember(cache, physicallyReachedBindings(cache))
    const seedRoom = isEphemeraRoomId(seedHostId) ? seedHostId : undefined
    // Bound or covered somewhere, but in no binding the walk reached: present only through a Concept, so not a handle.
    const placed = new Set(cache.nodes.flatMap((node) => [
        ...(node.presenceNodes.length > 0 ? [node.universalKey as string] : []),
        ...node.presenceNodes.flatMap((binding) => binding.cover.members.map(({ host }) => host as string)),
    ]))
    for (const node of cache.nodes) {
        if (!isEphemeraObjectId(node.universalKey) || node.shortName === undefined) {
            continue
        }
        const reachedPlacement = placements.get(node.universalKey)
        if (reachedPlacement === undefined && placed.has(node.universalKey)) {
            continue
        }
        const placement: PresencePlacement[] | undefined = reachedPlacement ?? (seedRoom !== undefined ? [{ host: seedRoom, bindings: [] }] : undefined)
        handles.push({
            objectId: node.universalKey,
            shortName: node.shortName,
            ...(node.gloss !== undefined ? { gloss: node.gloss } : {}),
            ...(placement !== undefined ? { placement, presence: audienceBuckets(placement) } : {}),
        })
    }
    return handles
}

/**
 * The short names of the Concepts the cache reaches, flat (AK-8): the name-only lookup behind the kind-aware refusal
 * reads these and nothing else. They never enter the catalog, so a Concept cannot compete with an object in ranking.
 */
export const conceptNamesFromCache = (cache: EphemeraLudicCacheData): string[] => (
    cache.nodes.flatMap((node) => (isEphemeraConceptId(node.universalKey) && node.shortName !== undefined ? [node.shortName] : []))
)
