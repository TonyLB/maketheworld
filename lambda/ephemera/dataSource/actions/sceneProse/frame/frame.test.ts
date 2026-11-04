import { SECURED, SECURED_DEFINITION, SECURED_FICTION, SECURED_GRAPH, TRIAGE_LABELS, isTriageLabel, GROUNDING, LADDER, MOVING, NOTATION, OPEN_ANSWER_FORMATS, PRECEDENCE, READING, SCENE_INTRO, composeFrame, defaultAnswerFormat, isAnswerFormat, scenePrompt } from '.'

const prompt = (answer: string = OPEN_ANSWER_FORMATS[defaultAnswerFormat], sceneText = 'SCENE'): string => (
    scenePrompt({ frame: GROUNDING, sceneText, question: 'Why?', answer })
)

describe('frame', () => {
    it('composes the grounding from its layers in order, a blank line between blocks', () => {
        expect(GROUNDING).toBe([READING, SECURED, PRECEDENCE, LADDER, MOVING].join('\n\n'))
        expect(composeFrame({ reading: 'r', fiction: 'f', graph: 'g' })).toBe('r\n\nf\n\ng')
        expect(GROUNDING.indexOf(READING)).toBeLessThan(GROUNDING.indexOf(PRECEDENCE))
        expect(GROUNDING.indexOf(PRECEDENCE)).toBeLessThan(GROUNDING.indexOf(LADDER))
        expect(GROUNDING.indexOf(LADDER)).toBeLessThan(GROUNDING.indexOf(MOVING))
    })

    it('defines secured once, with its fiction and its graph, and names no fixture word for it', () => {
        expect(SECURED).toBe([SECURED_DEFINITION, SECURED_FICTION, SECURED_GRAPH].join('\n\n'))
        expect(GROUNDING.indexOf(READING)).toBeLessThan(GROUNDING.indexOf(SECURED))
        expect(SECURED_FICTION).toContain('Moving the thing secured *to* needs to also move the thing secured')
        expect(SECURED_GRAPH).toContain('The parent can be rehomed, but the child cannot be removed *from* the parent.')
        expect(SECURED_GRAPH).toContain('Siblings must remain siblings')
        expect(GROUNDING).not.toContain('glued')
        expect(GROUNDING).not.toContain('secured to the floor')
    })

    it('leaves out a layer a caller does not supply', () => {
        expect(composeFrame({ reading: READING, fiction: PRECEDENCE, graph: '' }).includes('Moving things.')).toBe(false)
    })

    it('puts the frame, the scene intro, the scene, the question and the answer in that order', () => {
        const text = prompt('ANSWER')
        expect(text).toBe([GROUNDING, '', SCENE_INTRO, '', 'SCENE', '', 'Question: Why?', 'ANSWER'].join('\n'))
        expect(text.endsWith('Question: Why?\nANSWER')).toBe(true)
    })

    it('tells every prompt how a move is recorded, as a change of place, before showing the scene', () => {
        const text = prompt()
        expect(text).toContain('(move X to On Y) or (move X to In Y) records that X is now on or in Y')
        expect(text).toContain('Once you know what would happen, the records keep only what is different afterwards')
        expect(text).toContain('Different actions with the same result are the same change')
        expect(text).toContain('what X left only loses X')
        expect(text).toContain('write one move for each thing whose own place changed, not for the things carried along with it')
        expect(text).not.toContain('any way at all')
        expect(text).not.toContain('move together')
        expect(text).not.toContain('connected')
        expect(text.indexOf('Moving things.')).toBeLessThan(text.indexOf('SCENE'))
    })

    it('grounds every question in the established scene before showing it', () => {
        const text = prompt()
        expect(text.startsWith('You are the reasoner for a game world')).toBe(true)
        expect(text).toContain('the scene wins')
        expect(text.indexOf('the scene wins')).toBeLessThan(text.indexOf('SCENE'))
    })

    it('gives a way of working in positive steps, the simplest first, with the puzzle-solver only last', () => {
        const text = prompt()
        const rungs = ['1. Take the simplest way to do it', '2. If something stops a step', '3. If not, think like a player solving a puzzle']
        rungs.forEach((rung, at) => {
            expect(text).toContain(rung)
            expect(text.indexOf(rung)).toBeLessThan(text.indexOf(rungs[at + 1] ?? 'SCENE'))
        })
        expect(text).toContain('If nothing stops any step, those steps are your answer.')
        expect(text).toContain('stop at the first step that gives an answer')
        expect(text).toContain('a motorcycle that cannot fit in a shoebox')
        expect(text).not.toContain('when the obvious way is blocked')
        expect(text).not.toContain('reasonably')
    })

    it('says which register wins on what: the scene on what is here, the world on what follows', () => {
        expect(PRECEDENCE).toContain('What follows from that, what goes with what and what a thing can be used for, comes from how things are in the world')
        expect(PRECEDENCE).toContain('their layout is not a rule about what moves')
    })

    it('names the answer formats, twoRegisters by default, each keeping the stop rule and the notation line', () => {
        expect(defaultAnswerFormat).toBe('twoRegisters')
        expect(isAnswerFormat('abstain')).toBe(true)
        expect(isAnswerFormat('tree')).toBe(false)
        const { abstain, twoRegisters } = OPEN_ANSWER_FORMATS
        expect(abstain).toContain('write "No candidate", say why in one sentence, and stop; do not assume it into existence')
        expect(abstain).toContain('If no way works, write "No candidate" and say what would have to change.')
        expect(abstain).toContain(NOTATION)
        expect(twoRegisters).toContain('write "No candidate", say why in one sentence, and stop; do not assume it into existence')
        expect(twoRegisters).toContain('What happens: say in plain words, with no notation and in the order it happens')
        expect(twoRegisters.indexOf('What happens:')).toBeLessThan(twoRegisters.indexOf('What changes:'))
        expect(twoRegisters).toContain('and what goes along with it. If no way works')
        expect(twoRegisters).not.toContain('stays behind')
        expect(twoRegisters).toContain(`one line for each thing whose own place changed; what went along with it is already recorded by its move. ${NOTATION}`)
        expect(twoRegisters).not.toContain('First check that everything')
        expect(twoRegisters).not.toContain('as short steps')
    })

    it('names the triage formats: all three labels, the default unchanged', () => {
        expect(defaultAnswerFormat).toBe('twoRegisters')
        expect(TRIAGE_LABELS).toEqual(['simple', 'complex', 'impossible'])
        expect(isTriageLabel('complex')).toBe(true)
        expect(isTriageLabel('hard')).toBe(false)
        const { triageLabel, triageReason, triageWhyImpossible } = OPEN_ANSWER_FORMATS
        expect(['triageLabel', 'triageReason', 'triageWhyImpossible'].every(isAnswerFormat)).toBe(true)
        for (const text of [triageLabel, triageReason, triageWhyImpossible]) {
            TRIAGE_LABELS.forEach((label) => expect(text).toContain(`"${label}"`))
            expect(text).not.toContain(NOTATION)
        }
        expect(triageWhyImpossible).toContain('Only if it is "impossible", add one sentence saying why.')
        expect(triageLabel).toContain('Answer with only that one word.')
        expect(triageLabel).not.toContain('reason')
        expect(triageReason).toContain('Give one sentence of reason, then on its own line that one word.')
        expect(prompt(triageReason).endsWith(triageReason)).toBe(true)
    })
})
