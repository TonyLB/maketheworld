/**
 * Candidate blocksDLabelled (sceneProjection Slice 3, after the `sideboard` batches): blocksD with every header true of
 * every row under it. blocksD's hoisted rows sat under a header that was not their parent, and the model read the header
 * as membership, so nothing is hoisted and each header says what kind of block it is. A fan block holds a host's direct
 * members ("Directly on [x]:"). A member with anything below it is marked "(see below)" and gets a block of its own, in
 * pre-order: a single-file run at least two deep (one thing, one thing on or in that, ...) is a layers block of D-style
 * rows ("[x] and what is on or in it, in layers:"), and where the run ends in a fan, that thing is marked "(see below)" and
 * gets a fan block; anything else is a fan block. Members of more than one hosting kind under one host get a block per
 * kind, as in Blocks.
 */
import type { EphemeraHostingKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { SceneEntry, SceneModel } from '../../positions/ludicCache/sceneModel'
import { byHostingKind } from './renderSceneBlocks'
import { parentClause, type Parent } from './renderSceneTree'
import { bracket, blockHeader, conceptText, exitsLine, headText, heading, lineNotes, lineRelations, roomRef } from './sceneWording'

const fanHeader = (hostingKind: EphemeraHostingKind, target: string): string => {
    switch (hostingKind) {
        case 'On': return `Directly on ${target}:`
        case 'In': return `Directly in ${target}:`
        default: return blockHeader(hostingKind, target)
    }
}

const layersHeader = (handle: string): string => `${bracket(handle)} and what is on or in it, in layers:`

const under = ({ handle }: SceneEntry): Parent => ({ kind: 'thing', handle })

/** The single-file run below a member: its one child, that child's one child, and so on. */
const singleFile = ({ children }: SceneEntry): SceneEntry[] => (
    children.length === 1 ? [children[0], ...singleFile(children[0])] : []
)

const row = (scene: SceneModel, entry: SceneEntry, parent: Parent, seeBelow: boolean): string => `- ${[
    headText(scene, entry),
    `, ${parentClause(scene, entry, parent)}`,
    ...lineNotes(scene, entry).map((note) => ` ${note}`),
    ...(seeBelow ? [' (see below)'] : []),
    ...lineRelations(scene, entry).map((phrase) => `, ${phrase}`),
].join('')}`

/** The block(s) for what is below a member that was marked "(see below)". */
const memberBlocks = (scene: SceneModel, entry: SceneEntry): string[] => {
    const run = singleFile(entry)
    if (run.length < 2) {
        return renderFans(scene, entry.children, under(entry), bracket(entry.handle))
    }
    const end = run[run.length - 1]
    return [
        layersHeader(entry.handle),
        ...run.map((link, index) => row(scene, link, under(index === 0 ? entry : run[index - 1]), link === end && end.children.length > 0)),
        ...renderFans(scene, end.children, under(end), bracket(end.handle)),
    ]
}

/** A fan block for each hosting kind among `entries`, then (pre-order) the blocks of the members marked "(see below)". */
const renderFans = (scene: SceneModel, entries: readonly SceneEntry[], parent: Parent, target: string, empty?: string): string[] => {
    if (entries.length === 0) {
        return empty === undefined ? [] : [empty]
    }
    return byHostingKind(entries).flatMap(({ hostingKind, entries: group }) => [
        fanHeader(hostingKind, target),
        ...group.map((entry) => row(scene, entry, parent, entry.children.length > 0)),
        ...group.filter(({ children }) => children.length > 0).flatMap((entry) => memberBlocks(scene, entry)),
    ])
}

export const renderSceneBlocksDLabelled = (scene: SceneModel): string => {
    const room = roomRef(scene)
    return [
        heading(scene),
        ...renderFans(scene, scene.contents, { kind: 'room' }, room, `In ${room}: nothing.`),
        ...(scene.concepts.length === 0 ? [] : ['Concepts here:', ...scene.concepts.map((handle) => `- ${conceptText(scene, handle)}`)]),
        ...renderFans(scene, scene.held, { kind: 'held' }, 'you', 'You are holding: nothing.'),
        ...(exitsLine(scene) !== undefined ? [exitsLine(scene) as string] : []),
    ].join('\n')
}
