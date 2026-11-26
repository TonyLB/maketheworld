//
// What a piece may know of the scene, applied before its render (AGENT.sceneModelFilters.planning.md, step 3): the fixture's full scene
// model, its rule handles minted on it, then the knowledge the piece's view declares (the securing known or omitted; the whole scene, a
// sub-scene, or none), each a filter of the model. A piece's render is built by `withViewedScene`, so the part that words the scene, one of
// the piece's named renderers (`sceneRenders.ts`), is handed the viewed scene model and never builds the full one. A leaf module, as `sceneRenders.ts` is.
//
import { withoutSecuring } from '../../dataSource/actions/sceneProse/sceneRules'
import { subScene } from '../../dataSource/actions/sceneProse/subScene'
import { filterViewedModel, viewedSceneModel, type ViewedSceneModel } from '../../dataSource/actions/sceneProse/viewedSceneModel'
import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneHandle, SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import { SCENE_SHOWS, SECURINGS, type SceneShows, type SceneView, type Securing } from './sceneRenders'

/** A fixture's full scene model. */
export const fixtureScene = async (name: string): Promise<SceneModel> => {
    const fixture = sceneFixture(name)
    return (await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene
}

/**
 * The knowledge a call reads: the view's, each axis overridden by a payload option of the same axis where it gives a known value (`show`
 * for `shows`, `securing`), as the registry's option-drift check pairs them. An option on any other axis is no part of it.
 */
export const knowledgeOf = (view: SceneView, options: unknown): SceneView => {
    const { show, securing } = (typeof options === 'object' && options !== null ? options : {}) as { show?: unknown; securing?: unknown }
    return {
        shows: (SCENE_SHOWS as readonly unknown[]).includes(show) ? show as SceneShows : view.shows,
        securing: (SECURINGS as readonly unknown[]).includes(securing) ? securing as Securing : view.securing,
    }
}

/**
 * The full model through what may be known of it: the securing left out where it is omitted (`withoutSecuring`), then the sub-scene of
 * the given handles (`subScene`, which throws on one not in the scene), the whole, or none. A sub-scene with no handles given is the
 * caller's error.
 */
export const viewScene = (full: SceneModel, { shows, securing }: SceneView, handles?: readonly SceneHandle[]): ViewedSceneModel | undefined => {
    if (shows === 'none') {
        return undefined
    }
    const viewed = viewedSceneModel(full)
    const known = securing === 'omitted' ? filterViewedModel(viewed, withoutSecuring) : viewed
    if (shows === 'whole') {
        return known
    }
    if (handles === undefined) {
        throw new Error('A sub-scene needs the handles it keeps')
    }
    return filterViewedModel(known, (model) => subScene(model, [...new Set(handles)]))
}

/**
 * What a piece works out before its scene is filtered: the handles its sub-scene keeps, from its inputs. It may throw on inputs that
 * don't fit the fixture. It hands the render nothing else, so the render reads nothing past the scene it may know.
 */
export type ScenePrep<Cell, Options> = (cell: Cell, options: Options, full: SceneModel) => { handles?: readonly SceneHandle[] }

/**
 * A piece's render, with the scene it may know applied before it: the cell's fixture built, the prep run (where there is one), the
 * knowledge applied (`knowledgeOf`, `viewScene`), and the render handed the viewed scene model, or none where the piece shows none.
 */
export const withViewedScene = <Cell extends { inputs: { fixture: string } }, Options, Result>(
    view: SceneView,
    render: (cell: Cell, options: Options, viewed: ViewedSceneModel | undefined) => Result | Promise<Result>,
    prepare?: ScenePrep<Cell, Options>,
) => async (cell: Cell, options: Options): Promise<Result> => {
    const full = await fixtureScene(cell.inputs.fixture)
    const { handles } = prepare === undefined ? { handles: undefined } : prepare(cell, options, full)
    return render(cell, options, viewScene(full, knowledgeOf(view, options), handles))
}

/** The viewed scene model, where the piece's view shows one: a render that always shows a scene asks for it this way. */
export const shownScene = (viewed: ViewedSceneModel | undefined): ViewedSceneModel => {
    if (viewed === undefined) {
        throw new Error('This render shows a scene, and was given none')
    }
    return viewed
}
