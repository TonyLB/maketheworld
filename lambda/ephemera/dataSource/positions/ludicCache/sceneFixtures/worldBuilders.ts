/**
 * Builders for the scene fixtures' graphs. Production code on purpose (SP-8, "Fixture module home"): the scene-reasoning
 * probe folds these worlds in the deployed bundle, so nothing here imports the test-only `ludicGraph/testFixtures`. Each
 * builder writes the stored shape as written: covers and hosting kinds are explicit, never filled in.
 */
import type { EphemeraCharacterId, EphemeraConceptId, EphemeraFeatureId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraHostingKind,
    EphemeraLudicGraphComponentNode,
    EphemeraLudicGraphFieldPayload,
    EphemeraLudicGraphStructureNode,
    EphemeraPresenceParentPointer,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import { nodeFromId } from '../../ludicGraph'
import type { SceneExit } from '../sceneModel'
import type { JudgeRequest } from './judgeRequests'
import type { SceneQuestion } from './questions'

export const roomId = (name: string) => `ROOM#${name}` as EphemeraRoomId
export const characterId = (name: string) => `CHARACTER#${name}` as EphemeraCharacterId
export const objectId = (name: string) => `OBJECT#${name}` as EphemeraObjectId
export const featureId = (name: string) => `FEATURE#${name}` as EphemeraFeatureId
export const conceptId = (name: string) => `CONCEPT#${name}` as EphemeraConceptId

/** A binding named by its owner and its own name (`[OBJECT#Table, 'onFloor']`); `'Base'` is `PRESENCE#Base`. */
export type BindingRef = readonly [EphemeraMembershipHostId, string]

export const presence = (name: string): EphemeraPresenceNodeId => PresenceKey(name) as EphemeraPresenceNodeId

const pointer = ([host, name]: BindingRef): EphemeraPresenceParentPointer => ({ host, presence: presence(name) })

/** A member of the host whose graph lists it, with its kind there. */
export const member = (id: EphemeraMembershipHostId, hostingKind: EphemeraHostingKind): EphemeraLudicGraphComponentNode => ({ ...nodeFromId(id), hostingKind })

/** One of the graph owner's own bindings: the parent bindings it sits under, and the members' bindings it covers. */
export const binding = (name: string, parents: readonly BindingRef[], covers: readonly BindingRef[] = []): EphemeraLudicGraphStructureNode => ({
    tag: 'Presence',
    universalKey: presence(name),
    fromHostPresences: parents.map(pointer),
    cover: { members: covers.map(pointer) },
})

/** A host's stored graph, its root node first. A graph given no edges stores none, as one that never held an edge does. */
export const hostGraph = (
    hostId: EphemeraMembershipHostId,
    nodes: EphemeraLudicGraphFieldPayload['nodes'],
    { edges, ports = [] }: Partial<Pick<EphemeraLudicGraphFieldPayload, 'edges' | 'ports'>> = {}
): [EphemeraMembershipHostId, EphemeraLudicGraphFieldPayload] => [hostId, { rootId: hostId, nodes: [nodeFromId(hostId), ...nodes], ...(edges !== undefined ? { edges } : {}), ports }]

/** The reasoning name and gloss each component resolves to. A component with no entry has neither. */
export type SceneFixtureNames = Record<string, { shortName?: string; gloss?: string }>

/**
 * One named scene: its graphs (folded at build time through the production fold), names, exits and question set. A
 * fixture's graphs must hold every host the fold walks to; a missing one is a fixture error.
 */
export type SceneFixture = {
    name: string
    /** One line on what the scene is for: the shape it pins. */
    description: string
    roomId: EphemeraRoomId
    actorId: EphemeraCharacterId
    graphs: [EphemeraMembershipHostId, EphemeraLudicGraphFieldPayload][]
    names: SceneFixtureNames
    exits?: SceneExit[]
    questions: SceneQuestion[]
    /** Named sets of requests for the judge probe (`JudgeProbe`), each with its expected label. */
    judgeSets?: Record<string, readonly JudgeRequest[]>
}
