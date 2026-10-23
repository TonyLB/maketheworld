import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import type { PatternElement } from './deterministicTemplate'
import type { PatternCapture, PatternFill } from './patternTemplate'
import {
    assembleIntent,
    makePatternTemplate,
    matchPatternAgainstString,
    matchPatternAgainstTokens,
    synthesizeSkeletonFromPattern,
} from './patternTemplate'

const captureTexts = (fill: PatternFill) => fill.captures.map(({ text }) => text)

describe('matchPatternAgainstString', () => {
    it('matches a pure templateText pattern case-insensitively', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['look', 'l'] }]
        expect(matchPatternAgainstString(pattern, 'Look')).toHaveLength(1)
        expect(matchPatternAgainstString(pattern, 'l')).toHaveLength(1)
    })

    it('rejects near-miss text outside the closed vocabulary (anchoring proof)', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['look', 'l'] }]
        expect(matchPatternAgainstString(pattern, 'looks')).toEqual([])
        expect(matchPatternAgainstString(pattern, 'lookout')).toEqual([])
        expect(matchPatternAgainstString(pattern, 'look around')).toEqual([])
    })

    it('captures an objectSpan slot', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['take'] },
            { type: 'objectSpan', role: 'subject' },
        ]
        const [fill, ...rest] = matchPatternAgainstString(pattern, 'take red ball')
        expect(rest).toEqual([])
        const subject = fill.captures.find((c) => c.kind === 'objectSpan')
        expect(subject).toMatchObject({ kind: 'objectSpan', role: 'subject', text: 'red ball' })
    })

    it('captures a capturedText slot', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['relate'] },
            { type: 'capturedText', role: 'relationLabel' },
        ]
        const [fill, ...rest] = matchPatternAgainstString(pattern, 'relate atop')
        expect(rest).toEqual([])
        const label = fill.captures.find((c) => c.kind === 'capturedText')
        expect(label).toMatchObject({ kind: 'capturedText', role: 'relationLabel', text: 'atop' })
    })

    it('bounds objectSpan captures between fixed text (does not overrun)', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['put'] },
            { type: 'objectSpan', role: 'subject' },
            { type: 'templateText', options: ['on'] },
            { type: 'objectSpan', role: 'target' },
        ]
        const [fill, ...rest] = matchPatternAgainstString(pattern, 'put red bag on small table')
        expect(rest).toEqual([])
        const subject = fill.captures.find((c) => c.kind === 'objectSpan' && c.role === 'subject')
        const target = fill.captures.find((c) => c.kind === 'objectSpan' && c.role === 'target')
        expect(subject).toMatchObject({ text: 'red bag' })
        expect(target).toMatchObject({ text: 'small table' })
    })

    it('returns no fill for wrong vocabulary, trailing tokens, and empty input', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['help'] }]
        expect(matchPatternAgainstString(pattern, 'assist')).toEqual([])
        expect(matchPatternAgainstString(pattern, 'help me')).toEqual([])
        expect(matchPatternAgainstString(pattern, '')).toEqual([])
    })

    it('returns every fill: a fixed word may sit inside a span in one fill and be the fixed word in another', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['take'] },
            { type: 'objectSpan', role: 'subject' },
            { type: 'templateText', options: ['on'] },
            { type: 'objectSpan', role: 'target' },
        ]
        const fills = matchPatternAgainstString(pattern, 'take cup on saucer on table')
        expect(fills.map(captureTexts)).toEqual(expect.arrayContaining([
            ['take', 'cup', 'on', 'saucer on table'],
            ['take', 'cup on saucer', 'on', 'table'],
        ]))
        expect(fills).toHaveLength(2)
    })

    it('a phrase option fills only where the text holds the phrase; its prefix option fills too', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['put'] },
            { type: 'objectSpan', role: 'subject' },
            { type: 'templateText', options: ['on', 'on top of'] },
            { type: 'objectSpan', role: 'target' },
        ]
        const phraseFills = matchPatternAgainstString(pattern, 'put cup on top of table')
        expect(phraseFills.map(captureTexts)).toEqual(expect.arrayContaining([
            ['put', 'cup', 'on top of', 'table'],
            ['put', 'cup', 'on', 'top of table'],
        ]))
        expect(phraseFills).toHaveLength(2)
        expect(matchPatternAgainstString(pattern, 'put cup on table').map(captureTexts)).toEqual([['put', 'cup', 'on', 'table']])
    })

    it('matches a fixed word only as a whole word: "on" inside "onion" is no fill', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['take'] },
            { type: 'objectSpan', role: 'subject' },
            { type: 'templateText', options: ['on'] },
            { type: 'objectSpan', role: 'target' },
        ]
        expect(matchPatternAgainstString(pattern, 'take onion on table').map(captureTexts)).toEqual([['take', 'onion', 'on', 'table']])
        expect(matchPatternAgainstString(pattern, 'take onion table')).toEqual([])
    })

    it('ignores case and collapses spacing, keeping the words as typed', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['put'] },
            { type: 'objectSpan', role: 'subject' },
            { type: 'templateText', options: ['on top of'] },
            { type: 'objectSpan', role: 'target' },
        ]
        expect(matchPatternAgainstString(pattern, '  Put  Red   Cup ON  top OF table ').map(captureTexts))
            .toEqual([['Put', 'Red Cup', 'ON top OF', 'table']])
    })

    it('merges fills that build the same skeleton', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['take', 'TAKE'] },
            { type: 'objectSpan', role: 'subject' },
        ]
        expect(matchPatternAgainstString(pattern, 'take cup')).toHaveLength(1)
    })

    it('adjacent wildcards yield every split', () => {
        const pattern: PatternElement[] = [
            { type: 'objectSpan', role: 'subject' },
            { type: 'objectSpan', role: 'target' },
        ]
        expect(matchPatternAgainstString(pattern, 'red cup box').map(captureTexts)).toEqual(expect.arrayContaining([
            ['red', 'cup box'],
            ['red cup', 'box'],
        ]))
        expect(matchPatternAgainstString(pattern, 'red cup box')).toHaveLength(2)
    })

    it('stamps each fill\'s skeleton', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['take'] },
            { type: 'objectSpan', role: 'subject' },
            { type: 'templateText', options: ['on'] },
            { type: 'objectSpan', role: 'target' },
        ]
        const skeletons = matchPatternAgainstString(pattern, 'take cup on saucer on table').map(({ skeleton }) => skeleton)
        expect(skeletons).toEqual(expect.arrayContaining([
            [
                { type: 'text', text: 'take' },
                { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
                { type: 'text', text: 'on' },
                { type: 'objectSpan', span: 'saucer on table', stableRefKey: 'saucerOnTableRef' },
            ],
            [
                { type: 'text', text: 'take' },
                { type: 'objectSpan', span: 'cup on saucer', stableRefKey: 'cupOnSaucerRef' },
                { type: 'text', text: 'on' },
                { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
            ],
        ]))
    })
})

