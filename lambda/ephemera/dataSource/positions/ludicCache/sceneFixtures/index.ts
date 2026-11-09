/**
 * The scene fixtures (sceneProjection SP-8): a closed, named set of worlds compiled into the bundle, one definition per
 * scene, read by the scene model's tests, the renderer's golden tests and the scene-reasoning probe alike, so the scene a reader
 * reasons about is the scene the tests pin. A new situation met in dev becomes a fixture here, never a payload-defined scene.
 *
 * `buildSceneFixture` folds a world through the production path (`buildActorLudicCache`, over `buildLudicCache` for the
 * room row and the actor half), with the graphs and names read from memory instead of the store.
 *
 * A fixture's graphs are hand-written, or built by `buildScene` (`buildScene.ts`) from a description: placements through
 * population and relations as kernel steps, so a variant is a choice in the description (the tavern's hammer, held or on
 * the floor) and a theme variant a names override. The oracle harness's scenes (`teaTableDungeon`, `teaTableDollHouse`,
 * `teaTableHammerHeld`, `teaTableChained`) are `teaTable`'s description with one change each. Hand-written graphs pin the fold independently of population; those
 * written in production's shape (`teaTable.ts`) are what their descriptions must build, node order included.
 */
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraConceptId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { mergedComponentResult, type ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardConcept } from '@tonylb/mtw-wml/ts/standardize/components/concept'
import { StandardFeature } from '@tonylb/mtw-wml/ts/standardize/components/feature'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'

import { EphemeraLudicGraph } from '../../ludicGraph'
import { buildActorLudicCache, type ActorLudicCache } from '../actorCache'
import { buildLudicCache, type BuildLudicCacheDeps } from '../fold'
import { heldInventoryScene, openLegsScene } from './kitchen'
import { labScene } from './lab'
import { drapedClothScene, featureScene, joinScene, steamerChestScene } from './placements'
import { dockScene, unnamedScene } from './relations'
import { sideboardScene } from './sideboard'
import { deepChainScene, emptyRoomScene, siblingFanScene, twoCupsScene } from './simpleRooms'
import { branchInBranchScene, tavernHammerOnFloorScene, tavernScene } from './tavern'
import { teaTableChainedScene, teaTableCupOnFloorScene, teaTableDollHouseScene, teaTableDungeonScene, teaTableHammerHeldScene, teaTableScene } from './teaTable'
import type { SceneFixture, SceneFixtureNames } from './worldBuilders'

export type { SceneFixture } from './worldBuilders'
export type { JudgeRequest } from './judgeRequests'
export { teaTableProposals } from './teaTable'
export { expectedAnswer, type SceneAnswer, type SceneQuestion } from './questions'

/** Every fixture, in corpus order, then the ones Slice 1 added, then Slice 3's, then the fixture builder's (oracleLoop Slice 1), then the oracle harness's (oracleLoop Slice 3). */
export const sceneFixtures: readonly SceneFixture[] = [
    tavernScene,
    siblingFanScene,
    branchInBranchScene,
    deepChainScene,
    labScene,
    heldInventoryScene,
    twoCupsScene,
    dockScene,
    openLegsScene,
    drapedClothScene,
    unnamedScene,
    emptyRoomScene,
    steamerChestScene,
    joinScene,
    featureScene,
    sideboardScene,
    teaTableScene,
    teaTableCupOnFloorScene,
    tavernHammerOnFloorScene,
    teaTableDungeonScene,
    teaTableDollHouseScene,
    teaTableHammerHeldScene,
    teaTableChainedScene,
]

export const sceneFixtureNames = sceneFixtures.map(({ name }) => name)

/** The fixture of this name; an unknown name throws, listing the valid ones. */
export const sceneFixture = (name: string): SceneFixture => {
    const fixture = sceneFixtures.find((candidate) => candidate.name === name)
    if (fixture === undefined) {
        throw new Error(`Unknown scene fixture "${name}"; expected one of: ${sceneFixtureNames.join(', ')}`)
    }
    return fixture
}

const componentOf = (id: string, { shortName, gloss }: SceneFixtureNames[string]): StandardComponent | undefined => {
    const fields = { ...(shortName !== undefined ? { shortName } : {}), ...(gloss !== undefined ? { gloss } : {}) }
    if (isEphemeraRoomId(id)) {
        return new StandardRoom({ tag: 'Room', ...fields })
    }
    if (isEphemeraObjectId(id)) {
        return new StandardObject({ tag: 'Object', ...fields })
    }
    if (isEphemeraFeatureId(id)) {
        return new StandardFeature({ tag: 'Feature', ...fields })
    }
    return isEphemeraConceptId(id) ? new StandardConcept({ tag: 'Concept', ...fields }) : undefined
}

/** The fold's reads, from the fixture: its graphs (a host it does not hold is a fixture error) and its names. */
const fixtureDeps = ({ name, graphs, names }: SceneFixture): Required<BuildLudicCacheDeps> => {
    const payloads = new Map(graphs)
    return {
        getLudicGraph: async (hostId: EphemeraMembershipHostId) => {
            const payload = payloads.get(hostId)
            if (payload === undefined) {
                throw new Error(`Scene fixture "${name}" has no graph for ${hostId}`)
            }
            return EphemeraLudicGraph.fromFieldPayload(hostId, payload)
        },
        getComponentAggregate: (async (perspectives) => perspectives.flatMap((perspective) => {
            const entry = names[perspective.universalKey]
            const merged = entry === undefined ? undefined : componentOf(perspective.universalKey, entry)
            return merged === undefined ? [] : [mergedComponentResult({
                universalKey: perspective.universalKey as EphemeraId,
                merged,
                mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
            })]
        })) as ComponentAggregateMergedCache['get'],
    }
}

/** The fixture's actor's cache, folded through the production path. */
export const buildSceneFixture = async (fixture: SceneFixture): Promise<ActorLudicCache> => {
    const buildDeps = fixtureDeps(fixture)
    return buildActorLudicCache(fixture.actorId, fixture.roomId, {
        readLudicCache: async (roomId) => ({ cache: (await buildLudicCache(roomId, [], buildDeps)).cache, outcome: 'hit' }),
        resolveCanonStack: async () => [],
        buildDeps,
    })
}
