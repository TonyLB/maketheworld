/**
 * The scene fixtures' question sets (SP-8): a closed set of typed questions about one scene, each answered from the scene
 * model, so an expected answer is computed, never hand-kept. The format probe asks a reader the question in words and
 * shows the expected answer beside the reader's; the match is a reading aid, and the user judges.
 *
 * `asked` words a question about a known thing by description ("Where is the china teacup?"); the answer is still
 * computed for its `subject`.
 */
import type { SceneEntry, SceneHandle, SceneLocation, SceneModel, SceneRelationTarget } from '../sceneModel'

type Asked = { asked?: string }

export type SceneQuestion = Asked & (
    /** What is directly on or in X (no subject: in the room). */
    | { type: 'directContents'; subject?: SceneHandle }
    /** What is X on or in: where each of its lines sits. */
    | { type: 'placedOn'; subject: SceneHandle }
    /** Where X is, all the way out to the room. */
    | { type: 'chainOut'; subject: SceneHandle }
    /** Where every part of X is, its lines and its other bindings. */
    | { type: 'whereIs'; subject: SceneHandle }
    /** If X is taken, what moves with it. */
    | { type: 'movesWith'; subject: SceneHandle }
    /** What the actor holds. */
    | { type: 'held' }
    /** What X is `label` (what is X tied to). */
    | { type: 'relatedTo'; subject: SceneHandle; label: string }
    /** What is `label` X (what is tied to X). */
    | { type: 'relatedFrom'; target: SceneHandle; label: string }
    /** What is secured to X, by a tie or bare. */
    | { type: 'securedTo'; target: SceneHandle }
    /** A Concept's members, or the Concepts a thing is associated with. */
    | { type: 'associatedWith'; subject: SceneHandle }
    /** How many things have this name. */
    | { type: 'howMany'; name: string }
)

export type SceneAnswer =
    | { handles: SceneHandle[] }
    | { locations: SceneLocation[] }
    | { targets: SceneRelationTarget[] }
    | { count: number }

/** Every entry with the location it sits at and the chain of locations above it, in walk order. */
type PlacedEntry = { entry: SceneEntry; location: SceneLocation; chain: SceneLocation[] }

const placedEntries = (scene: SceneModel): PlacedEntry[] => {
    const walk = (entries: readonly SceneEntry[], location: SceneLocation, chain: SceneLocation[]): PlacedEntry[] => entries.flatMap((entry) => {
        const here: SceneLocation = entry.kind === 'join' ? { kind: 'thing', handle: entry.host, hostingKind: entry.hostingKind } : location
        const below = (child: SceneEntry): SceneLocation => ({ kind: 'thing', handle: entry.handle, hostingKind: child.hostingKind })
        return [
            { entry, location: here, chain: [here, ...chain] },
            ...entry.children.flatMap((child) => walk([child], below(child), [here, ...chain])),
        ]
    })
    return [...walk(scene.contents, { kind: 'room' }, []), ...walk(scene.held, { kind: 'held' }, [])]
}

const unique = <T>(values: readonly T[]): T[] => values.filter((value, index) => values.findIndex((other) => JSON.stringify(other) === JSON.stringify(value)) === index)

/** What sits directly under X's entries: its children, and the joins it hosts. */
const directlyUnder = (placed: readonly PlacedEntry[], subject: SceneHandle): SceneEntry[] => [
    ...placed.filter(({ entry }) => entry.handle === subject).flatMap(({ entry }) => entry.children),
    ...placed.filter(({ entry }) => entry.kind === 'join' && entry.host === subject).map(({ entry }) => entry),
]

const descendants = (placed: readonly PlacedEntry[], subject: SceneHandle, seen: ReadonlySet<SceneHandle> = new Set([subject])): SceneHandle[] => (
    unique(directlyUnder(placed, subject).map(({ handle }) => handle)).filter((handle) => !seen.has(handle)).flatMap((handle) => (
        [handle, ...descendants(placed, handle, new Set([...seen, handle]))]
    ))
)

export const expectedAnswer = (scene: SceneModel, question: SceneQuestion): SceneAnswer => {
    const placed = placedEntries(scene)
    const relations = Object.entries(scene.things).flatMap(([subject, { relations }]) => relations.map((relation) => ({ subject, relation })))
    switch (question.type) {
        case 'directContents':
            return {
                handles: unique(question.subject === undefined
                    ? scene.contents.map(({ handle }) => handle)
                    : directlyUnder(placed, question.subject).map(({ handle }) => handle)),
            }
        case 'placedOn':
            return { locations: unique(placed.filter(({ entry }) => entry.handle === question.subject).map(({ location }) => location)) }
        case 'chainOut':
            return { locations: placed.find(({ entry }) => entry.handle === question.subject)?.chain ?? [] }
        case 'whereIs': {
            const entries = placed.filter(({ entry }) => entry.handle === question.subject)
            return { locations: unique([...entries.map(({ location }) => location), ...entries.flatMap(({ entry }) => entry.elsewhere)]) }
        }
        case 'movesWith':
            return { handles: unique(descendants(placed, question.subject)) }
        case 'held':
            return { handles: unique(scene.held.map(({ handle }) => handle)) }
        case 'relatedTo':
            return {
                targets: unique((scene.things[question.subject]?.relations ?? []).flatMap((relation) => (
                    relation.kind === 'Custom' && relation.label === question.label ? [relation.target] : []
                ))),
            }
        case 'relatedFrom':
            return {
                handles: unique(relations.flatMap(({ subject, relation }) => (
                    relation.kind === 'Custom' && relation.label === question.label && relation.target.kind === 'thing' && relation.target.handle === question.target ? [subject] : []
                ))),
            }
        case 'securedTo':
            return {
                handles: unique(relations.flatMap(({ subject, relation }) => (
                    ((relation.kind === 'Custom' && relation.secured) || relation.kind === 'SecuredTo') && relation.target.kind === 'thing' && relation.target.handle === question.target ? [subject] : []
                ))),
            }
        case 'associatedWith':
            return {
                handles: unique(scene.things[question.subject]?.kind === 'Concept'
                    ? relations.flatMap(({ subject, relation }) => relation.kind === 'Associated' && relation.target.handle === question.subject ? [subject] : [])
                    : (scene.things[question.subject]?.relations ?? []).flatMap((relation) => relation.kind === 'Associated' ? [relation.target.handle] : [])),
            }
        case 'howMany':
            return { count: Object.values(scene.things).filter(({ name }) => name?.toLowerCase() === question.name.toLowerCase()).length }
    }
}
