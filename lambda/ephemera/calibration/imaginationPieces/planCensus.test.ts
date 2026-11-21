import { censusCounts, censusText, readGroups, readReply } from './planCensus'

const fenced = (value: unknown, reasoning = ''): string => `${reasoning}${reasoning === '' ? '' : '\n\n'}\`\`\`json\n${JSON.stringify(value)}\n\`\`\``

const grip = { says: 'grip [table1] by its edge', intent: '[table1] is held firmly' }
const lift = { says: 'lift [table1] off the floor', intent: '[table1] is lifted' }
const saucerCarry = { says: '[saucer1] moves with [table1]', thing: '[saucer1]' }
const teapotCauses = { says: '[teapot1] moves with [table1]', thing: '[teapot1]', rules: [{ rule: '[teapot-secured-to-table]', stance: 'causes' }] }
const pull = { says: '[table1] pulls against its chain to [wall1]', thing: '[table1]', rules: [{ rule: '[table-secured-to-wall]', stance: 'violation' }] }

const expansion = (steps: unknown[]) => ({ says: 'pick up [table1]', intent: 'pick up [table1]', steps })

describe('readReply', () => {
    it('reads a reply with no JSON as unparsed', () => {
        expect(readReply('OC-1', 1, 'I would lift the table.')).toEqual({ cell: 'OC-1', repeat: 1, parsed: false })
    })

    it('reads a malformed JSON block as unparsed', () => {
        expect(readReply('OC-1', 1, '```json\n{"says": \n```')).toEqual({ cell: 'OC-1', repeat: 1, parsed: false })
    })

    it('reads sub-steps and consequences, marking those on the thing being handled', () => {
        const read = readReply('OC-1', 2, fenced(expansion([{ ...grip, consequences: [{ says: '[table1] is ready', thing: '[table1]' }] }, { ...lift, consequences: [saucerCarry, teapotCauses] }])))
        expect(read).toMatchObject({
            parsed: true,
            reasoning: '',
            steps: [
                { says: grip.says, consequences: [{ says: '[table1] is ready', onHandled: true, stances: [] }], agreement: 'absent' },
                { says: lift.says, consequences: [{ onHandled: false, stances: [] }, { onHandled: false, stances: ['causes'] }], agreement: 'absent' },
            ],
            consequences: [],
            stepAgreement: 'absent',
            stanceAgreement: 'absent',
        })
    })

    it('reads a consequence whose thing is unbracketed as not on the handled thing', () => {
        const read = readReply('OC-1', 1, fenced(expansion([{ ...grip, consequences: [{ says: 'the table is held', thing: 'table1' }] }, lift])))
        expect(read.parsed && read.steps[0].consequences[0].onHandled).toBe(false)
    })

    it('reads the step as the answer, with its own consequences', () => {
        const read = readReply('OC-1b', 1, fenced({ says: grip.says, intent: grip.intent, consequences: [saucerCarry] }, '- The step, as written: grip [table1] by its edge. It states how [table1] is held, so it is the answer.'))
        expect(read).toMatchObject({ parsed: true, steps: [], consequences: [{ says: saucerCarry.says }], stepAgreement: 'agrees', stanceAgreement: 'absent' })
    })

    it('agrees when the reasoning decides what the JSON does', () => {
        const reasoning = [
            '- The step, as written: pick up [table1]. It doesn\'t state how [table1] is held and lifted, so it is broken down.',
            '- grip [table1] by its edge: nothing.',
            '- lift [table1] off the floor: [table1] pulls against its chain to [wall1]. It goes against rule [table-secured-to-wall]: violation.',
        ].join('\n')
        const read = readReply('OC-20', 1, fenced(expansion([grip, { ...lift, consequences: [pull] }]), reasoning))
        expect(read).toMatchObject({ steps: [{ agreement: 'agrees' }, { agreement: 'agrees' }], stepAgreement: 'agrees', stanceAgreement: 'agrees' })
    })

    it('disagrees when a sub-step answered "nothing" carries a consequence, or one with something carries none', () => {
        const reasoning = '- grip [table1] by its edge: nothing.\n- lift [table1] off the floor: [saucer1] moves with [table1].'
        const read = readReply('OC-1', 1, fenced(expansion([{ ...grip, consequences: [saucerCarry] }, lift]), reasoning))
        expect(read.parsed && read.steps.map(({ agreement }) => agreement)).toEqual(['disagrees', 'disagrees'])
    })

    it('disagrees when the reasoning names a stance the JSON does not carry', () => {
        const reasoning = '- lift [table1] off the floor: [teapot1] moves with [table1]. Rule [teapot-secured-to-table]: causes.'
        const read = readReply('OC-1', 1, fenced(expansion([grip, { ...lift, consequences: [{ ...teapotCauses, rules: [{ rule: '[teapot-secured-to-table]', stance: 'violation' }] }] }]), reasoning))
        expect(read.parsed && read.stanceAgreement).toBe('disagrees')
    })

    it('marks a consequence that restates its step\'s intent, held in it or holding it, apart from case, brackets and punctuation', () => {
        const read = readReply('OC-20', 1, fenced(expansion([
            { ...grip, consequences: [{ says: '[Table1] is held firmly.', thing: '[table1]' }] },
            { ...lift, consequences: [{ says: '[table1] is lifted off the floor', thing: '[table1]' }, saucerCarry] },
        ])))
        expect(read.parsed && read.steps.flatMap(({ consequences }) => consequences.map(({ restatesIntent }) => restatesIntent))).toEqual([true, true, false])
    })

    it('marks a record-level consequence against the record\'s intent', () => {
        const read = readReply('OC-1b', 1, fenced({ says: grip.says, intent: '[table1] is held firmly', consequences: [{ says: '[table1] is held firmly', thing: '[table1]' }] }))
        expect(read.parsed && read.consequences[0].restatesIntent).toBe(true)
    })

    it('reads a sub-step line that gives the intent first by its answer after "beyond that"', () => {
        const reasoning = '- grip [table1] by its edge: [table1] is held firmly; beyond that, nothing.\n- lift [table1] off the floor: [table1] is lifted; beyond that, [saucer1] slides. No rule.'
        const read = readReply('OC-1', 1, fenced(expansion([grip, { ...lift, consequences: [saucerCarry] }]), reasoning))
        expect(read.parsed && read.steps.map(({ agreement }) => agreement)).toEqual(['agrees', 'agrees'])
    })

    it('reads stances worded freely, one per line that names a rule', () => {
        const reasoning = [
            '- grip [table1] by its edge: nothing.',
            '- lift [table1] off the floor: [table1] pulls against its chain. Rule [table-secured-to-wall] is violated.',
        ].join('\n')
        const read = readReply('OC-20', 1, fenced(expansion([grip, { ...lift, consequences: [pull] }]), reasoning))
        expect(read.parsed && read.stanceAgreement).toBe('agrees')
    })

    it('reads a pasted phrase by its last stance word, and "No rule" as none', () => {
        const pasted = '- lift [table1] off the floor: [table1] pulls against its chain. Rule [table-secured-to-wall] makes it happen where it ordinarily wouldn\'t: violation.'
        const noRule = '- grip [table1] by its edge: [table1] is held. Rule [table-secured-to-wall] keeps it near [wall1]. No rule.'
        const read = readReply('OC-20', 1, fenced(expansion([{ ...grip, consequences: [{ says: '[table1] is held', thing: '[table1]' }] }, { ...lift, consequences: [pull] }]), `${noRule}\n${pasted}`))
        expect(read.parsed && read.stanceAgreement).toBe('agrees')
    })

    it('ignores a stance word on a line that names no rule', () => {
        const read = readReply('OC-1', 1, fenced(expansion([grip, lift]), '- lift [table1] off the floor: the motion causes [saucer1] to slide.'))
        expect(read.parsed && read.stanceAgreement).toBe('absent')
    })

    it('disagrees when the step line says broken down but the reply has one sub-step', () => {
        const read = readReply('OC-20', 1, fenced(expansion([grip]), '- The step, as written: pick up [table1]. It is broken down.'))
        expect(read.parsed && read.stepAgreement).toBe('disagrees')
    })

    it('matches a sub-step line case-insensitively, without its list marker', () => {
        const read = readReply('OC-1', 1, fenced(expansion([grip, lift]), '* Grip [table1] by its edge: Nothing\n- lift [table1] off the floor: nothing'))
        expect(read.parsed && read.steps.map(({ agreement }) => agreement)).toEqual(['agrees', 'agrees'])
    })
})

