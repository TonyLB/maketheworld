import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from './handlePieceProbe'
import { joinParts, registerFamily, registerPiece, type RegistryEntry } from './oraclePiece'

/** A toy piece: a cell's inputs are a word, rendered as a line; an empty word is answered `no` by code. */
const TOY = registerPiece<{ word: string }, { shout: boolean }>({
    name: 'toy',
    answers: ['yes', 'no'],
    cells: {
        A: { inputs: { word: 'apple' }, expected: 'yes', source: 'hand-written' },
        B: { inputs: { word: 'brick' }, expected: 'no', source: 'hand-written' },
        E: { inputs: { word: '' }, expected: 'no', source: 'hand-written', note: 'empty' },
        X: { inputs: { word: 'throw' }, expected: 'yes', source: 'hand-written' },
    },
    parseOptions: (value) => {
        if (value === undefined) {
            return { shout: false }
        }
        return typeof value === 'object' && value !== null && typeof (value as { shout?: unknown }).shout === 'boolean'
            ? { shout: (value as { shout: boolean }).shout }
            : 'options must be { shout: boolean }'
    },
    render: async ({ inputs: { word } }, { shout }) => {
        if (word === 'throw') {
            throw new Error('no such word')
        }
        return `Word: ${shout ? word.toUpperCase() : word}`
    },
    byCode: ({ inputs: { word } }) => (word === '' ? 'no' : undefined),
})
/** A toy read piece: a reply passes when it ends in a fenced json block holding a non-empty string `line`. */
const TOY_READ = registerPiece<{ word: string }, undefined>({
    kind: 'read',
    name: 'toyRead',
    cells: {
        A: { inputs: { word: 'apple' }, lookFor: 'mentions fruit', source: 'hand-written' },
        B: { inputs: { word: 'brick' }, lookFor: 'mentions building', source: 'hand-written' },
    },
    check: (reply, { inputs: { word } }) => {
        const match = reply.trim().match(/```json\n([\s\S]*)\n```$/)
        if (match === null) {
            return ['no json block']
        }
        try {
            const { line } = JSON.parse(match[1])
            return typeof line === 'string' && line.length > 0 ? [] : [`no line for ${word}`]
        } catch {
            return ['the json block does not parse']
        }
    },
    parseOptions: () => undefined,
    render: async ({ inputs: { word } }) => `Word: ${word}`,
})
/** A toy family: a first stage taking `{ loud?: boolean }`, and a second taking `{ from: 'a' | 'b' }`, with no default. */
const FIRST = registerPiece<{ word: string }, { loud: boolean }>({
    kind: 'read',
    name: 'toyFamily first',
    cells: { A: { inputs: { word: 'apple' }, lookFor: 'the first stage', source: 'hand-written' } },
    check: (reply) => (reply.startsWith('first') ? [] : ['not the first stage\'s reply']),
    parseOptions: (value) => {
        const { loud = false, ...rest } = (value ?? {}) as Record<string, unknown>
        return Object.keys(rest).length === 0 && typeof loud === 'boolean' ? { loud } : 'options must be { loud?: boolean }'
    },
    render: async ({ inputs: { word } }, { loud }) => `First: ${loud ? word.toUpperCase() : word}`,
})
const SECOND = registerPiece<{ word: string }, { from: string }>({
    kind: 'read',
    name: 'toyFamily second',
    cells: {
        A: { inputs: { word: 'apple' }, lookFor: 'the second stage', source: 'hand-written' },
        B: { inputs: { word: 'brick' }, lookFor: 'the second stage', source: 'hand-written' },
    },
    check: (reply, _cell, _rendered, { from }) => (reply.startsWith('second') ? (reply.endsWith(from) ? [] : [`not from ${from}`]) : ['not the second stage\'s reply']),
    parseOptions: (value) => {
        const { from, ...rest } = (value ?? {}) as Record<string, unknown>
        return Object.keys(rest).length === 0 && (from === 'a' || from === 'b') ? { from } : "options must be { from: 'a' | 'b' }"
    },
    render: async ({ inputs: { word } }, { from }) => `Second (${from}): ${word}`,
})
/** An answered third stage, graded by its own `grade`, which reads the rendered text and the payload's options: `{ word }`, the answer that counts as yes. */
const THIRD = registerPiece<{ word: string }, { word: string }>({
    name: 'toyFamily third',
    answers: ['yes', 'no'],
    cells: {
        A: { inputs: { word: 'apple' }, expected: 'yes', source: 'hand-written' },
        B: { inputs: { word: 'brick' }, expected: 'no', source: 'hand-written' },
    },
    grade: (reply, { inputs }, rendered, { word }) => (reply.trim() === '' ? { malformed: 'empty' } : { answer: reply.includes(word) && inputs.word === 'apple' && rendered === 'Third: apple' ? 'yes' : 'no' }),
    parseOptions: (value) => {
        const { word, ...rest } = (value ?? {}) as Record<string, unknown>
        return Object.keys(rest).length === 0 && typeof word === 'string' ? { word } : 'options must be { word: string }'
    },
    render: async ({ inputs: { word } }) => `Third: ${word}`,
})
const pieces: Record<string, RegistryEntry> = { toy: TOY, toyRead: TOY_READ, toyFamily: registerFamily('toyFamily', { first: FIRST, second: SECOND, third: THIRD }) }
const INSTRUCTIONS = 'Is the word edible?\nAnswer: yes or Answer: no'

