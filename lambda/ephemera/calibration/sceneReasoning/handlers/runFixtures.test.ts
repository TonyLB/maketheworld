import { sceneFixtureNames } from '../../../dataSource/positions/ludicCache/sceneFixtures'
import { sceneFanGoldens, sceneFlatDGoldens, sceneGoldens } from '../../../dataSource/actions/sceneProse/sceneGoldens'
import { handleSceneReasoningFixtures } from './runFixtures'

describe('handleSceneReasoningFixtures', () => {
    it('lists every fixture with a render per format (the goldens) and its questions', async () => {
        const response = await handleSceneReasoningFixtures({ type: 'SceneReasoningFixtures' })
        expect(response.statusCode).toBe(200)
        const { formats, fixtures } = JSON.parse(response.body)
        expect(formats).toEqual(['D', 'flatD', 'fans'])
        expect(fixtures.map(({ name }: { name: string }) => name)).toEqual(sceneFixtureNames)
        for (const fixture of fixtures) {
            expect(fixture.renders).toEqual({ D: sceneGoldens[fixture.name], flatD: sceneFlatDGoldens[fixture.name], fans: sceneFanGoldens[fixture.name] })
            expect(fixture.questions.length).toBeGreaterThan(0)
            for (const { question, expected, prompt } of fixture.questions) {
                expect(expected === undefined).toBe(question.type === 'open')
                expect(prompt).toContain('<scene>')
            }
        }
    })
})