describe('matchPatternAgainstTokens', () => {
    it('accepts a templateText element against a matching TextToken, case-insensitively', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['look', 'l'] }]
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'LOOK' }]
        expect(matchPatternAgainstTokens(pattern, skeleton)).toHaveLength(1)
    })

    it('rejects a templateText element against a TextToken not in options', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['look', 'l'] }]
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'help' }]
        expect(matchPatternAgainstTokens(pattern, skeleton)).toEqual([])
    })

    it('captures an objectSpan element against an ObjectSpanToken', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['take'] },
            { type: 'objectSpan', role: 'subject' },
        ]
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'red ball', stableRefKey: 'redBallRef' },
        ]
        const [fill, ...rest] = matchPatternAgainstTokens(pattern, skeleton)
        expect(rest).toEqual([])
        expect(fill.skeleton).toBe(skeleton)
        const subject = fill.captures.find((c) => c.kind === 'objectSpan')
        expect(subject).toMatchObject({ kind: 'objectSpan', role: 'subject', text: 'red ball', stableRefKey: 'redBallRef' })
    })

    it('captures a capturedText element against a TextToken', () => {
        const pattern: PatternElement[] = [{ type: 'capturedText', role: 'relationLabel' }]
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'atop' }]
        const [fill] = matchPatternAgainstTokens(pattern, skeleton)
        expect(fill.captures[0]).toMatchObject({ kind: 'capturedText', role: 'relationLabel', text: 'atop' })
    })

    it('returns no fill on length mismatch', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['look'] }]
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'look' }, { type: 'text', text: 'around' }]
        expect(matchPatternAgainstTokens(pattern, skeleton)).toEqual([])
    })

    it('returns no fill on a token-type mismatch at a position', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['take'] },
            { type: 'objectSpan', role: 'subject' },
        ]
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'take' },
            { type: 'text', text: 'red ball' },
        ]
        expect(matchPatternAgainstTokens(pattern, skeleton)).toEqual([])
    })

    it('a fixed word must be the whole text token: "hurriedly into" is not "into"', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['put'] },
            { type: 'objectSpan', role: 'subject' },
            { type: 'templateText', options: ['into', 'on top of'] },
            { type: 'objectSpan', role: 'target' },
        ]
        const skeleton = (preposition: string): ParseSkeleton => [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
            { type: 'text', text: preposition },
            { type: 'objectSpan', span: 'box', stableRefKey: 'boxRef' },
        ]
        expect(matchPatternAgainstTokens(pattern, skeleton('hurriedly into'))).toEqual([])
        expect(matchPatternAgainstTokens(pattern, skeleton(' On  top OF '))).toHaveLength(1)
    })
})

