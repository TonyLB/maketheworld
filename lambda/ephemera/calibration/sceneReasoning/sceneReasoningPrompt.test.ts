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

    it('tells every question how a move is recorded, as a change of place, before showing the scene', () => {
        [probePrompt('SCENE', { type: 'held' }), probePrompt('SCENE', { type: 'open', asked: 'Why?' })].forEach((prompt) => {
            expect(prompt).toContain('(move X to On Y) or (move X to In Y) records that X is now on or in Y')
            expect(prompt).toContain('Once you know what would happen, the records keep only what is different afterwards')
            expect(prompt).toContain('Different actions with the same result are the same change')
            expect(prompt).toContain('what X left only loses X')
            expect(prompt).toContain('write one move for each thing whose own place changed, not for the things carried along with it')
            expect(prompt).not.toContain('any way at all')
            expect(prompt).not.toContain('move together')
            expect(prompt).not.toContain('connected')
            expect(prompt.indexOf('Moving things.')).toBeLessThan(prompt.indexOf('SCENE'))
        })
    })

    it('asks an open question in the answer format named, twoRegisters by default, leaving reading questions alone', () => {
        const open = { type: 'open', asked: 'Can [c1] be poured?' } as const
        const abstain = probePrompt('SCENE', open, 'abstain')
        expect(abstain).toContain('write "No candidate", say why in one sentence, and stop; do not assume it into existence')
        expect(abstain).toContain('If no way works, write "No candidate" and say what would have to change.')
        expect(probePrompt('SCENE', open)).toBe(probePrompt('SCENE', open, 'twoRegisters'))
        expect(probePrompt('SCENE', open)).not.toBe(abstain)
        expect(probePrompt('SCENE', { type: 'held' }, 'abstain')).toBe(probePrompt('SCENE', { type: 'held' }))
    })

    it('asks for the action and then the net changes in two parts under twoRegisters, with abstain\'s stop kept', () => {
        const open = { type: 'open', asked: 'Can [c1] be poured?' } as const
        const two = probePrompt('SCENE', open, 'twoRegisters')
        expect(two).toContain('write "No candidate", say why in one sentence, and stop; do not assume it into existence')
        expect(two).toContain('What happens: say in plain words, with no notation and in the order it happens')
        expect(two.indexOf('What happens:')).toBeLessThan(two.indexOf('What changes:'))
        expect(two).toContain('and what goes along with it. If no way works')
        expect(two).not.toContain('stays behind')
        expect(two).toContain('one line for each thing whose own place changed; what went along with it is already recorded by its move. Write any move in the (move X to On Y)')
        expect(two).toContain('If everything the request names is in the scene, answer in two parts')
        expect(two).not.toContain('First check that everything')
        expect(two).not.toContain('as short steps')
        expect(probePrompt('SCENE', open, 'abstain')).not.toBe(two)
        expect(probePrompt('SCENE', { type: 'held' }, 'twoRegisters')).toBe(probePrompt('SCENE', { type: 'held' }))
    })

    it('grounds every question, reading or open, in the established scene before showing it', () => {
        [probePrompt('SCENE', { type: 'held' }), probePrompt('SCENE', { type: 'open', asked: 'Why?' })].forEach((prompt) => {
            expect(prompt.startsWith('You are the reasoner for a game world')).toBe(true)
            expect(prompt).toContain('the scene wins')
            expect(prompt.indexOf('the scene wins')).toBeLessThan(prompt.indexOf('SCENE'))
        })
    })

    it('gives a way of working in positive steps, the simplest first, with the puzzle-solver only last', () => {
        const prompt = probePrompt('SCENE', { type: 'held' })
        const rungs = ['1. Take the simplest way to do it', '2. If something stops a step', '3. If not, think like a player solving a puzzle']
        rungs.forEach((rung, at) => {
            expect(prompt).toContain(rung)
            expect(prompt.indexOf(rung)).toBeLessThan(prompt.indexOf(rungs[at + 1] ?? 'SCENE'))
        })
        expect(prompt).toContain('If nothing stops any step, those steps are your answer.')
        expect(prompt).toContain('stop at the first step that gives an answer')
        expect(prompt).toContain('a motorcycle that cannot fit in a shoebox')
        expect(prompt).not.toContain('when the obvious way is blocked')
        expect(prompt).not.toContain('reasonably')
    })

    it('says which register wins on what: the scene on what is here, the world on what follows', () => {
        const prompt = probePrompt('SCENE', { type: 'held' })
        expect(prompt).toContain('What follows from that, what goes with what and what a thing can be used for, comes from how things are in the world')
        expect(prompt).toContain('their layout is not a rule about what moves')
    })

    it('differs between scenes only in the scene text', () => {
        const q: SceneQuestion = { type: 'held' }
        const a = probePrompt('SCENE-A', q)
        const b = probePrompt('SCENE-B', q)
        expect(a.replace('SCENE-A', '')).toBe(b.replace('SCENE-B', ''))
    })
})
