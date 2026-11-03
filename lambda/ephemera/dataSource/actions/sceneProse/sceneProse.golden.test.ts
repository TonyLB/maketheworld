import { buildSceneFixture, sceneFixture, sceneFixtureNames } from '../../positions/ludicCache/sceneFixtures'
import { renderScene, type SceneFormat } from '.'
import { sceneFanGoldens, sceneGoldens } from './sceneGoldens'

const goldens: Record<SceneFormat, Record<string, string>> = { D: sceneGoldens, fans: sceneFanGoldens }

describe('scene renderer: goldens', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it.each(Object.keys(goldens) as SceneFormat[])('has a %s golden for every fixture', (format) => {
        expect(Object.keys(goldens[format]).sort()).toEqual([...sceneFixtureNames].sort())
    })

    it.each((Object.keys(goldens) as SceneFormat[]).flatMap((format) => sceneFixtureNames.map((name) => [format, name] as const)))(
        'renders %s golden of %s',
        async (format, name) => {
            const fixture = sceneFixture(name)
            const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
            expect(renderScene(scene, format)).toBe(goldens[format][name])
        }
    )
})
