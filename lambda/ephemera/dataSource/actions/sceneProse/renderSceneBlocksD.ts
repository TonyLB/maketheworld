/**
 * Candidate blocksD (sceneProjection Slice 3, a hybrid proposed after the first probe batches): Blocks' grouping with D's
 * lines. A host's members are a block of D-style rows, each naming its parent by handle. A member with exactly one thing
 * below it, and nothing below that (a one-deep chain), has that thing hoisted into the same block as a row of its own, whose
 * clause names its real parent; a member with more below it (a fan, or a chain two or more deep) is marked "(see below)"
 * and gets a block of its own, in pre-order. Members of more than one hosting kind under one host get a block per kind, as
 * in Blocks. No row is inline: a relation stays on its own thing's row, so nothing is promoted for carrying one.
 */
import type { SceneEntry, SceneModel } from '../../positions/ludicCache/sceneModel'
import { byHostingKind } from './renderSceneBlocks'
import { parentClause, type Parent } from './renderSceneTree'
import { bracket, blockHeader, conceptText, exitsLine, headText, heading, lineNotes, lineRelations, roomRef } from './sceneWording'

/** The one thing below a member, when nothing is below that: it is hoisted into the member's block. */
const hoisted = ({ children }: SceneEntry): SceneEntry | undefined => (
    children.length === 1 && children[0].children.length === 0 ? children[0] : undefined
)

const promoted = (entry: SceneEntry): boolean => entry.children.length > 0 && hoisted(entry) === undefined

const row = (scene: SceneModel, entry: SceneEntry, parent: Parent): string => `- ${[
    headText(scene, entry),
    `, ${parentClause(scene, entry, parent)}`,
    ...lineNotes(scene, entry).map((note) => ` ${note}`),
    ...(promoted(entry) ? [' (see below)'] : []),
    ...lineRelations(scene, entry).map((phrase) => `, ${phrase}`),
].join('')}`

/** A block for each hosting kind among `entries`, then (pre-order) the blocks of the members that were promoted. */
const renderBlocks = (scene: SceneModel, entries: readonly SceneEntry[], parent: Parent, target: string, empty?: string): string[] => {
    if (entries.length === 0) {
        return empty === undefined ? [] : [empty]
    }
    return byHostingKind(entries).flatMap(({ hostingKind, entries: group }) => [
        blockHeader(hostingKind, target),
        ...group.flatMap((entry) => {
            const lifted = hoisted(entry)
            return [row(scene, entry, parent), ...(lifted ? [row(scene, lifted, { kind: 'thing', handle: entry.handle })] : [])]
        }),
        ...group.filter(promoted).flatMap((entry) => renderBlocks(scene, entry.children, { kind: 'thing', handle: entry.handle }, bracket(entry.handle))),
    ])
}

export const renderSceneBlocksD = (scene: SceneModel): string => {
    const room = roomRef(scene)
    return [
        heading(scene),
        ...renderBlocks(scene, scene.contents, { kind: 'room' }, room, `In ${room}: nothing.`),
        ...(scene.concepts.length === 0 ? [] : ['Concepts here:', ...scene.concepts.map((handle) => `- ${conceptText(scene, handle)}`)]),
        ...renderBlocks(scene, scene.held, { kind: 'held' }, 'you', 'You are holding: nothing.'),
        ...(exitsLine(scene) !== undefined ? [exitsLine(scene) as string] : []),
    ].join('\n')
}
