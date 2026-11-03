/**
 * The scene model (sceneProjection Slice 1): the actor's cache as a reader reasons over it, before any text format is
 * chosen. It is **format-neutral** (SP-5): it carries the physical forest, hosting kinds, handles and relations, and no
 * rendering decision; the renderer (format D, SP-7) makes those.
 *
 * Nothing here is cache-shaped. A thing is named by its **handle** (SP-1: a name-derived slug with a counter, `cup1`),
 * never by its id; the ids sit in the **handle table** returned beside the scene (`SceneHandleTable`), which is never shown
 * to a reader. Built by `sceneFromCache` (`sceneFromCache.ts`), read through `ActorLudicCache.scene`.
 */
import type { EphemeraHostingKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/** A thing's name in the scene, without brackets (`cup1`, `room-101-1`). Unique within one scene. */
export type SceneHandle = string

/** The kinds of thing a scene names: placed things (Objects, Features) and Concepts, which are never placed. */
export type SceneThingKind = 'Object' | 'Feature' | 'Concept'

/**
 * Where one binding of a thing sits, as a reader is told it: in this room, under a thing in the scene (with the kind of
 * that membership), held by the actor, held by someone else (a character the scene does not show), or in another room.
 */
export type SceneLocation =
    | { kind: 'room' }
    | { kind: 'thing'; handle: SceneHandle; hostingKind: EphemeraHostingKind }
    | { kind: 'held' }
    | { kind: 'someoneElse' }
    | { kind: 'otherRoom' }

/**
 * The other end of a relation. A thing in the scene is named; the far end of an **open leg** (a crossing whose other
 * half the cache does not hold) is named by its owner: inside a thing in the scene, held by someone else, or in another
 * room. `notShown` is a far end the cache holds that has no line in the scene.
 */
export type SceneRelationTarget =
    | { kind: 'thing'; handle: SceneHandle }
    | { kind: 'inside'; handle: SceneHandle }
    | { kind: 'someoneElse' }
    | { kind: 'otherRoom' }
    | { kind: 'notShown' }

/**
 * A relation, read as English about its subject (SP-3), held on the subject only. A `Custom` edge that justifies a
 * `SecuredTo` is one relation with `secured` set (a tie); a `SecuredTo` with no `Custom` support is bare. `ConnectedTo`
 * has no relation of its own (a spread thing's `elsewhere` carries it), and `Justifies` is consumed into `secured`.
 */
export type SceneRelation =
    | { kind: 'Custom'; label: string; target: SceneRelationTarget; secured: boolean }
    | { kind: 'SecuredTo'; target: SceneRelationTarget }
    | { kind: 'Associated'; target: { kind: 'thing'; handle: SceneHandle } }

/** A named thing: its reasoning name (absent when the node has none), its gloss, and its relations. */
export type SceneThing = {
    kind: SceneThingKind
    name?: string
    gloss?: string
    relations: SceneRelation[]
}

/** The parts every entry has: which thing, its first appearance, its other bindings, and what sits under it. */
type SceneEntryParts = {
    handle: SceneHandle
    /** The thing's kind in the host this entry sits under. */
    hostingKind: EphemeraHostingKind
    /** The thing's first entry in walk order: the one a renderer gives its gloss and relations (one per thing). */
    first: boolean
    /** Where the thing's other physical bindings are (a spread thing, SP-2). Empty for a thing with one binding. */
    elsewhere: SceneLocation[]
    children: SceneEntry[]
}

/**
 * One binding of a thing, under its one parent. A spread thing (several bindings) has one line per binding. `joins` lists
 * the joins this line is one parent of: each is described once, elsewhere (SP-9), and this line refers to it.
 */
export type SceneLine = SceneEntryParts & {
    kind: 'line'
    joins: SceneHandle[]
}

/**
 * One binding with several parents, all bindings of one `host` (the physical-forest invariant): the bowl on the seam of a
 * cloth spread over two tables. Described once, as the next sibling of the last of its parent lines in walk order (SP-9);
 * `across` locates each parent line.
 */
export type SceneJoin = SceneEntryParts & {
    kind: 'join'
    host: SceneHandle
    across: SceneLocation[]
}

export type SceneEntry = SceneLine | SceneJoin

/** An exit from the room. Not read from the cache: the caller supplies exits (SP-4). */
export type SceneExit = { name: string; to: string }

export type SceneModel = {
    room: { name?: string; gloss?: string }
    /** The room's physical forest. */
    contents: SceneEntry[]
    /** The Concepts associated with the room, never placed; their members point to them. */
    concepts: SceneHandle[]
    /** What the actor holds. */
    held: SceneEntry[]
    exits: SceneExit[]
    things: Record<SceneHandle, SceneThing>
}

/** Each handle's id, in numbering order. Never shown to a reader: it is how a reader's output names a thing again. */
export type SceneHandleTable = { handle: SceneHandle; id: string }[]

export type SceneResult = { scene: SceneModel; handles: SceneHandleTable }

/**
 * A handle's stem (SP-1): the reasoning name lowercased, apostrophes dropped, each other run of non-alphanumerics one
 * hyphen, trimmed. A thing with no name (or none that leaves a letter or digit) takes its kind (`object`).
 */
export const sceneSlug = (name: string | undefined, kind: SceneThingKind): string => {
    const slug = (name ?? '')
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
    return slug.length > 0 ? slug : kind.toLowerCase()
}

/** A stem and its counter: always appended, after a hyphen when the stem ends in a digit (`room-101-1`). */
export const sceneHandle = (slug: string, counter: number): SceneHandle => (
    /\p{N}$/u.test(slug) ? `${slug}-${counter}` : `${slug}${counter}`
)
