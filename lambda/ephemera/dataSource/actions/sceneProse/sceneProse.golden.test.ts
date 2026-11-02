import { buildSceneFixture, sceneFixture, sceneFixtureNames } from '../../positions/ludicCache/sceneFixtures'
import { renderScene, sceneFormats } from '.'
import { sceneGoldens } from './sceneGoldens'

describe('scene renderers: goldens', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('has a golden for every fixture, in every format', () => {
        expect(Object.keys(sceneGoldens).sort()).toEqual([...sceneFixtureNames].sort())
        Object.values(sceneGoldens).forEach((golden) => expect(Object.keys(golden).sort()).toEqual([...sceneFormats].sort()))
    })

    describe.each(sceneFixtureNames)('%s', (name) => {
        it.each(sceneFormats)('renders its golden in format %s', async (format) => {
            const fixture = sceneFixture(name)
            const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
            expect(renderScene(format, scene)).toBe(sceneGoldens[name][format])
        })
    })
})