describe('censusCounts', () => {
    const reads = readGroups([
        {
            cell: 'OC-1',
            lookFor: '',
            replies: [
                { repeat: 1, reply: fenced(expansion([{ ...grip, consequences: [teapotCauses] }, { ...lift, consequences: [saucerCarry] }]), '- grip [table1] by its edge: [teapot1] moves with [table1]: causes.') },
                { repeat: 2, reply: fenced(expansion([grip, lift])) },
                { repeat: 3, error: 'throttled' },
            ],
        },
        { cell: 'OC-20', lookFor: '', replies: [{ repeat: 1, reply: fenced(expansion([{ ...grip, consequences: [pull] }])) }, { repeat: 2, reply: 'no json' }] },
    ])

    it('skips errored calls and counts unparsed replies', () => {
        expect(reads).toHaveLength(4)
        expect(censusCounts(reads)).toMatchObject({ replies: 4, parsed: 3, withReasoning: 1, oneEntrySteps: 1 })
    })

    it('counts the slots: first and later sub-steps, consequences, the handled thing, rules and stances', () => {
        expect(censusCounts(reads)).toMatchObject({
            firstSubSteps: 3,
            firstWithConsequence: 2,
            laterSubSteps: 2,
            laterWithConsequence: 1,
            consequences: 3,
            onHandled: 1,
            withRule: 2,
            stances: { causes: 1, violation: 1 },
        })
    })

    it('counts the agreements', () => {
        expect(censusCounts(reads)).toMatchObject({
            subStepAgreement: { agrees: 1, disagrees: 0, absent: 4 },
            stepAgreement: { agrees: 0, disagrees: 0, absent: 3 },
            stanceAgreement: { agrees: 1, disagrees: 0, absent: 2 },
        })
    })
})

describe('censusText', () => {
    const reads = readGroups([{ cell: 'OC-1', lookFor: '', replies: [{ repeat: 1, reply: fenced(expansion([grip, { ...lift, consequences: [teapotCauses] }])) }] }])

    it('gives the totals and each cell', () => {
        const text = censusText(reads)
        expect(text).toContain('## All cells')
        expect(text).toContain('## OC-1')
        expect(text).toContain('first sub-steps with a consequence 0 of 1; later 1 of 1')
        expect(text).toContain('consequences 1: on the handled thing 0, restating their step\'s intent 0, carrying a rule 1 (causes 1)')
        expect(text).not.toContain('->')
    })

    it('lists each reply\'s consequences with --list', () => {
        expect(censusText(reads, { list: true })).toContain('    s2 [lift [table1] off the floor] -> [teapot1] moves with [table1]  [causes]')
    })
})
