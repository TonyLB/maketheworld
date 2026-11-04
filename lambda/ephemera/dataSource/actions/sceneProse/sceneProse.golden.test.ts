import { buildSceneFixture, sceneFixture, sceneFixtureNames } from '../../positions/ludicCache/sceneFixtures'
import { renderScene, type SceneFormat } from '.'
import { sceneAffordanceGoldens, sceneExamplesGoldens, sceneGoldens, sceneRegistersGoldens } from './sceneGoldens'

/** The formats with a full golden per fixture. `affordance` and `examples` are `registers` plus one section: see below. */
const goldens: Partial<Record<SceneFormat, Record<string, string>>> = {
    D: sceneGoldens, registers: sceneRegistersGoldens,
}
const gridFormats = Object.keys(goldens) as SceneFormat[]

const renderFixture = async (name: string, format: SceneFormat): Promise<string> => {
    const fixture = sceneFixture(name)
    const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
    return renderScene(scene, format)
}

/** A section's golden is where it goes: after the heading line (foreground) or at the end (examples). */
const withForeground = (registers: string, section: string | undefined): string => {
    const [heading, ...rest] = registers.split('\n')
    return section === undefined ? registers : [heading, section, ...rest].join('\n')
}
const withExamples = (registers: string, section: string | undefined): string => section === undefined ? registers : `${registers}\n${section}`

describe('scene renderer: goldens', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it.each(gridFormats)('has a %s golden for every fixture', (format) => {
        expect(Object.keys(goldens[format] as Record<string, string>).sort()).toEqual([...sceneFixtureNames].sort())
    })

    it.each(gridFormats.flatMap((format) => sceneFixtureNames.map((name) => [format, name] as const)))(
        'renders %s golden of %s',
        async (format, name) => {
            expect(await renderFixture(name, format)).toBe((goldens[format] as Record<string, string>)[name])
        }
    )

    // `affordance` and `examples` differ from `registers` by one section, so only that section is pinned; the rest of
    // the render is `registers`' (above). A fixture with no entry must render exactly as `registers`.
    it.each([
        ['affordance', sceneAffordanceGoldens, withForeground],
        ['examples', sceneExamplesGoldens, withExamples],
    ] as const)('renders %s as registers plus its pinned section, for every fixture', async (format, sections, assemble) => {
        expect(Object.keys(sections).every((name) => sceneFixtureNames.includes(name))).toBe(true)
        const mismatches = (await Promise.all(sceneFixtureNames.map(async (name) => (
            (await renderFixture(name, format)) === assemble(sceneRegistersGoldens[name], sections[name]) ? undefined : name
        )))).filter((name) => name !== undefined)
        expect(mismatches).toEqual([])
    })
})
