/**
 * A sub-scene (user, 2026-11-10): a scene model limited to the things a reader is asked about. It keeps the named
 * things; their physical containers up to the room or `held`, for every binding (user: the ancestor chain, since a container
 * at the top level would read as in the room); the Concepts each named thing is `Associated` with; and the relations with both ends
 * in that set. Every other thing and relation is dropped, and so are the exits, which are not things.
 *
 * The kept set is closed under "parent of any binding", so every line of a kept thing survives, and its `first`, `elsewhere`,
 * `joins` and a join's `host` and `across` name only lines that are still there. So the output is a scene model any renderer reads
 * unchanged. A handle not in the scene throws.
 */
import type { SceneEntry, SceneHandle, SceneModel, SceneThing } from '../../positions/ludicCache/sceneModel'

/** Each entry with its tree parent's handle (absent for the room's and the held roots). */
const walkWithParents = (entries: readonly SceneEntry[], parent?: SceneHandle): { entry: SceneEntry; parent?: SceneHandle }[] => (
    entries.flatMap((entry) => [{ entry, parent }, ...walkWithParents(entry.children, entry.handle)])
)

/** What each thing's bindings sit in: the tree parent of each line, and a join's host. */
const parentsOf = (scene: SceneModel): Map<SceneHandle, SceneHandle[]> => (
    [...walkWithParents(scene.contents), ...walkWithParents(scene.held)].reduce((parents, { entry, parent }) => parents.set(entry.handle, [
        ...(parents.get(entry.handle) ?? []),
        ...(parent === undefined ? [] : [parent]),
        ...(entry.kind === 'join' ? [entry.host] : []),
    ]), new Map<SceneHandle, SceneHandle[]>())
)

const withAncestors = (parents: Map<SceneHandle, SceneHandle[]>, kept: ReadonlySet<SceneHandle>, handle: SceneHandle): Set<SceneHandle> => (
    kept.has(handle)
        ? new Set(kept)
        : (parents.get(handle) ?? []).reduce((acc, parent) => withAncestors(parents, acc, parent), new Set([...kept, handle]))
)

const associatedWith = ({ relations }: SceneThing): SceneHandle[] => relations.flatMap((relation) => (relation.kind === 'Associated' ? [relation.target.handle] : []))

const pruned = (entries: readonly SceneEntry[], kept: ReadonlySet<SceneHandle>): SceneEntry[] => entries
    .filter(({ handle }) => kept.has(handle))
    .map((entry) => (entry.kind === 'line'
        ? { ...entry, joins: entry.joins.filter((handle) => kept.has(handle)), children: pruned(entry.children, kept) }
        : { ...entry, children: pruned(entry.children, kept) }))

export const subScene = (scene: SceneModel, handles: readonly SceneHandle[]): SceneModel => {
    const unknown = handles.filter((handle) => scene.things[handle] === undefined)
    if (unknown.length > 0) {
        throw new Error(`Unknown scene handle(s) ${unknown.join(', ')}; expected one of: ${Object.keys(scene.things).join(', ')}`)
    }
    const parents = parentsOf(scene)
    const placed = handles.reduce((acc, handle) => withAncestors(parents, acc, handle), new Set<SceneHandle>())
    const kept = new Set([...placed, ...handles.flatMap((handle) => associatedWith(scene.things[handle]))])
    return {
        room: scene.room,
        contents: pruned(scene.contents, kept),
        concepts: scene.concepts.filter((handle) => kept.has(handle)),
        held: pruned(scene.held, kept),
        exits: [],
        things: Object.fromEntries(Object.entries(scene.things)
            .filter(([handle]) => kept.has(handle))
            .map(([handle, thing]) => [handle, {
                ...thing,
                relations: thing.relations.filter(({ target }) => target.kind === 'thing' && kept.has(target.handle)),
            }])),
    }
}
