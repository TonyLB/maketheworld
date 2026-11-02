/**
 * Candidate Blocks (sceneProjection Slice 2): shape-aware, with no indentation. A host with children is a block
 * ("On [table1]: ..."). A member whose contents form a chain (one thing per level) stays inline, read downward ("Table,
 * with Box on it, which has Bag in it"); a member that branches, or whose chain carries a relation, is promoted to its own
 * block and marked "(see below)". Blocks follow their reference in pre-order, the order handles are numbered in. Members of
 * more than one hosting kind under one host get a block per kind, in first-appearance order.
 */
import type { EphemeraHostingKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { SceneEntry, SceneModel } from '../../positions/ludicCache/sceneModel'
import { bracket, blockHeader, chainTail, conceptText, exitsLine, headText, heading, lineNotes, lineRelations, roomRef } from './sceneWording'

/** The entries grouped by hosting kind, in the order each kind first appears. */
export const byHostingKind = (entries: readonly SceneEntry[]): { hostingKind: EphemeraHostingKind; entries: SceneEntry[] }[] => {
    const groups: { hostingKind: EphemeraHostingKind; entries: SceneEntry[] }[] = []
    for (const entry of entries) {
        const group = groups.find(({ hostingKind }) => hostingKind === entry.hostingKind)
        if (group) {
            group.entries.push(entry)
        }
        else {
            groups.push({ hostingKind: entry.hostingKind, entries: [entry] })
        }
    }
    return groups
}

/** The single path below an entry, or undefined when it branches or a member of it carries a relation (so it is promoted). */
const chainBelow = (scene: SceneModel, entry: SceneEntry): SceneEntry[] | undefined => {
    const chain: SceneEntry[] = []
    let current = entry
    while (current.children.length > 0) {
        if (current.children.length > 1) {
            return undefined
        }
        current = current.children[0]
        if (lineRelations(scene, current).length > 0) {
            return undefined
        }
        chain.push(current)
    }
    return chain
}

/** A line's head and its notes: what is shown for a thing wherever it is inline. */
const lineHead = (scene: SceneModel, entry: SceneEntry): string => [headText(scene, entry), ...lineNotes(scene, entry)].join(' ')

/** One item in a block's list, and whether its children need a block of their own. */
const renderItem = (scene: SceneModel, entry: SceneEntry): { text: string; promoted: boolean } => {
    const chain = chainBelow(scene, entry)
    const promoted = chain === undefined
    return {
        promoted,
        text: [
            lineHead(scene, entry),
            ...(promoted && entry.children.length > 0 ? [' (see below)'] : []),
            ...lineRelations(scene, entry).map((phrase) => `, ${phrase}`),
            ...(chain ?? []).map((link, index) => `, ${index === 0 ? 'with' : 'which has'} ${lineHead(scene, link)} ${chainTail(link.hostingKind)}`),
        ].join(''),
    }
}

/** A block for each hosting kind among `entries`, then (pre-order) the blocks of the items that were promoted. */
const renderBlocks = (scene: SceneModel, entries: readonly SceneEntry[], target: string, empty?: string): string[] => {
    if (entries.length === 0) {
        return empty === undefined ? [] : [empty]
    }
    return byHostingKind(entries).flatMap(({ hostingKind, entries: group }) => {
        const items = group.map((entry) => ({ entry, ...renderItem(scene, entry) }))
        return [
            `${blockHeader(hostingKind, target)} ${items.map(({ text }) => text).join('; ')}.`,
            ...items.flatMap(({ entry, promoted }) => promoted ? renderBlocks(scene, entry.children, bracket(entry.handle)) : []),
        ]
    })
}

export const renderSceneBlocks = (scene: SceneModel): string => {
    const room = roomRef(scene)
    return [
        heading(scene),
        ...renderBlocks(scene, scene.contents, room, `In ${room}: nothing.`),
        ...(scene.concepts.length === 0 ? [] : [`Concepts here: ${scene.concepts.map((handle) => conceptText(scene, handle)).join('; ')}.`]),
        ...renderBlocks(scene, scene.held, 'you', 'You are holding: nothing.'),
        ...(exitsLine(scene) !== undefined ? [exitsLine(scene) as string] : []),
    ].join('\n')
}
