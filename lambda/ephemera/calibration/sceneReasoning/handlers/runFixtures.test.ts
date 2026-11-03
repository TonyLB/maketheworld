import { sceneFixtureNames } from '../../../dataSource/positions/ludicCache/sceneFixtures'
import { sceneGoldens } from '../../../dataSource/actions/sceneProse/sceneGoldens'
import { handleSceneReasoningFixtures } from './runFixtures'

describe('handleSceneReasoningFixtures', () => {
    it('lists every fixture with its render (the golden) and its questions', async () => {
        const response = await handleSceneReasoningFixtures({ type: 'SceneReasoningFixtures' })
        expect(response.statusCode).toBe(200)
        const { fixtures } = JSON.parse(response.body)
        expect(fixtures.map(({ name }: { name: string }) => name)).toEqual(sceneFixtureNames)
        for (const fixture of fixtures) {
            expect(fixture.render).toBe(sceneGoldens[fixture.name])
            expect(fixture.questions.length).toBeGreaterThan(0)
            for (const { question, expected, prompt } of fixture.questions) {
                expect(expected === undefined).toBe(question.type === 'open')
                expect(prompt).toContain('<scene>')
            }
        }
    })
})
