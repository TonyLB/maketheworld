import type { SceneQuestion } from '../../dataSource/positions/ludicCache/sceneFixtures'
import { probePrompt, questionText } from './sceneReasoningPrompt'

describe('sceneReasoningPrompt', () => {
    it('words every question type, naming things by handle', () => {
        const questions: SceneQuestion[] = [
            { type: 'directContents' },
            { type: 'directContents', subject: 't1' },
            { type: 'placedOn', subject: 'c1' },
            { type: 'chainOut', subject: 'c1' },
            { type: 'whereIs', subject: 'c1' },
            { type: 'movesWith', subject: 't1' },
            { type: 'held' },
            { type: 'relatedTo', subject: 'r1', label: 'tied to' },
            { type: 'relatedFrom', target: 'p1', label: 'tied to' },
            { type: 'securedTo', target: 'p1' },
            { type: 'associatedWith', subject: 'x1' },
            { type: 'howMany', name: 'cup' },
            { type: 'open', asked: 'Can [c1] be poured?' },
        ]
        const texts = questions.map(questionText)
        expect(new Set(texts).size).toBe(questions.length)
        expect(texts[2]).toContain('[c1]')
        expect(texts[1]).toBe('What is on or in [t1]? List only what sits directly on or in it, not things on or in those.')
        expect(texts[2]).toBe('What is [c1] in or on? Name only the nearest thing, not what that thing is in or on.')
        expect(texts[7]).toBe('What is [r1] tied to?')
        expect(texts[8]).toBe('What is tied to [p1]?')
    })

    it('prefers a question\'s own wording', () => {
        expect(questionText({ type: 'held', asked: 'What do I hold?' })).toBe('What do I hold?')
    })

    it('asks an open question for reasoning and changes, not a bare answer, under abstain', () => {
        const open = probePrompt('SCENE', { type: 'open', asked: 'Can [c1] be poured?' }, 'abstain')
        expect(open).toContain('Question: Can [c1] be poured?\nFirst check that everything the request names is in the scene')
        expect(open).toContain('explain briefly, then list the changes it would cause')
        expect(open).toContain('Write any move in the (move X to On Y) or (move X to In Y) notation above')
        expect(open).not.toContain('no explanation')
        expect(probePrompt('SCENE', { type: 'held' })).toContain('no explanation')
    })

    it('differs between scenes only in the scene text', () => {
        const q: SceneQuestion = { type: 'held' }
        const a = probePrompt('SCENE-A', q)
        const b = probePrompt('SCENE-B', q)
        expect(a.replace('SCENE-A', '')).toBe(b.replace('SCENE-B', ''))
    })
})
