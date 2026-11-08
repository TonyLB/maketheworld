/**
 * The fixture builder (oracleLoop Slice 1): a scene from one description, placed through the instruction set production
 * uses for authored placement, so that a variant is a choice in the description instead of a hand-copied fixture. The
 * hand-written core is the room and the actor, whose one binding is `Base` in the room's `Base` (a character holds exactly
 * one binding). Every thing is placed from nothing with `rootStep` and `containmentPopulationSteps`, its relations are
 * `establishRelation` and `assignEdgeId` steps in the order production's tie writes them (`edgeRelationSteps`), and each
 * is applied by `applyStepSequenceCore`. All of it is synchronous, so a built scene is an ordinary `SceneFixture` at module
 * load. Covers are the kernel's (its cover index), in placement order.
 *
 * Production code, as the rest of this directory is (SP-8): nothing here imports a test-only module.
 */
import type { EphemeraConceptId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraHostingKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicNodeTerminal, relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraLudicGraph, type HostRelationalEdge } from '../../ludicGraph'
import { containmentPopulationSteps, rootStep } from '../../manipulation/containment/containmentPopulationSteps'
import { applyStepSequenceCore } from '../../manipulation/kernel/applyStepSequenceCore'
import type { MutationKernelStep } from '../../manipulation/kernel/kernelStep'
import { binding, hostGraph, type SceneFixture, type SceneFixtureNames } from './worldBuilders'

/**
 * One thing's first placement: under `host`, with its kind there (else the arrival default) and, if the thing already
 * holds a binding, the name of the further one it takes. A thing's first binding is always `Base`.
 */
export type ScenePlacement = {
    thing: EphemeraRoomId | EphemeraFeatureId | EphemeraObjectId | EphemeraConceptId
    host: EphemeraMembershipHostId
    hostingKind?: EphemeraHostingKind
    bindingName?: string
}

/** The relations stored in one host's graph. An edge with an `edgeId` can be named by a later edge (`{ edgeId }`). */
export type SceneRelations = {
    host: EphemeraMembershipHostId
    edges: readonly HostRelationalEdge[]
}

/**
 * A scene as choices: everything a `SceneFixture` holds except its graphs, which are built from `placements` (outside in:
 * a host is placed before its contents) and `relations`.
 */
export type SceneDescription = Omit<SceneFixture, 'graphs'> & {
    placements: readonly ScenePlacement[]
    relations?: readonly SceneRelations[]
}

const applied = (steps: readonly MutationKernelStep[], graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>, what: string): void => {
    const outcome = applyStepSequenceCore(steps, graphs)
    if (outcome.verdict !== 'legal') {
        throw new Error(`buildScene: ${what} is ${outcome.verdict} (${outcome.reasonCode})`)
    }
    outcome.graphs.forEach((graph, hostId) => graphs.set(hostId, graph))
}

const place = (graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>, { thing, host, hostingKind, bindingName }: ScenePlacement): void => {
    const what = `placing ${thing} under ${host}`
    const hostGraphNow = graphs.get(host)
    if (hostGraphNow === undefined) {
        throw new Error(`buildScene: ${what}, but ${host} is not placed yet (placements go outside in)`)
    }
    const root = rootStep(host, hostGraphNow)
    const thingGraph = graphs.get(thing) ?? EphemeraLudicGraph.empty(thing)
    const steps = containmentPopulationSteps(host, thing, root.graph, thingGraph, { hostingKind, bindingName })
    const minted = steps.find((step) => step.kind === 'addPresenceBinding' && step.presenceUuid !== 'Base')
    if (minted?.kind === 'addPresenceBinding' && minted.presenceUuid !== bindingName) {
        throw new Error(`buildScene: ${what} takes a further binding, which needs a bindingName so the scene builds the same each time`)
    }
    if (steps.length === 0) {
        throw new Error(`buildScene: ${what} writes nothing`)
    }
    graphs.set(thing, thingGraph)
    applied([...(root.step ? [root.step] : []), ...steps], graphs, what)
}

const relationStep = (hostId: EphemeraMembershipHostId, { from, to, ...edge }: HostRelationalEdge): MutationKernelStep => (
    { kind: 'establishRelation', hostId, subjectId: from, targetId: to, ...relationKindAndLabelOf(edge) }
)

const namesAnotherEdge = ({ from, to }: HostRelationalEdge): boolean => !isEphemeraLudicNodeTerminal(from) || !isEphemeraLudicNodeTerminal(to)

/** Production's order (`edgeRelationSteps`): the edges between things, then their ids, then the edges naming another edge. */
const relationSteps = ({ host, edges }: SceneRelations): MutationKernelStep[] => [
    ...edges.filter((edge) => !namesAnotherEdge(edge)).map((edge) => relationStep(host, edge)),
    ...edges.flatMap(({ edgeId, ...edge }) => (edgeId === undefined ? [] : [{ kind: 'assignEdgeId' as const, hostId: host, edge, edgeId }])),
    ...edges.filter(namesAnotherEdge).map((edge) => relationStep(host, edge)),
]

/** The scene `description` builds. Each `names` entry replaces the description's for that component, so a theme variant is a names change. */
export const buildScene = ({ placements, relations = [], ...fixture }: SceneDescription, { names = {} }: { names?: SceneFixtureNames } = {}): SceneFixture => {
    const [actorId, actorPayload] = hostGraph(fixture.actorId, [binding('Base', [[fixture.roomId, 'Base']])])
    const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
        [fixture.roomId, EphemeraLudicGraph.empty(fixture.roomId)],
        [actorId, EphemeraLudicGraph.fromFieldPayload(actorId, actorPayload)],
    ])
    placements.forEach((placement) => place(graphs, placement))
    relations.forEach((entry) => applied(relationSteps(entry), graphs, `relating in ${entry.host}`))
    return {
        ...fixture,
        names: { ...fixture.names, ...names },
        graphs: [...graphs].map(([hostId, graph]) => [hostId, graph.toStored()]),
    }
}
