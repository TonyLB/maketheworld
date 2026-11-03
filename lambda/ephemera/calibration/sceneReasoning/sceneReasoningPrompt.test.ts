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

    it('asks an open question for reasoning and changes, not a bare answer', () => {
        const open = probePrompt('SCENE', { type: 'open', asked: 'Can [c1] be poured?' })
        expect(open).toContain('Question: Can [c1] be poured?\nFirst check that everything the request names is in the scene')
        expect(open).toContain('explain briefly, then list the changes it would cause')
        expect(open).toContain('Write any move in the (move X to On Y) or (move X to In Y) notation above')
        expect(open).not.toContain('no explanation')
        expect(probePrompt('SCENE', { type: 'held' })).toContain('no explanation')
    })

    it('offers an open question reasoning headings ahead of the answer, and a reading question none', () => {
        const open = probePrompt('SCENE', { type: 'open', asked: 'Can [c1] be poured?' }, 'headings')
        const headings = ['"Constraints"', '"Blockers"', '"Opportunities"']
        headings.forEach((heading) => {
            expect(open).toContain(heading)
            expect(open.indexOf(heading)).toBeLessThan(open.indexOf('Then answer'))
        })
        expect(probePrompt('SCENE', { type: 'held' })).not.toContain('"Constraints"')
    })

    it('holds an open answer to solving each blocker it notes, or letting it stand', () => {
        const open = probePrompt('SCENE', { type: 'open', asked: 'Can [c1] be poured?' }, 'headings')
        expect(open).toContain('must be solved, with what is here, or else it stands')
        expect(open.indexOf('must be solved')).toBeLessThan(open.indexOf('Then answer'))
        expect(probePrompt('SCENE', { type: 'held' })).not.toContain('must be solved')
    })

    it('tells every question how a move works, subtree down and not host up, before showing the scene', () => {
        [probePrompt('SCENE', { type: 'held' }), probePrompt('SCENE', { type: 'open', asked: 'Why?' })].forEach((prompt) => {
            expect(prompt).toContain('(move X to On Y) or (move X to In Y) puts X on or in Y')
            expect(prompt).toContain('Whatever is on or in X goes with X, all the way down, but not the other way round')
            expect(prompt).not.toContain('move together')
            expect(prompt).not.toContain('connected')
            expect(prompt).toContain('never expect what it was resting on to come along')
            expect(prompt.indexOf('Moving things.')).toBeLessThan(prompt.indexOf('SCENE'))
        })
    })

    it('asks an open question in the answer format named, leaving reading questions alone', () => {
        const open = { type: 'open', asked: 'Can [c1] be poured?' } as const
        const plain = probePrompt('SCENE', open, 'plain')
        expect(plain).toContain('Explain briefly, then list the changes it would cause, if any')
        expect(plain).not.toContain('"Constraints"')
        const candidates = probePrompt('SCENE', open, 'candidates')
        expect(candidates).toContain('list the candidate ways to do it using only what is here')
        expect(candidates).toContain('write "No candidate" and say why in one sentence, and stop')
        expect(candidates).toContain('If every candidate is blocked, say what would have to change first, and stop')
        expect(candidates).not.toContain('Think it through first')
        const abstain = probePrompt('SCENE', open, 'abstain')
        expect(abstain).toContain('write "No candidate", say why in one sentence, and stop; do not assume it into existence')
        expect(abstain).not.toContain('candidate ways')
        expect(abstain).not.toContain('"Constraints"')
        expect(probePrompt('SCENE', open)).toBe(abstain)
        expect(probePrompt('SCENE', open)).not.toBe(probePrompt('SCENE', open, 'headings'))
        expect(probePrompt('SCENE', { type: 'held' }, 'candidates')).toBe(probePrompt('SCENE', { type: 'held' }))
    })

    it('grounds every question, reading or open, in the established scene before showing it', () => {
        [probePrompt('SCENE', { type: 'held' }), probePrompt('SCENE', { type: 'open', asked: 'Why?' })].forEach((prompt) => {
            expect(prompt.startsWith('You are the reasoner for a game world')).toBe(true)
            expect(prompt).toContain('the scene wins')
            expect(prompt.indexOf('the scene wins')).toBeLessThan(prompt.indexOf('SCENE'))
        })
    })

    it('asks for a puzzle-solver\'s register, using what is here before what would have to change', () => {
        const prompt = probePrompt('SCENE', { type: 'held' })
        expect(prompt).toContain('Think like a player solving a puzzle')
        expect(prompt).toContain('look for another way with what is here')
        expect(prompt).not.toContain('reasonably')
    })

    it('differs between scenes only in the scene text', () => {
        const q: SceneQuestion = { type: 'held' }
        const a = probePrompt('SCENE-A', q)
        const b = probePrompt('SCENE-B', q)
        expect(a.replace('SCENE-A', '')).toBe(b.replace('SCENE-B', ''))
    })
})
