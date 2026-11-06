/**
 * The scene model's builder (sceneProjection Slice 1): a forward walk over covers from the room, then the actor, to full
 * depth. A sibling of `catalogHandles.ts` and `roomObjectContents.ts`; like them, nothing past its return type is
 * cache-shaped (`sceneModel.ts`).
 *
 * **Lines are bindings.** A cover entry names the member's own binding into the covering host, and that binding's cover
 * is what sits under it, so a thing with several bindings (a spread rope or cloth) has one line per binding, each under its
 * own parent, and `elsewhere` names where its other bindings are (SP-2). Only physical placement makes a line: Objects
 * and Features are placed, a Concept is listed apart and never placed, and an `Associated` binding gives no line
 * (association is not placement). Characters are not lines: the actor is the root of the held section, and other
 * characters are bystanders the scene leaves out (SP-4).
 *
 * **Joins.** A binding with two or more parents among the scene's lines is described once, as the next sibling of the last
 * of those parent lines in walk order, and each parent line refers to it (SP-9).
 *
 * **Handles** are numbered after the tree is built, in pre-order over the room's contents, then the Concepts, then the
 * held section; a thing is numbered where it is first placed (SP-1). A `handleSeed` keeps the handles of an earlier scene of the same place, so
 * that a scene after a change names each thing as the scene before it did, wherever the walk now reaches it.
 *
 * **Relations** are held on their subject. A `Custom` edge that `Justifies` a `SecuredTo` is one tie (`secured`), and the
 * `SecuredTo` it supports is not repeated; `ConnectedTo` and `Justifies` give no relation of their own (SP-3). A relation
 * whose subject has no line (the actor, a bystander) is left out.
 */
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraConceptId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraHostingKind, EphemeraPresenceParentPointer } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicBindingAddress, isEphemeraLudicCrossingPortAddress, isEphemeraLudicNodeTerminal } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { defaultHostingKind } from '../manipulation/kernel/settleMembership'
import { securedToSupportPairsOfEdges } from './boundaryRelations'
import {
    sceneHandle,
    sceneSlug,
    type SceneEntry,
    type SceneExit,
    type SceneHandle,
    type SceneHandleTable,
    type SceneLocation,
    type SceneRelation,
    type SceneRelationTarget,
    type SceneResult,
    type SceneThing,
    type SceneThingKind,
} from './sceneModel'
import type { EphemeraLudicCacheCoverEntry, EphemeraLudicCacheData, EphemeraLudicCacheEdge, EphemeraLudicCachePresenceNode } from './types'

export type SceneOptions = {
    roomId: EphemeraRoomId
    actorId: EphemeraCharacterId
    exits?: SceneExit[]
    /** Handles already given: each id here keeps its handle, and any other is numbered around them. */
    handleSeed?: SceneHandleTable
}

/** The entries before handles: ids and binding keys. */
type RawLine = {
    kind: 'line'
    id: string
    /** This line's binding (`host|presence`); absent when the cover entry names none, which leaves the line with no children. */
    key?: string
    hostingKind: EphemeraHostingKind
    joins: EphemeraLudicCacheCoverEntry[]
    children: RawEntry[]
}
type RawJoin = {
    kind: 'join'
    id: string
    key: string
    hostingKind: EphemeraHostingKind
    host: string
    children: RawEntry[]
}
type RawEntry = RawLine | RawJoin

/** How many of each join's parent lines the walk has built so far. */
type WalkState = ReadonlyMap<string, number>

const bindingKey = (host: string, presence: string) => `${host}|${presence}`
const entryKey = ({ host, presence }: EphemeraLudicCacheCoverEntry): string | undefined => presence === undefined ? undefined : bindingKey(host, presence)
const isPlaced = (id: string): boolean => isEphemeraObjectId(id) || isEphemeraFeatureId(id)
const thingKindOf = (id: string): SceneThingKind => isEphemeraConceptId(id) ? 'Concept' : isEphemeraFeatureId(id) ? 'Feature' : 'Object'
const dedupe = <T>(values: readonly T[], keyOf: (value: T) => string): T[] => values.filter((value, index) => values.findIndex((other) => keyOf(other) === keyOf(value)) === index)
const coverEntryIdentity = (entry: EphemeraLudicCacheCoverEntry) => entryKey(entry) ?? entry.host
const preorder = (entries: readonly RawEntry[]): RawEntry[] => entries.flatMap((entry) => [entry, ...preorder(entry.children)])

