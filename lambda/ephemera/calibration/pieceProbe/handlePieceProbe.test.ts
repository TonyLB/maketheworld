import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from './handlePieceProbe'
import { registerPiece, type RegisteredPiece } from './oraclePiece'

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
const pieces: Record<string, RegisteredPiece> = { toy: TOY, toyRead: TOY_READ }
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
        expect(result.summary).toEqual({ calls: 6, right: 4, wrong: 1, malformed: 1, errors: 0, byCode: 0 })
        expect(result.read.find(({ answer }: { answer: string }) => answer === 'It is.').grade).toEqual({ malformed: 'no Answer line' })
        expect(result.instructions).toEqual({ hash: expect.stringMatching(/^[0-9a-f]{8}$/), chars: INSTRUCTIONS.length })
    })

    it('makes no call for a cell code answers, and reports it as such', async () => {
        const invoke = invokeReplying(() => 'Answer: no')
        const result = body(await handlePieceProbe({ type: 'PieceProbe', piece: 'toy', cells: ['E'], instructions: INSTRUCTIONS, repeats: 3 }, { invoke, pieces }))
        expect(invoke).not.toHaveBeenCalled()
        expect(result.cells[0]).toMatchObject({ cell: 'E', n: 0, right: 0, byCode: { answer: 'no', right: true } })
        expect(result.summary).toEqual({ calls: 0, right: 0, wrong: 0, malformed: 0, errors: 0, byCode: 1 })
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
})
