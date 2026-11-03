/**
 * Format `fans` (SP-7 reopened, user, 2026-11-03): blocksDLabelled without its layers block. Every host with members gets
 * one block per hosting kind, headed by what every row under it is to that host ("Directly on [x]:"), and every row names
 * its parent as in D. A member with anything below it is marked "(see below)" and its own block follows, in pre-order. No
 * indentation and no shape analysis: a chain is a block per link, so depth is explicit and every header is true of every
 * row under it.
 */
import type { EphemeraHostingKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { SceneEntry, SceneModel } from '../../positions/ludicCache/sceneModel'
import { parentClause, type Parent } from './renderSceneTree'
import { bracket, conceptText, exitsLine, heading, headText, lineNotes, lineRelations, roomRef } from './sceneWording'

/** A block's header: what every listed member is to `target` (a handle or a room ref). */
const fanHeader = (hostingKind: EphemeraHostingKind, target: string): string => {
    switch (hostingKind) {
        case 'On': return `Directly on ${target}:`
        case 'Held': return 'You are holding:'
        case 'PartOf': return `Parts of ${target}:`
        case 'SectionOf': return `Sections of ${target}:`
        case 'Associated': return `Associated with ${target}:`
        default: return `Directly in ${target}:`
    }
}

/** Entries grouped by hosting kind, in first-appearance order. */
const byHostingKind = (entries: readonly SceneEntry[]): { hostingKind: EphemeraHostingKind; entries: SceneEntry[] }[] => (
    entries.reduce<{ hostingKind: EphemeraHostingKind; entries: SceneEntry[] }[]>((groups, entry) => (
        groups.some(({ hostingKind }) => hostingKind === entry.hostingKind)
            ? groups.map((group) => group.hostingKind === entry.hostingKind ? { ...group, entries: [...group.entries, entry] } : group)
            : [...groups, { hostingKind: entry.hostingKind, entries: [entry] }]
    ), [])
)

const row = (scene: SceneModel, entry: SceneEntry, parent: Parent): string => `- ${[
    headText(scene, entry),
    `, ${parentClause(scene, entry, parent)}`,
    ...lineNotes(scene, entry).map((note) => ` ${note}`),
    ...(entry.children.length > 0 ? [' (see below)'] : []),
    ...lineRelations(scene, entry).map((phrase) => `, ${phrase}`),
].join('')}`

/** A block for each hosting kind among `entries`, then (pre-order) the blocks of the members marked "(see below)". */
const renderFans = (scene: SceneModel, entries: readonly SceneEntry[], parent: Parent, target: string, empty?: string): string[] => {
    if (entries.length === 0) {
        return empty === undefined ? [] : [empty]
    }
    return byHostingKind(entries).flatMap(({ hostingKind, entries: group }) => [
        fanHeader(hostingKind, target),
        ...group.map((entry) => row(scene, entry, parent)),
        ...group.flatMap((entry) => renderFans(scene, entry.children, { kind: 'thing', handle: entry.handle }, bracket(entry.handle))),
    ])
}

export const renderSceneFans = (scene: SceneModel): string => {
    const room = roomRef(scene)
    return [
        heading(scene),
        ...renderFans(scene, scene.contents, { kind: 'room' }, room, `In ${room}: nothing.`),
        ...(scene.concepts.length === 0 ? [] : ['Concepts here:', ...scene.concepts.map((handle) => `- ${conceptText(scene, handle)}`)]),
        ...renderFans(scene, scene.held, { kind: 'held' }, 'you', 'You are holding: nothing.'),
        ...(exitsLine(scene) !== undefined ? [exitsLine(scene) as string] : []),
    ].join('\n')
}
