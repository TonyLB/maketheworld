import { buildSceneFixture, sceneFixture, sceneFixtureNames } from '../../positions/ludicCache/sceneFixtures'
import { renderScene } from '.'
import { sceneGoldens } from './sceneGoldens'

describe('scene renderer: goldens', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('has a golden for every fixture', () => {
        expect(Object.keys(sceneGoldens).sort()).toEqual([...sceneFixtureNames].sort())
    })

    it.each(sceneFixtureNames)('renders %s\'s golden', async (name) => {
        const fixture = sceneFixture(name)
        const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
        expect(renderScene(scene)).toBe(sceneGoldens[name])
    })
})
