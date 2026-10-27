import type { ObjectSpanToken, ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import { defineAttemptTemplate, fixedWord, words, type AttemptTemplate, type PatternElement } from './deterministicTemplate'
import { granulesOf, tokenize } from './granuleTokens'
import type { PatternFill } from './patternTemplate'
import { fixedWordsOf, matchPatternFills } from './patternTemplate'
import { CommandAttempt } from '../commandAttempt'
import { containmentTemplate } from '../enrich/objectManipulation/plan/matchContainmentTemplate'
import { lookAtTemplate, lookTemplate } from '../enrich/objectManipulation/plan/matchLookTemplate'
import { membershipTemplate } from '../enrich/objectManipulation/plan/matchMembershipTemplate'
import { spreadTemplate } from '../enrich/objectManipulation/plan/matchSpreadTemplate'
import { COMMAND_GRANULES, readPlanTemplates } from '../enrich/objectManipulation/plan/planSkeleton'

const ON_PREPOSITIONS = { 'on top of': 'on top of', on: 'on', off: 'off' } as const

/** Every fill of a pattern over a command, the command cut at the pattern's own fixed words. */
const fillsOf = (pattern: readonly PatternElement[], command: string, granuleOptions: readonly string[] = fixedWordsOf(pattern)): PatternFill[] => (
    matchPatternFills(pattern, tokenize(granulesOf(granuleOptions), command))
)

/** A flat fill's pieces, fixed words and spans alike. */
const captureTexts = (fill: PatternFill) => fill.segmentation.map((token) => (token.type === 'objectSpan' ? token.span : token.text))

/** A segmentation as one line: spans bracketed, fixed words bare. */
const segmentationLine = ({ segmentation }: PatternFill): string => (
    segmentation.map((token) => (token.type === 'objectSpan' ? `[${token.span}]` : token.text)).join(' ')
)

/** A reading as one line: each span with its qualifier nested in parentheses. */
const readingLine = ({ reading }: { reading: ParseSkeleton }): string => {
    const spanLine = (token: ObjectSpanToken): string => (
        token.qualifier === undefined ? token.span : `${token.span} (${token.qualifier.preposition} ${spanLine(token.qualifier.span)})`
    )
    return reading.map((token) => (token.type === 'objectSpan' ? `[${spanLine(token)}]` : token.text)).join(' ')
}

describe('matchPatternFills', () => {
    it('matches a pure templateText pattern case-insensitively', () => {
        const pattern: PatternElement[] = [words('look', 'l')]
        expect(fillsOf(pattern, 'Look')).toHaveLength(1)
        expect(fillsOf(pattern, 'l')).toHaveLength(1)
    })

    it('rejects near-miss text outside the closed vocabulary (anchoring proof)', () => {
        const pattern: PatternElement[] = [words('look', 'l')]
        expect(fillsOf(pattern, 'looks')).toEqual([])
        expect(fillsOf(pattern, 'lookout')).toEqual([])
        expect(fillsOf(pattern, 'look around')).toEqual([])
    })

    it('captures an objectSpan slot, with its key', () => {
        const pattern: PatternElement[] = [
            words('take'),
            { type: 'objectSpan', name: 'subject' },
        ]
        const [fill, ...rest] = fillsOf(pattern, 'take red ball')
        expect(rest).toEqual([])
        expect(fill.captures).toEqual({ subject: { kind: 'objectSpan', text: 'red ball', stableRefKey: 'redBallRef' } })
    })

    it('captures a capturedText slot', () => {
        const pattern: PatternElement[] = [
            words('relate'),
            { type: 'capturedText', name: 'relationLabel' },
        ]
        const [fill, ...rest] = fillsOf(pattern, 'relate atop')
        expect(rest).toEqual([])
        expect(fill.captures).toEqual({ relationLabel: { kind: 'capturedText', text: 'atop' } })
    })

    it('bounds objectSpan captures between fixed text (does not overrun)', () => {
        const pattern: PatternElement[] = [
            words('put'),
            { type: 'objectSpan', name: 'subject' },
            words('on'),
            { type: 'objectSpan', name: 'target' },
        ]
        expect(fillsOf(pattern, 'put red bag on small table').map(captureTexts)).toEqual([['put', 'red bag', 'on', 'small table']])
    })

    it('returns no fill for wrong vocabulary, trailing tokens, and empty input', () => {
        const pattern: PatternElement[] = [words('help')]
        expect(fillsOf(pattern, 'assist')).toEqual([])
        expect(fillsOf(pattern, 'help me')).toEqual([])
        expect(fillsOf(pattern, '')).toEqual([])
    })

    it('returns every fill: a fixed word may sit inside a span in one fill and be the fixed word in another', () => {
        const pattern: PatternElement[] = [
            words('take'),
            { type: 'objectSpan', name: 'subject' },
            words('on'),
            { type: 'objectSpan', name: 'target' },
        ]
        const fills = fillsOf(pattern, 'take cup on saucer on table')
        expect(fills.map(captureTexts)).toEqual(expect.arrayContaining([
            ['take', 'cup', 'on', 'saucer on table'],
            ['take', 'cup on saucer', 'on', 'table'],
        ]))
        expect(fills).toHaveLength(2)
    })

    it('a phrase option fills only where the text holds the phrase; its prefix option fills too', () => {
        const pattern: PatternElement[] = [
            words('put'),
            { type: 'objectSpan', name: 'subject' },
            words('on', 'on top of'),
            { type: 'objectSpan', name: 'target' },
        ]
        const phraseFills = fillsOf(pattern, 'put cup on top of table')
        expect(phraseFills.map(captureTexts)).toEqual(expect.arrayContaining([
            ['put', 'cup', 'on top of', 'table'],
            ['put', 'cup', 'on', 'top of table'],
        ]))
        expect(phraseFills).toHaveLength(2)
        expect(fillsOf(pattern, 'put cup on table').map(captureTexts)).toEqual([['put', 'cup', 'on', 'table']])
    })

    it('matches a fixed word only as a whole word: "on" inside "onion" or "onto" is no fill', () => {
        const pattern: PatternElement[] = [
            words('take'),
            { type: 'objectSpan', name: 'subject' },
            words('on'),
            { type: 'objectSpan', name: 'target' },
        ]
        expect(fillsOf(pattern, 'take onion on table').map(captureTexts)).toEqual([['take', 'onion', 'on', 'table']])
        expect(fillsOf(pattern, 'take onion table')).toEqual([])
        expect(fillsOf(pattern, 'take cup onto table')).toEqual([])
    })

    it('ignores case and collapses spacing, keeping the words as typed', () => {
        const pattern: PatternElement[] = [
            words('put'),
            { type: 'objectSpan', name: 'subject' },
            words('on top of'),
            { type: 'objectSpan', name: 'target' },
        ]
        expect(fillsOf(pattern, '  Put  Red   Cup ON  top OF table ').map(captureTexts))
            .toEqual([['Put', 'Red Cup', 'ON top OF', 'table']])
    })

    it('builds no fill twice: options with the same words are one', () => {
        const pattern: PatternElement[] = [
            fixedWord('verb', { take: 'first', TAKE: 'second' }),
            { type: 'objectSpan', name: 'subject' },
        ]
        const fills = fillsOf(pattern, 'take cup')
        expect(fills).toHaveLength(1)
        expect(fills[0].captures.verb).toEqual({ kind: 'templateText', text: 'take', option: 'take', value: 'first' })
    })

    it('captures a named fixed word with its lexicon value, and an unnamed one not at all', () => {
        const pattern: PatternElement[] = [
            fixedWord('verb', { put: { form: 'puts' } }),
            { type: 'objectSpan', name: 'subject' },
            words('on'),
            { type: 'objectSpan', name: 'target' },
        ]
        const [fill] = fillsOf(pattern, 'Put cup on table')
        expect(Object.keys(fill.captures).sort()).toEqual(['subject', 'target', 'verb'])
        expect(fill.captures.verb).toEqual({ kind: 'templateText', text: 'Put', option: 'put', value: { form: 'puts' } })
    })

    it('adjacent wildcards yield every split', () => {
        const pattern: PatternElement[] = [
            { type: 'objectSpan', name: 'subject' },
            { type: 'objectSpan', name: 'target' },
        ]
        const granuleOptions = ['red', 'cup', 'box']
        expect(fillsOf(pattern, 'red cup box', granuleOptions).map(captureTexts)).toEqual(expect.arrayContaining([
            ['red', 'cup box'],
            ['red cup', 'box'],
        ]))
        expect(fillsOf(pattern, 'red cup box', granuleOptions)).toHaveLength(2)
    })

    describe('a span merges across any token', () => {
        const lookPatterns = [lookTemplate.pattern, lookAtTemplate.pattern]
        const options = lookPatterns.flatMap(fixedWordsOf)

        it('across a template\'s own fixed word: the plain look reads "at cup" as its span', () => {
            expect(lookPatterns.flatMap((pattern) => fillsOf(pattern, 'look at cup', options)).map(segmentationLine)).toEqual([
                'look [at cup]',
                'look at [cup]',
            ])
        })

        it('across a word no template reads: "coin hurriedly" is the object of a put', () => {
            expect(fillsOf(containmentTemplate.pattern, 'put coin hurriedly into box').map(segmentationLine)).toEqual(['put [coin hurriedly] into [box]'])
        })

        it('across a punctuation mark, re-joined with single spaces', () => {
            expect(fillsOf(membershipTemplate.pattern, 'take cup, then look').map(segmentationLine)).toEqual(['take [cup , then look]'])
            expect(fillsOf(membershipTemplate.pattern, 'take cup.').map(segmentationLine)).toEqual(['take [cup .]'])
        })

        it('never as marks alone: a span holds a word', () => {
            expect(fillsOf(membershipTemplate.pattern, 'take ,')).toEqual([])
        })
    })

    describe('an object phrase', () => {
        const pattern: PatternElement[] = [
            words('take'),
            { type: 'objectPhrase', name: 'subject', prepositions: { ...ON_PREPOSITIONS, out: 'out of' } },
        ]

        it('returns every reading, each preposition a link or inside a span: 2^k for k prepositions, right-nested', () => {
            expect(fillsOf(pattern, 'take cup on saucer on table').map(readingLine).sort()).toEqual([
                'take [cup (on saucer (on table))]',
                'take [cup (on saucer on table)]',
                'take [cup on saucer (on table)]',
                'take [cup on saucer on table]',
            ])
        })

        it('keeps the segmentation flat', () => {
            expect(fillsOf(pattern, 'take cup on saucer on table').map(segmentationLine).sort()).toEqual([
                'take [cup on saucer on table]',
                'take [cup on saucer] on [table]',
                'take [cup] on [saucer on table]',
                'take [cup] on [saucer] on [table]',
            ])
        })

        it('chooses which phrase is the destination when a fixed word follows it', () => {
            const putPattern: PatternElement[] = [
                words('put'),
                { type: 'objectPhrase', name: 'subject', prepositions: ON_PREPOSITIONS },
                words('on'),
                { type: 'objectPhrase', name: 'target', prepositions: ON_PREPOSITIONS },
            ]
            const readings = fillsOf(putPattern, 'put cup on saucer on table').map(readingLine).sort()
            expect(readings).toEqual(expect.arrayContaining([
                'put [cup (on saucer)] on [table]',
                'put [cup] on [saucer (on table)]',
            ]))
        })

        it('captures the first span with its key, and each link', () => {
            const [cut] = fillsOf(pattern, 'take cup on saucer').filter(({ segmentation }) => segmentation.length === 4)
            expect(cut.captures.subject).toEqual({
                kind: 'objectPhrase',
                text: 'cup',
                stableRefKey: 'cupRef',
                links: [{ text: 'on', option: 'on', span: 'saucer' }],
            })
        })

        it('cuts at a phrase and at its prefix where the text allows', () => {
            expect(fillsOf(pattern, 'take cup on top of table').map(segmentationLine).sort()).toEqual([
                'take [cup on top of table]',
                'take [cup] on [top of table]',
                'take [cup] on top of [table]',
            ])
        })

        it('cuts only where a span stands on both sides', () => {
            expect(fillsOf(pattern, 'take cup on').map(segmentationLine)).toEqual(['take [cup on]'])
            expect(fillsOf(pattern, 'take off the hat').map(segmentationLine)).toEqual(['take [off the hat]'])
        })

        it('nests the canonical preposition: a bare "out" is "out of"', () => {
            const [nested] = fillsOf(pattern, 'take coin Out box').filter(({ reading }) => reading.length === 2)
            expect(nested.reading[1]).toEqual({
                type: 'objectSpan',
                span: 'coin',
                stableRefKey: 'coinRef',
                qualifier: { preposition: 'out of', span: { type: 'objectSpan', span: 'box', stableRefKey: 'boxRef' } },
            })
        })

        it('keeps the preposition as typed, spacing collapsed', () => {
            expect(fillsOf(pattern, 'take Cup  On   Top  OF  Table').map(segmentationLine)).toContain('take [Cup] On Top OF [Table]')
        })

        it('gives each span occurrence one key in every fill', () => {
            const keys = fillsOf(pattern, 'take cup on saucer on table').flatMap(({ segmentation }) => segmentation.flatMap((token) => (
                token.type === 'objectSpan' ? [`${token.span}=${token.stableRefKey}`] : []
            )))
            expect([...new Set(keys)].sort()).toEqual([
                'cup on saucer on table=cupOnSaucerOnTableRef',
                'cup on saucer=cupOnSaucerRef',
                'cup=cupRef',
                'saucer on table=saucerOnTableRef',
                'saucer=saucerRef',
                'table=tableRef',
            ])
        })
    })

    describe('adding a template changes no reading of a command it does not read completely', () => {
        const live = [containmentTemplate, spreadTemplate, lookTemplate, lookAtTemplate, membershipTemplate].map(({ pattern }) => pattern)
        const invented: PatternElement[] = [
            words('wrap'),
            { type: 'objectSpan', name: 'subject' },
            words('in a blanket', 'of both', 'top'),
        ]
        const readingsUnder = (options: readonly string[], command: string): string[] => live.flatMap((pattern) => (
            matchPatternFills(pattern, tokenize(granulesOf(options), command)).map((fill) => `${segmentationLine(fill)} / ${readingLine(fill)}`)
        ))

        it.each([
            'put pig in a blanket on the plate on the table',
            'get the book on top of both',
            'take cup on saucer on table',
            'look at the cup on the table',
            'spread cloth over table',
            'take spinning top',
        ])('%s', (command) => {
            const liveOptions = live.flatMap(fixedWordsOf)
            expect(granulesOf([...liveOptions, ...fixedWordsOf(invented)]).granules).not.toEqual(granulesOf(liveOptions).granules)
            expect(readingsUnder([...liveOptions, ...fixedWordsOf(invented)], command)).toEqual(readingsUnder(liveOptions, command))
        })
    })

    describe('a span carries the sub-runs another complete reading cuts', () => {
        /** Each distinct span of the command's readings, with its alternatives spelled out as text. */
        const structuresOf = (command: string): Record<string, string[]> => Object.fromEntries(
            readPlanTemplates(tokenize(COMMAND_GRANULES, command), command)
                .flatMap(({ segmentation }) => segmentation)
                .filter((token): token is ObjectSpanToken => token.type === 'objectSpan' && token.catalog === undefined)
                .map(({ span, structure }) => [
                    span,
                    (structure?.alternatives ?? []).map(({ start, end }) => structure!.tokens.slice(start, end).join(' ')).sort(),
                ])
        )

        it('reads the payoff span as pig and a blanket', () => {
            expect(structuresOf('put pig in a blanket on the plate on the table')['pig in a blanket']).toEqual(['a blanket', 'pig'])
        })

        it('gives a chain every cut inside it', () => {
            expect(structuresOf('take cup on saucer on table')['cup on saucer on table']).toEqual(['cup', 'cup on saucer', 'saucer', 'saucer on table', 'table'])
        })

        it('gives a span no reading cuts inside none: onto is a divider, but no template reads get ... onto', () => {
            expect(structuresOf('get pig onto jewel')['pig onto jewel']).toEqual([])
        })

        it('survives a JSON round trip, as a stored root does', () => {
            const [read] = readPlanTemplates(tokenize(COMMAND_GRANULES, 'take pig in a blanket'), 'take pig in a blanket')
            expect(JSON.parse(JSON.stringify(read.segmentation))).toEqual(read.segmentation)
        })

        it('is unchanged by a template that does not read the command completely', () => {
            const invented: PatternElement[] = [words('wrap'), { type: 'objectSpan', name: 'subject' }, words('in a blanket', 'of both', 'top')]
            const command = 'put pig in a blanket on the plate on the table'
            const live = [containmentTemplate, spreadTemplate, lookTemplate, lookAtTemplate, membershipTemplate].map(({ pattern }) => pattern)
            const spansUnder = (options: readonly string[]) => live.flatMap((pattern) => matchPatternFills(pattern, tokenize(granulesOf(options), command)))
                .flatMap(({ segmentation }) => segmentation)
                .filter((token): token is ObjectSpanToken => token.type === 'objectSpan')
                .map(({ span, structure }) => ({ span, structure }))
            const liveOptions = live.flatMap(fixedWordsOf)
            expect(spansUnder([...liveOptions, ...fixedWordsOf(invented)])).toEqual(spansUnder(liveOptions))
        })
    })
})

// Checked by ts-jest's type check: each `@ts-expect-error` fails the suite if its line compiles.
describe('defineAttemptTemplate', () => {
    const pattern = [fixedWord('verb', { take: 'takes' }), { type: 'objectSpan', name: 'subject' } as const] as const

    it('hands the builder its captures by name, typed from the pattern', () => {
        const template = defineAttemptTemplate({
            name: 'membership',
            pattern,
            build: ({ verb, subject }, command) => CommandAttempt.create('membership', `${command} ${verb.value} ${subject.stableRefKey}`, []),
        })
        // Plan holds every template as the general type, and hands it a fill's captures by name.
        const general: AttemptTemplate = template
        const [fill] = fillsOf(general.pattern, 'take cup')
        expect(general.build(fill.captures, 'x').words).toBe('x takes cupRef')
    })

    it('rejects a builder reading a name its pattern lacks, and a pattern using one name twice', () => {
        defineAttemptTemplate({
            name: 'membership',
            pattern,
            // @ts-expect-error: the pattern has no `target`
            build: ({ target }, command) => CommandAttempt.create('membership', `${command} ${target.text}`, []),
        })
        // @ts-expect-error: `subject` names two elements
        defineAttemptTemplate({
            name: 'membership',
            pattern: [{ type: 'objectSpan', name: 'subject' } as const, words('on'), { type: 'objectSpan', name: 'subject' } as const],
            build: (_captures, command) => CommandAttempt.create('membership', command, []),
        })
    })
})