describe('assembleIntent', () => {
    it('returns the constant templateIntent unchanged when there are no captures', () => {
        const intent = assembleIntent({ type: 'LookRoom', confidence: 1 }, [])
        expect(intent).toEqual({ type: 'LookRoom', confidence: 1 })
    })

    it('merges role-tagged objectSpan/capturedText captures into the constant', () => {
        const captures: PatternCapture[] = [
            { elementIndex: 0, kind: 'templateText', text: 'put' },
            { elementIndex: 1, kind: 'objectSpan', role: 'subject', text: 'bag' },
        ]
        const intent = assembleIntent({ type: 'ObjectRelateIntent', confidence: 1 }, captures)
        expect(intent).toEqual({ type: 'ObjectRelateIntent', confidence: 1, subject: 'bag' })
    })

    it('templateText captures contribute nothing to the assembled intent', () => {
        const captures: PatternCapture[] = [{ elementIndex: 0, kind: 'templateText', text: 'look' }]
        const intent = assembleIntent({ type: 'LookRoom', confidence: 1 }, captures)
        expect(intent).toEqual({ type: 'LookRoom', confidence: 1 })
    })
})

describe('synthesizeSkeletonFromPattern', () => {
    it('emits a single TextToken holding the matched word for a pure templateText pattern', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['look', 'l'] }]
        const captures: PatternCapture[] = [{ elementIndex: 0, kind: 'templateText', text: 'l' }]
        expect(synthesizeSkeletonFromPattern(pattern, captures)).toEqual([{ type: 'text', text: 'l' }])
    })

    it('emits an ObjectSpanToken with a stamped stableRefKey for an objectSpan element', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['take'] },
            { type: 'objectSpan', role: 'subject' },
        ]
        const captures: PatternCapture[] = [
            { elementIndex: 0, kind: 'templateText', text: 'take' },
            { elementIndex: 1, kind: 'objectSpan', role: 'subject', text: 'red ball' },
        ]
        const skeleton = synthesizeSkeletonFromPattern(pattern, captures)
        expect(skeleton[0]).toEqual({ type: 'text', text: 'take' })
        expect(skeleton[1]).toMatchObject({ type: 'objectSpan', span: 'red ball' })
        expect(typeof (skeleton[1] as { stableRefKey: string }).stableRefKey).toBe('string')
    })

    it('emits a TextToken for a capturedText element', () => {
        const pattern: PatternElement[] = [{ type: 'capturedText', role: 'relationLabel' }]
        const captures: PatternCapture[] = [{ elementIndex: 0, kind: 'capturedText', role: 'relationLabel', text: 'atop' }]
        expect(synthesizeSkeletonFromPattern(pattern, captures)).toEqual([{ type: 'text', text: 'atop' }])
    })
})

describe('makePatternTemplate', () => {
    it('produces the same intent shape via matchString and matchTokens for a synthetic pattern', () => {
        const template = makePatternTemplate(
            [
                { type: 'templateText', options: ['take'] },
                { type: 'objectSpan', role: 'subject' },
            ],
            { type: 'ObjectMembershipIntent', verbClass: 'acquire', skeleton: [], confidence: 1 }
        )

        const stringResult = template.matchString('take red ball')
        if (stringResult.type !== 'matched') throw new Error('expected matched via matchString')
        expect(stringResult.intent).toEqual({
            type: 'ObjectMembershipIntent',
            verbClass: 'acquire',
            skeleton: [],
            confidence: 1,
            subject: 'red ball',
        })

        const tokenResult = template.matchTokens([
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'red ball', stableRefKey: 'redBallRef' },
        ])
        if (tokenResult.type !== 'matched') throw new Error('expected matched via matchTokens')
        expect(tokenResult.intent).toEqual({
            type: 'ObjectMembershipIntent',
            verbClass: 'acquire',
            skeleton: [],
            confidence: 1,
            subject: 'red ball',
        })
    })

    it('an intent row with several fills is noMatch: one intent cannot carry them', () => {
        const template = makePatternTemplate(
            [
                { type: 'templateText', options: ['take'] },
                { type: 'objectSpan', role: 'subject' },
                { type: 'templateText', options: ['on'] },
                { type: 'objectSpan', role: 'target' },
            ],
            { type: 'ObjectRelateIntent', confidence: 1 }
        )
        expect(template.matchString('take cup on table').type).toBe('matched')
        expect(template.matchString('take cup on saucer on table')).toEqual({ type: 'noMatch' })
    })
})