const invokeReplying = (reply: (prompt: string) => string) => jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => ({
    success: true as const, body: reply(messages[0].content?.[0]?.text ?? ''),
}))
const promptOf = (invoke: ReturnType<typeof invokeReplying>, call: number): string => invoke.mock.calls[call][0].messages[0].content?.[0]?.text ?? ''
const body = (response: { body: string }) => JSON.parse(response.body)

describe('handlePieceProbe', () => {
    it('renders each called cell after the instructions, and tallies right, wrong and malformed against its expected answer', async () => {
        const replies = ['Answer: yes', 'Answer: no', 'It is.']
        let next = 0
        const invoke = invokeReplying((prompt) => (prompt.endsWith('apple') ? replies[next++] : 'Answer: no'))
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'toy', cells: ['A', 'B'], instructions: INSTRUCTIONS, repeats: 3 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(6)
        expect([0, 1, 2, 3, 4, 5].map((call) => promptOf(invoke, call)).sort()).toEqual([
            ...Array(3).fill(`${INSTRUCTIONS}\n\nWord: apple`), ...Array(3).fill(`${INSTRUCTIONS}\n\nWord: brick`),
        ])
        const result = body(response)
        expect(result.cells.map(({ inputs, ...tally }: { inputs: unknown }) => tally)).toEqual([
            { cell: 'A', expected: 'yes', n: 3, right: 1, wrong: 1, malformed: 1, errors: 0, answers: { yes: 1, no: 1 } },
            { cell: 'B', expected: 'no', n: 3, right: 3, wrong: 0, malformed: 0, errors: 0, answers: { no: 3 } },
        ])
        expect(result.summary).toEqual({ calls: 6, right: 4, wrong: 1, malformed: 1, errors: 0, byCode: 0, ungraded: 0 })
        expect(result.read.find(({ answer }: { answer: string }) => answer === 'It is.').grade).toEqual({ malformed: 'no Answer line' })
        expect(result.instructions).toEqual({ hash: expect.stringMatching(/^[0-9a-f]{8}$/), chars: INSTRUCTIONS.length })
    })

    it('makes no call for a cell code answers, and reports it as such', async () => {
        const invoke = invokeReplying(() => 'Answer: no')
        const result = body(await handlePieceProbe({ type: 'PieceProbe', piece: 'toy', cells: ['E'], instructions: INSTRUCTIONS, repeats: 3 }, { invoke, pieces }))
        expect(invoke).not.toHaveBeenCalled()
        expect(result.cells[0]).toMatchObject({ cell: 'E', n: 0, right: 0, byCode: { answer: 'no', right: true } })
        expect(result.summary).toEqual({ calls: 0, right: 0, wrong: 0, malformed: 0, errors: 0, byCode: 1, ungraded: 0 })
    })

    describe('a piece with its own grade', () => {
        /** A toy whose grade gives the reply's word and its length, so an answer carries a parameter; a cell with no expected answer is open. */
        const GRADED = registerPiece<{ word: string }, undefined>({
            name: 'graded',
            answers: ['say'],
            cells: {
                A: { inputs: { word: 'apple' }, expected: 'say 5', lookFor: 'a fruit', source: 'hand-written' },
                O: { inputs: { word: 'open' }, lookFor: 'anything', source: 'hand-written' },
            },
            parseOptions: () => undefined,
            render: async ({ inputs: { word } }) => `Word: ${word}`,
            grade: (reply) => (reply === '' ? { malformed: 'empty' } : { answer: `say ${reply.length}` }),
        })
        const ask = (event: Record<string, unknown>, invoke: ReturnType<typeof invokeReplying>) => (
            handlePieceProbe({ type: 'PieceProbe', piece: 'graded', instructions: INSTRUCTIONS, ...event }, { invoke, pieces: { graded: GRADED } })
        )

        it('grades by the piece\'s grade, not the answer set, and carries each cell\'s look-for into its tally', async () => {
            const replies = ['apple', 'pear', '']
            let next = 0
            const invoke = invokeReplying(() => replies[next++])
            const result = body(await ask({ cells: ['A'], repeats: 3 }, invoke))
            expect(result.cells.map(({ inputs, ...tally }: { inputs: unknown }) => tally)).toEqual([
                { cell: 'A', expected: 'say 5', lookFor: 'a fruit', n: 3, right: 1, wrong: 1, malformed: 1, errors: 0, answers: { 'say 5': 1, 'say 4': 1 } },
            ])
            expect(result.summary).toEqual({ calls: 3, right: 1, wrong: 1, malformed: 1, errors: 0, byCode: 0, ungraded: 0 })
        })

        it('tallies a cell with no expected answer without grading it', async () => {
            const result = body(await ask({ cells: ['O'], repeats: 2 }, invokeReplying(() => 'open')))
            expect(result.cells[0]).not.toHaveProperty('expected')
            expect(result.cells[0]).toMatchObject({ cell: 'O', lookFor: 'anything', n: 2, right: 0, wrong: 0, answers: { 'say 4': 2 } })
            expect(result.summary).toEqual({ calls: 2, right: 0, wrong: 0, malformed: 0, errors: 0, byCode: 0, ungraded: 2 })
        })
    })

    it('counts a failed call as an error, not malformed', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async () => ({ success: false as const, errorMessage: 'timeout' }))
        const result = body(await handlePieceProbe({ type: 'PieceProbe', piece: 'toy', cells: ['A'], instructions: INSTRUCTIONS }, { invoke, pieces }))
        expect(result.cells[0]).toMatchObject({ n: 1, errors: 1, malformed: 0 })
        expect(result.read).toEqual([{ cell: 'A', repeat: 1, error: 'timeout' }])
    })

    it('passes the parsed options to the render, and reports them', async () => {
        const invoke = invokeReplying(() => 'Answer: yes')
        const result = body(await handlePieceProbe({ type: 'PieceProbe', piece: 'toy', cells: ['A'], instructions: INSTRUCTIONS, options: { shout: true } }, { invoke, pieces }))
        expect(promptOf(invoke, 0)).toBe(`${INSTRUCTIONS}\n\nWord: APPLE`)
        expect(result.options).toEqual({ shout: true })
    })

    it('gives stable hashes of the instructions and each cell\'s rendered inputs', async () => {
        const run = async () => body(await handlePieceProbe({ type: 'PieceProbe', piece: 'toy', cells: ['A', 'B'], instructions: INSTRUCTIONS }, { invoke: invokeReplying(() => 'Answer: yes'), pieces }))
        const [first, second] = [await run(), await run()]
        expect(second.instructions.hash).toBe(first.instructions.hash)
        expect(second.cells.map(({ inputs }: { inputs: { hash: string } }) => inputs.hash)).toEqual(first.cells.map(({ inputs }: { inputs: { hash: string } }) => inputs.hash))
        expect(first.cells[0].inputs.hash).not.toBe(first.cells[1].inputs.hash)
    })

    it('asks all of the piece\'s cells when none are named', async () => {
        const invoke = invokeReplying(() => 'Answer: yes')
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'toy', instructions: INSTRUCTIONS }, {
            invoke, pieces: { toy: { ...TOY, cells: { A: TOY.cells.A, B: TOY.cells.B, E: TOY.cells.E } } },
        })
        expect(body(response).cells.map(({ cell }: { cell: string }) => cell)).toEqual(['A', 'B', 'E'])
        expect(invoke).toHaveBeenCalledTimes(2)
    })

    it.each([
        [{ piece: 'ruleCel', instructions: INSTRUCTIONS }, /piece must be one of: toy/],
        [{ piece: 'toy', cells: ['Z'], instructions: INSTRUCTIONS }, /cells must be a non-empty list of toy's cell IDs: A, B, E, X/],
        [{ piece: 'toy', cells: [], instructions: INSTRUCTIONS }, /cells must be a non-empty list/],
        [{ piece: 'toy', cells: ['A'] }, /instructions must be a draft/],
        [{ piece: 'toy', cells: ['A'], instructions: INSTRUCTIONS, repeats: 0 }, /repeats must be an integer/],
        [{ piece: 'toy', cells: ['A'], instructions: INSTRUCTIONS, model: 'Claude' }, /model must be a NovaModel/],
        [{ piece: 'toy', cells: ['A'], instructions: INSTRUCTIONS, options: { shout: 'loud' } }, /options must be \{ shout: boolean \}/],
        [{ piece: 'toy', cells: ['A', 'B'], instructions: INSTRUCTIONS, repeats: 13 }, /2 called cells x 13 repeats = 26 calls, over the cap of 24/],
        [{ piece: 'toy', cells: ['A', 'X'], instructions: INSTRUCTIONS }, /cell X: the render failed \(no such word\)/],
    ])('refuses %j before any call', async (event, error) => {
        const invoke = invokeReplying(() => 'Answer: yes')
        const response = await handlePieceProbe({ type: 'PieceProbe', ...event }, { invoke, pieces })
        expect(response.statusCode).toBe(400)
        expect(body(response).error).toMatch(error)
        expect(invoke).not.toHaveBeenCalled()
    })

    it('leaves cells code answers out of the cap', async () => {
        const invoke = invokeReplying(() => 'Answer: yes')
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'toy', cells: ['A', 'E'], instructions: INSTRUCTIONS, repeats: 24 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(24)
    })

    it('says when no piece is registered', async () => {
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'toy', instructions: INSTRUCTIONS }, { pieces: {} })
        expect(body(response).error).toBe('piece must be one of: (none registered)')
    })

    describe('a read piece', () => {
        const GOOD = 'Thinking.\n```json\n{ "line": "falls" }\n```'
        const ask = (event: Record<string, unknown>, invoke: ReturnType<typeof invokeReplying>) => (
            handlePieceProbe({ type: 'PieceProbe', piece: 'toyRead', instructions: INSTRUCTIONS, ...event }, { invoke, pieces })
        )

        it('checks each reply\'s form, tallies it per cell with its look-for, and groups the replies by cell', async () => {
            const replies = [GOOD, 'no block here', '```json\n{ "line": "" }\n```']
            let next = 0
            const invoke = invokeReplying((prompt) => (prompt.endsWith('apple') ? replies[next++] : GOOD))
            const response = await ask({ repeats: 3 }, invoke)
            expect(response.statusCode).toBe(200)
            const result = body(response)
            expect(invoke).toHaveBeenCalledTimes(6)
            expect(promptOf(invoke, 0)).toBe(`${INSTRUCTIONS}\n\nWord: apple`)
            expect(result.cells.map(({ inputs, ...tally }: { inputs: unknown }) => tally)).toEqual([
                { cell: 'A', lookFor: 'mentions fruit', n: 3, formPasses: 1, formFails: 2, failures: expect.any(Array), errors: 0 },
                { cell: 'B', lookFor: 'mentions building', n: 3, formPasses: 3, formFails: 0, failures: [], errors: 0 },
            ])
            expect(result.cells[0].failures.map(({ problems }: { problems: string[] }) => problems).sort()).toEqual([['no json block'], ['no line for apple']])
            expect(result.summary).toEqual({ calls: 6, formFails: 2, errors: 0 })
            expect(result.read.map(({ cell, lookFor, replies }: { cell: string; lookFor: string; replies: unknown[] }) => [cell, lookFor, replies.length])).toEqual([
                ['A', 'mentions fruit', 3], ['B', 'mentions building', 3],
            ])
            expect(result.read[0].replies.map(({ repeat }: { repeat: number }) => repeat)).toEqual([1, 2, 3])
            expect(result.read[0].replies.find(({ reply }: { reply: string }) => reply === 'no block here')).toEqual({ repeat: expect.any(Number), reply: 'no block here', problems: ['no json block'] })
            expect(result.read[1].replies[0]).toEqual({ repeat: 1, reply: GOOD, problems: [] })
        })

        it('hands the check each cell\'s rendered text and the options, so it can match quotes against what the prompt showed', async () => {
            const check = jest.spyOn(TOY_READ, 'check')
            await ask({ cells: ['B'] }, invokeReplying(() => GOOD))
            expect(check).toHaveBeenCalledWith(GOOD, TOY_READ.cells.B, 'Word: brick', undefined)
        })

        it('counts a failed call as an error, not a form fail', async () => {
            const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async () => ({ success: false as const, errorMessage: 'timeout' }))
            const result = body(await ask({ cells: ['A'] }, invoke))
            expect(result.cells[0]).toMatchObject({ n: 1, formPasses: 0, formFails: 0, errors: 1 })
            expect(result.summary).toEqual({ calls: 1, formFails: 0, errors: 1 })
            expect(result.read).toEqual([{ cell: 'A', lookFor: 'mentions fruit', replies: [{ repeat: 1, error: 'timeout' }] }])
        })

        it('gives stable hashes of the instructions and each cell\'s rendered inputs', async () => {
            const run = async () => body(await ask({}, invokeReplying(() => GOOD)))
            const [first, second] = [await run(), await run()]
            expect(second.instructions).toEqual(first.instructions)
            expect(second.cells.map(({ inputs }: { inputs: { hash: string } }) => inputs.hash)).toEqual(first.cells.map(({ inputs }: { inputs: { hash: string } }) => inputs.hash))
            expect(first.cells[0].inputs.hash).not.toBe(first.cells[1].inputs.hash)
        })

        it('shares the refusals and the cap: every called cell counts', async () => {
            const invoke = invokeReplying(() => GOOD)
            const over = await ask({ repeats: 13 }, invoke)
            expect(over.statusCode).toBe(400)
            expect(body(over).error).toMatch(/2 called cells x 13 repeats = 26 calls, over the cap of 24/)
            const unknown = await ask({ cells: ['Z'] }, invoke)
            expect(body(unknown).error).toMatch(/cells must be a non-empty list of toyRead's cell IDs: A, B/)
            expect(invoke).not.toHaveBeenCalled()
        })
    })

    describe('a family', () => {
        const ask = (event: Record<string, unknown>, invoke: ReturnType<typeof invokeReplying>) => (
            handlePieceProbe({ type: 'PieceProbe', piece: 'toyFamily', instructions: INSTRUCTIONS, ...event }, { invoke, pieces })
        )

        it('runs the stage options.stage names, with its render, check and cells, and names the family and stage in the response', async () => {
            const invoke = invokeReplying(() => 'second, it says b')
            const response = await ask({ options: { stage: 'second', from: 'b' } }, invoke)
            expect(response.statusCode).toBe(200)
            const result = body(response)
            expect(invoke).toHaveBeenCalledTimes(2)
            expect(promptOf(invoke, 0)).toBe(`${INSTRUCTIONS}\n\nSecond (b): apple`)
            expect(result).toMatchObject({ piece: 'toyFamily', stage: 'second', options: { from: 'b' } })
            expect(result.summary).toEqual({ calls: 2, formFails: 0, errors: 0 })
        })

        it('hands the rest of the options to the stage, whose defaults and refusals are its own', async () => {
            const invoke = invokeReplying(() => 'first')
            const first = body(await ask({ options: { stage: 'first' } }, invoke))
            expect(first).toMatchObject({ stage: 'first', options: { loud: false } })
            expect(promptOf(invoke, 0)).toBe(`${INSTRUCTIONS}\n\nFirst: apple`)
            expect(body(await ask({ options: { stage: 'first', from: 'a' } }, invoke)).error).toBe('options must be { loud?: boolean }')
            expect(body(await ask({ options: { stage: 'second' } }, invoke)).error).toBe("options must be { from: 'a' | 'b' }")
            expect(invoke).toHaveBeenCalledTimes(1)
        })

        it.each([
            [undefined],
            [{}],
            [{ stage: 'fourth' }],
            [{ stage: 1 }],
            ['first'],
        ])('refuses a missing or unknown stage, naming the stages: %j', async (options) => {
            const invoke = invokeReplying(() => 'first')
            const response = await ask({ options }, invoke)
            expect(response.statusCode).toBe(400)
            expect(body(response).error).toBe('toyFamily is a family: options.stage must be one of: first, second, third')
            expect(invoke).not.toHaveBeenCalled()
        })

        it('hands the payload\'s options to a read stage\'s check', async () => {
            const invoke = invokeReplying(() => 'second, from a')
            const result = body(await ask({ options: { stage: 'second', from: 'b' } }, invoke))
            expect(result.summary).toEqual({ calls: 2, formFails: 2, errors: 0 })
            expect(result.cells[0].failures).toEqual([{ repeat: 1, problems: ['not from b'] }])
        })

        it('runs an answered stage, graded by its own grade with the rendered text and the payload\'s options, and tallied against each cell\'s expected answer', async () => {
            const invoke = invokeReplying(() => 'it says pear')
            const response = await ask({ options: { stage: 'third', word: 'pear' } }, invoke)
            expect(response.statusCode).toBe(200)
            const result = body(response)
            expect(promptOf(invoke, 0)).toMatch(/Third: (apple|brick)$/)
            expect(result).toMatchObject({ piece: 'toyFamily', stage: 'third', options: { word: 'pear' } })
            expect(result.summary).toMatchObject({ calls: 2, right: 2, wrong: 0, malformed: 0 })
            const elsewhere = body(await ask({ options: { stage: 'third', word: 'plum' } }, invokeReplying(() => 'it says pear')))
            expect(elsewhere.summary).toMatchObject({ right: 1, wrong: 1 })
        })

        it('shares the refusals and the cap, on the stage\'s cells', async () => {
            const invoke = invokeReplying(() => 'second')
            expect(body(await ask({ options: { stage: 'second', from: 'a' }, repeats: 13 }, invoke)).error).toMatch(/2 called cells x 13 repeats = 26 calls, over the cap of 24/)
            expect(body(await ask({ options: { stage: 'first' }, cells: ['B'] }, invoke)).error).toMatch(/cells must be a non-empty list of toyFamily first's cell IDs: A/)
            expect(invoke).not.toHaveBeenCalled()
        })
    })

    describe('delivery', () => {
        /** A toy whose render is built as two parts in code: the scene for the system part, the question for the user part. */
        const PARTS = ({ inputs: { word } }: { inputs: { word: string } }) => ({ system: `Scene: ${word}`, user: `Question: ${word}?` })
        const SPLIT = registerPiece<{ word: string }, undefined>({
            name: 'split',
            answers: ['yes', 'no'],
            cells: {
                A: { inputs: { word: 'apple' }, expected: 'yes', source: 'hand-written' },
                B: { inputs: { word: 'brick' }, expected: 'no', source: 'hand-written' },
            },
            parseOptions: () => undefined,
            render: async (cell) => joinParts(PARTS(cell)),
            renderParts: async (cell) => PARTS(cell),
        })
        const SPLIT_READ = registerPiece<{ word: string }, undefined>({
            kind: 'read',
            name: 'splitRead',
            cells: { A: { inputs: { word: 'apple' }, lookFor: 'mentions fruit', source: 'hand-written' } },
            check: () => [],
            parseOptions: () => undefined,
            render: async (cell) => joinParts(PARTS(cell)),
            renderParts: async (cell) => PARTS(cell),
        })
        const withSplit: Record<string, RegistryEntry> = { ...pieces, split: SPLIT, splitRead: SPLIT_READ }
        const paramsOf = (invoke: ReturnType<typeof invokeReplying>, call: number) => invoke.mock.calls[call][0]

        it('sends the instructions and the system part as system instructions, and the user part as the user message, under system delivery', async () => {
            const invoke = invokeReplying(() => 'Answer: yes')
            const result = body(await handlePieceProbe({ type: 'PieceProbe', piece: 'split', cells: ['A'], instructions: INSTRUCTIONS, delivery: 'system' }, { invoke, pieces: withSplit }))
            expect(paramsOf(invoke, 0).system).toBe(`${INSTRUCTIONS}\n\nScene: apple`)
            expect(promptOf(invoke, 0)).toBe('Question: apple?')
            expect(result.delivery).toBe('system')
            expect(result.summary).toMatchObject({ calls: 1, right: 1 })
        })

        it('sends one user message with no system instructions by default, the instructions then the parts joined', async () => {
            const invoke = invokeReplying(() => 'Answer: yes')
            const result = body(await handlePieceProbe({ type: 'PieceProbe', piece: 'split', cells: ['A'], instructions: INSTRUCTIONS }, { invoke, pieces: withSplit }))
            expect('system' in paramsOf(invoke, 0)).toBe(false)
            expect(promptOf(invoke, 0)).toBe(`${INSTRUCTIONS}\n\nScene: apple\n\nQuestion: apple?`)
            expect(result.delivery).toBe('user')
        })

        it('gives the same inputs hashes under both deliveries, since the text is the same', async () => {
            const run = async (delivery: string) => body(await handlePieceProbe(
                { type: 'PieceProbe', piece: 'split', cells: ['A', 'B'], instructions: INSTRUCTIONS, delivery }, { invoke: invokeReplying(() => 'Answer: yes'), pieces: withSplit },
            ))
            const hashes = (result: { cells: { inputs: { hash: string } }[] }) => result.cells.map(({ inputs }) => inputs.hash)
            expect(hashes(await run('system'))).toEqual(hashes(await run('user')))
        })

        it('delivers a read piece\'s parts the same way, and reports the delivery', async () => {
            const invoke = invokeReplying(() => 'fine')
            const result = body(await handlePieceProbe({ type: 'PieceProbe', piece: 'splitRead', instructions: INSTRUCTIONS, delivery: 'system' }, { invoke, pieces: withSplit }))
            expect(paramsOf(invoke, 0).system).toBe(`${INSTRUCTIONS}\n\nScene: apple`)
            expect(promptOf(invoke, 0)).toBe('Question: apple?')
            expect(result.delivery).toBe('system')
        })

        it.each([
            [{ piece: 'toy', cells: ['A'], delivery: 'system' }, /delivery system needs a piece that renders its two parts: toy has no renderParts/],
            [{ piece: 'toyRead', delivery: 'system' }, /toyRead has no renderParts/],
            [{ piece: 'toyFamily', options: { stage: 'first' }, delivery: 'system' }, /toyFamily's first stage has no renderParts/],
            [{ piece: 'split', delivery: 'assistant' }, /delivery must be user or system/],
        ])('refuses %j before any call', async (event, error) => {
            const invoke = invokeReplying(() => 'Answer: yes')
            const response = await handlePieceProbe({ type: 'PieceProbe', instructions: INSTRUCTIONS, ...event }, { invoke, pieces: withSplit })
            expect(response.statusCode).toBe(400)
            expect(body(response).error).toMatch(error)
            expect(invoke).not.toHaveBeenCalled()
        })
    })
})
