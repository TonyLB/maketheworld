/**
 * The wording every candidate scene format shares (sceneProjection Slice 2): headings, glosses, relation phrases, spread
 * notes and the hosting-kind words. The formats differ only in how they show nesting (A and D: indentation; Blocks: a block
 * per branching host), so the probe compares that alone (SP-7). Reasoning names only: a scene never prints a display
 * label or an id.
 */
import type { EphemeraHostingKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type {
    SceneEntry,
    SceneHandle,
    SceneJoin,
    SceneLine,
    SceneLocation,
    SceneModel,
    SceneRelation,
    SceneRelationTarget,
} from '../../positions/ludicCache/sceneModel'

export const bracket = (handle: SceneHandle): string => `[${handle}]`

/** "the Tavern", or "the room" when the room has no reasoning name. */
export const roomRef = (scene: SceneModel): string => `the ${scene.room.name ?? 'room'}`

const capitalise = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`

/** "The Tavern", or "The Tavern: <gloss>" when the room has a gloss. */
export const heading = (scene: SceneModel): string => (
    [capitalise(roomRef(scene)), ...(scene.room.gloss !== undefined ? [scene.room.gloss] : [])].join(': ')
)

export const exitsLine = (scene: SceneModel): string | undefined => (
    scene.exits.length === 0 ? undefined : `Exits: ${scene.exits.map(({ name, to }) => `${name} to the ${to}`).join(', ')}.`
)

/** A hosting kind as a clause about the member: "on [x]", "part of the Tavern". `target` is already bracketed or a room ref. */
export const hostingClause = (hostingKind: EphemeraHostingKind, target: string): string => {
    switch (hostingKind) {
        case 'On': return `on ${target}`
        case 'Held': return `held by ${target}`
        case 'PartOf': return `part of ${target}`
        case 'SectionOf': return `a section of ${target}`
        case 'Associated': return `associated with ${target}`
        default: return `in ${target}`
    }
}

/** Where a binding sits, as a clause about the thing. */
export const locationClause = (scene: SceneModel, location: SceneLocation): string => {
    switch (location.kind) {
        case 'thing': return hostingClause(location.hostingKind, bracket(location.handle))
        case 'room': return `in ${roomRef(scene)}`
        case 'held': return 'held by you'
        case 'someoneElse': return 'held by someone else'
        case 'otherRoom': return 'in another room'
    }
}

/** Blocks' "which X goes with": the host's side of a chain link, "X on it". */
export const chainTail = (hostingKind: EphemeraHostingKind): string => {
    switch (hostingKind) {
        case 'On': return 'on it'
        case 'PartOf': return 'as a part'
        case 'SectionOf': return 'as a section'
        default: return 'in it'
    }
}

/** A block's header: what the listed members are to `target` (a handle or a room ref); held items need none. */
export const blockHeader = (hostingKind: EphemeraHostingKind, target: string): string => {
    switch (hostingKind) {
        case 'On': return `On ${target}:`
        case 'Held': return 'You are holding:'
        case 'PartOf': return `Parts of ${target}:`
        case 'SectionOf': return `Sections of ${target}:`
        case 'Associated': return `Associated with ${target}:`
        default: return `In ${target}:`
    }
}

const nameOf = (scene: SceneModel, handle: SceneHandle): string => {
    const thing = scene.things[handle]
    return thing?.name ?? `(unnamed ${(thing?.kind ?? 'Object').toLowerCase()})`
}

/** "[cup1] Cup (a red tin cup)": the gloss on the thing's first line only; no gloss, no parentheses. */
export const headText = (scene: SceneModel, { handle, first }: Pick<SceneEntry, 'handle' | 'first'>): string => {
    const gloss = first ? scene.things[handle]?.gloss : undefined
    return `${bracket(handle)} ${nameOf(scene, handle)}${gloss !== undefined ? ` (${gloss})` : ''}`
}

export const conceptText = (scene: SceneModel, handle: SceneHandle): string => headText(scene, { handle, first: true })

/** "(also held by you)": where this thing's other bindings are, on every one of its lines. */
export const spreadNotes = (scene: SceneModel, { elsewhere }: SceneEntry): string[] => (
    elsewhere.map((location) => `(also ${locationClause(scene, location)})`)
)

const acrossWords = (scene: SceneModel, location: SceneLocation): string => {
    switch (location.kind) {
        case 'thing': return bracket(location.handle)
        case 'room': return roomRef(scene)
        case 'held': return 'you'
        case 'someoneElse': return 'someone else'
        case 'otherRoom': return 'another room'
    }
}

const listWords = (words: readonly string[]): string => words.join(' and ')

/** A join's own note (SP-9): "(across [table-a1] and [table-b1])". */
export const acrossNote = (scene: SceneModel, { across }: SceneJoin): string => `(across ${listWords(across.map((location) => acrossWords(scene, location)))})`

/** A parent line's forward reference to a join it is one parent of (SP-9). */
export const joinReferences = ({ joins }: SceneLine): string[] => joins.map((handle) => `(see ${bracket(handle)} below)`)

/** The notes after a line's head, in order: spread notes, a join's `across`, a parent line's join references. */
export const lineNotes = (scene: SceneModel, entry: SceneEntry): string[] => [
    ...spreadNotes(scene, entry),
    ...(entry.kind === 'join' ? [acrossNote(scene, entry)] : joinReferences(entry)),
]

const targetWords = (target: SceneRelationTarget): string => {
    switch (target.kind) {
        case 'thing': return bracket(target.handle)
        case 'inside': return `something inside ${bracket(target.handle)}`
        case 'someoneElse': return 'something someone else is holding'
        case 'otherRoom': return 'something in another room'
        case 'notShown': return 'something not shown here'
    }
}

/** The part of a phrase that makes relations groupable: the same wording to different targets reads as one phrase. */
const relationLead = (relation: SceneRelation): { lead: string; tail: string } => {
    switch (relation.kind) {
        case 'Custom': return { lead: relation.label, tail: relation.secured ? ', secured' : '' }
        case 'SecuredTo': return { lead: 'secured to', tail: '' }
        case 'Associated': return { lead: 'associated with', tail: '' }
    }
}

/**
 * A thing's relations as phrases (SP-3), read as English about it: "tied to [post1], secured", "secured to [post1]",
 * "associated with [x]". Relations with identical wording join their targets with "and".
 */
export const relationPhrases = (scene: SceneModel, handle: SceneHandle): string[] => {
    const groups: { lead: string; tail: string; targets: string[] }[] = []
    for (const relation of scene.things[handle]?.relations ?? []) {
        const { lead, tail } = relationLead(relation)
        const targets = targetWords(relation.target)
        const group = groups.find((candidate) => candidate.lead === lead && candidate.tail === tail)
        if (group) {
            group.targets.push(targets)
        }
        else {
            groups.push({ lead, tail, targets: [targets] })
        }
    }
    return groups.map(({ lead, tail, targets }) => `${lead} ${listWords(targets)}${tail}`)
}

/** The relations a line shows: a thing's relations go on its first line only, as its gloss does. */
export const lineRelations = (scene: SceneModel, { handle, first }: SceneEntry): string[] => first ? relationPhrases(scene, handle) : []