export const sceneFromCache = (cache: EphemeraLudicCacheData, { roomId, actorId, exits = [], handleSeed = [] }: SceneOptions): SceneResult => {
    const nodeById = new Map(cache.nodes.map((node) => [node.universalKey as string, node]))
    const bindings = new Map(cache.nodes.flatMap((node) => node.presenceNodes.map((binding) => [bindingKey(node.universalKey, binding.universalKey), binding] as const)))
    const placedMembers = (binding: EphemeraLudicCachePresenceNode) => binding.cover.members.filter(({ host }) => isPlaced(host))
    const rootMembers = (id: string, keep: (host: string) => boolean) => dedupe(
        (nodeById.get(id)?.presenceNodes ?? []).flatMap((binding) => binding.cover.members.filter(({ host }) => keep(host))),
        coverEntryIdentity
    )
    const kindIn = (member: EphemeraLudicCacheCoverEntry, host: string): EphemeraHostingKind => (
        member.hostingKind ?? defaultHostingKind(member.host, host as EphemeraMembershipHostId)
    )

    // The bindings the scene gives a line: every physical binding a walk down the covers reaches from the room and the actor.
    const reach = (seen: ReadonlySet<string>, key: string): ReadonlySet<string> => {
        const binding = bindings.get(key)
        return seen.has(key) ? seen : (binding === undefined ? [] : placedMembers(binding).flatMap((member) => entryKey(member) ?? []))
            .reduce(reach, new Set([...seen, key]))
    }
    const roomMembers = rootMembers(roomId, isPlaced)
    const heldMembers = rootMembers(actorId, isPlaced)
    const rendered = [...roomMembers, ...heldMembers].flatMap((member) => entryKey(member) ?? []).reduce(reach, new Set<string>())
    const renderedParents = (key: string): EphemeraPresenceParentPointer[] => (bindings.get(key)?.fromHostPresences ?? [])
        .filter(({ host, presence }) => rendered.has(bindingKey(host, presence)))
    const isJoin = (key: string | undefined): key is string => key !== undefined && renderedParents(key).length >= 2

    // The tree. A join is skipped where its parents list it and emitted after the last of them (SP-9).
    const entriesOf = (members: readonly EphemeraLudicCacheCoverEntry[], owner: string, path: ReadonlySet<string>, state: WalkState): [RawEntry[], WalkState] => members.reduce<[RawEntry[], WalkState]>(
        ([entries, before], member) => {
            const key = entryKey(member)
            if (isJoin(key) || (key !== undefined && path.has(key))) {
                return [entries, before]
            }
            const [line, afterLine] = lineOf(member, owner, path, before)
            const [completed, afterJoins] = line.joins.reduce<[RawEntry[], WalkState]>(([joins, counted], join) => {
                const joinKey = entryKey(join) as string
                const seen = (counted.get(joinKey) ?? 0) + 1
                const next = new Map(counted).set(joinKey, seen)
                if (seen < renderedParents(joinKey).length) {
                    return [joins, next]
                }
                const [entry, afterJoin] = joinOf(join, line.id, path, next)
                return [[...joins, entry], afterJoin]
            }, [[], afterLine])
            return [[...entries, line, ...completed], afterJoins]
        },
        [[], state]
    )
    const childrenOf = (key: string | undefined, id: string, path: ReadonlySet<string>, state: WalkState): [RawEntry[], WalkState] => {
        const binding = key === undefined ? undefined : bindings.get(key)
        return binding === undefined ? [[], state] : entriesOf(placedMembers(binding), id, new Set([...path, key as string]), state)
    }
    const lineOf = (member: EphemeraLudicCacheCoverEntry, owner: string, path: ReadonlySet<string>, state: WalkState): [RawLine, WalkState] => {
        const key = entryKey(member)
        const binding = key === undefined ? undefined : bindings.get(key)
        const joins = binding === undefined ? [] : placedMembers(binding).filter((child) => isJoin(entryKey(child)))
        const [children, after] = childrenOf(key, member.host, path, state)
        return [{ kind: 'line', id: member.host, ...(key !== undefined ? { key } : {}), hostingKind: kindIn(member, owner), joins, children }, after]
    }
    const joinOf = (member: EphemeraLudicCacheCoverEntry, host: string, path: ReadonlySet<string>, state: WalkState): [RawJoin, WalkState] => {
        const key = entryKey(member) as string
        const [children, after] = childrenOf(key, member.host, path, state)
        return [{ kind: 'join', id: member.host, key, hostingKind: kindIn(member, host), host, children }, after]
    }

    const [contents, afterContents] = entriesOf(roomMembers, roomId, new Set(), new Map())
    const [held] = entriesOf(heldMembers, actorId, new Set(), afterContents)
    const concepts = dedupe(rootMembers(roomId, isEphemeraConceptId).map(({ host }) => host as string), (id) => id)

    // Handles, numbered in pre-order: contents, then Concepts, then held (SP-1).
    const walked = [...preorder(contents), ...preorder(held)]
    const order = dedupe([...preorder(contents).map(({ id }) => id), ...concepts, ...preorder(held).map(({ id }) => id)], (id) => id)
    const seeded = new Map(handleSeed.map(({ handle, id }) => [id, handle]))
    const seededHandles = new Set(handleSeed.map(({ handle }) => handle))
    const freeCounter = (slug: string, counter: number): number => seededHandles.has(sceneHandle(slug, counter)) ? freeCounter(slug, counter + 1) : counter
    const handleById = order.reduce(({ handles, counters }, id) => {
        const seed = seeded.get(id)
        if (seed !== undefined) {
            return { handles: new Map(handles).set(id, seed), counters }
        }
        const slug = sceneSlug(nodeById.get(id)?.shortName, thingKindOf(id))
        const counter = freeCounter(slug, (counters.get(slug) ?? 0) + 1)
        return { handles: new Map(handles).set(id, sceneHandle(slug, counter)), counters: new Map(counters).set(slug, counter) }
    }, { handles: new Map<string, SceneHandle>(), counters: new Map<string, number>() }).handles
    const handleOf = (id: string): SceneHandle => handleById.get(id) as SceneHandle
    const firsts = new Set(dedupe(walked, ({ id }) => id))

    // Where a binding's parent puts it, as the reader is told it.
    const locationUnder = (parent: EphemeraPresenceParentPointer, memberId: string, memberPresence: string): SceneLocation => {
        if (parent.host === actorId) {
            return { kind: 'held' }
        }
        if (parent.host === roomId) {
            return { kind: 'room' }
        }
        if (isPlaced(parent.host) && rendered.has(bindingKey(parent.host, parent.presence)) && handleById.has(parent.host)) {
            const entry = bindings.get(bindingKey(parent.host, parent.presence))?.cover.members.find(({ host, presence }) => host === memberId && presence === memberPresence)
            return { kind: 'thing', handle: handleOf(parent.host), hostingKind: entry?.hostingKind ?? defaultHostingKind(memberId as EphemeraMembershipHostId, parent.host) }
        }
        return isEphemeraCharacterId(parent.host) ? { kind: 'someoneElse' } : { kind: 'otherRoom' }
    }
    const locationsOf = (memberId: string, binding: EphemeraLudicCachePresenceNode): SceneLocation[] => binding.fromHostPresences
        .filter(({ host }) => !isEphemeraConceptId(host))
        .map((parent) => locationUnder(parent, memberId, binding.universalKey))
    // A line whose cover entry names no binding cannot tell its own binding from the others, so it claims none elsewhere.
    const elsewhereOf = ({ id, key }: RawEntry): SceneLocation[] => key === undefined ? [] : dedupe(
        (nodeById.get(id)?.presenceNodes ?? [])
            .filter((binding) => bindingKey(id, binding.universalKey) !== key)
            .flatMap((binding) => locationsOf(id, binding)),
        (location) => JSON.stringify(location)
    )
    const acrossOf = ({ key }: RawJoin): SceneLocation[] => renderedParents(key).flatMap((parent) => {
        const binding = bindings.get(bindingKey(parent.host, parent.presence))
        return binding === undefined ? [] : locationsOf(parent.host, binding)
    })
    const toEntry = (raw: RawEntry): SceneEntry => {
        const parts = {
            handle: handleOf(raw.id),
            hostingKind: raw.hostingKind,
            first: firsts.has(raw),
            elsewhere: elsewhereOf(raw),
            children: raw.children.map(toEntry),
        }
        return raw.kind === 'line'
            ? { kind: 'line', ...parts, joins: raw.joins.map(({ host }) => handleOf(host)) }
            : { kind: 'join', ...parts, host: handleOf(raw.host), across: acrossOf(raw) }
    }

    // Relations, on their subjects: edges in cache order, then associations.
    const terminalHandle = (terminal: EphemeraLudicCacheEdge['from']): SceneHandle | undefined => {
        if (isEphemeraLudicNodeTerminal(terminal)) {
            return handleById.get(terminal)
        }
        return isEphemeraLudicBindingAddress(terminal) ? handleById.get(terminal.owner) : undefined
    }
    const targetOf = (terminal: EphemeraLudicCacheEdge['to']): SceneRelationTarget => {
        const handle = terminalHandle(terminal)
        if (handle !== undefined) {
            return { kind: 'thing', handle }
        }
        if (!isEphemeraLudicCrossingPortAddress(terminal)) {
            return { kind: 'notShown' }
        }
        const { owner } = terminal
        if (handleById.has(owner)) {
            return { kind: 'inside', handle: handleOf(owner) }
        }
        if (isEphemeraCharacterId(owner) && owner !== actorId) {
            return { kind: 'someoneElse' }
        }
        return isEphemeraRoomId(owner) && owner !== roomId ? { kind: 'otherRoom' } : { kind: 'notShown' }
    }
    const pairs = securedToSupportPairsOfEdges(cache.edges)
    const supports = new Set(pairs.map(({ support }) => support))
    const supported = new Set(pairs.map(({ secured }) => secured))
    const edgeRelations = cache.edges.flatMap((edge): [SceneHandle, SceneRelation][] => {
        const subject = terminalHandle(edge.from)
        if (subject === undefined) {
            return []
        }
        if (edge.kind === 'Custom') {
            return [[subject, { kind: 'Custom', label: edge.relationLabel, target: targetOf(edge.to), secured: edge.edgeId !== undefined && supports.has(edge.edgeId) }]]
        }
        if (edge.kind === 'SecuredTo' && !(edge.edgeId !== undefined && supported.has(edge.edgeId))) {
            return [[subject, { kind: 'SecuredTo', target: targetOf(edge.to) }]]
        }
        return []
    })
    const associations = concepts.flatMap((conceptId) => dedupe(
        (nodeById.get(conceptId)?.presenceNodes ?? []).flatMap((binding) => binding.cover.members.map(({ host }) => host as string)),
        (id) => id
    ).flatMap((memberId): [SceneHandle, SceneRelation][] => (
        handleById.has(memberId) ? [[handleOf(memberId), { kind: 'Associated', target: { kind: 'thing', handle: handleOf(conceptId) } }]] : []
    )))
    const relationsOf = (handle: SceneHandle): SceneRelation[] => [...edgeRelations, ...associations]
        .filter(([subject]) => subject === handle)
        .map(([, relation]) => relation)

    const things = Object.fromEntries(order.map((id): [SceneHandle, SceneThing] => {
        const node = nodeById.get(id)
        return [handleOf(id), {
            kind: thingKindOf(id),
            ...(node?.shortName !== undefined ? { name: node.shortName } : {}),
            ...(node?.gloss !== undefined ? { gloss: node.gloss } : {}),
            relations: relationsOf(handleOf(id)),
        }]
    }))
    const room = nodeById.get(roomId)

    return {
        scene: {
            room: {
                ...(room?.shortName !== undefined ? { name: room.shortName } : {}),
                ...(room?.gloss !== undefined ? { gloss: room.gloss } : {}),
            },
            contents: contents.map(toEntry),
            concepts: concepts.map(handleOf),
            held: held.map(toEntry),
            exits,
            things,
        },
        handles: order.map((id) => ({ handle: handleOf(id), id })),
    }
}
