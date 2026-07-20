import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import type { PatternElement } from './deterministicTemplate'
import type { PatternCapture } from './patternTemplate'
import {
    assembleIntent,
    makePatternTemplate,
    matchPatternAgainstString,
    matchPatternAgainstTokens,
    synthesizeSkeletonFromPattern,
} from './patternTemplate'

describe('matchPatternAgainstString', () => {
    it('matches a pure templateText pattern case-insensitively', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['look', 'l'] }]
        expect(matchPatternAgainstString(pattern, 'Look').type).toBe('matched')
        expect(matchPatternAgainstString(pattern, 'l').type).toBe('matched')
    })

    it('rejects near-miss text outside the closed vocabulary (anchoring proof)', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['look', 'l'] }]
        expect(matchPatternAgainstString(pattern, 'looks').type).toBe('noMatch')
        expect(matchPatternAgainstString(pattern, 'lookout').type).toBe('noMatch')
        expect(matchPatternAgainstString(pattern, 'look around').type).toBe('noMatch')
    })

    it('captures an objectSpan slot', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['take'] },
            { type: 'objectSpan', role: 'subject' },
        ]
        const result = matchPatternAgainstString(pattern, 'take red ball')
        if (result.type !== 'matched') throw new Error('expected matched')
        const subject = result.captures.find((c) => c.kind === 'objectSpan')
        expect(subject).toMatchObject({ kind: 'objectSpan', role: 'subject', text: 'red ball' })
    })

    it('captures a capturedText slot', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['relate'] },
            { type: 'capturedText', role: 'relationLabel' },
        ]
        const result = matchPatternAgainstString(pattern, 'relate atop')
        if (result.type !== 'matched') throw new Error('expected matched')
        const label = result.captures.find((c) => c.kind === 'capturedText')
        expect(label).toMatchObject({ kind: 'capturedText', role: 'relationLabel', text: 'atop' })
    })

    it('bounds non-greedy objectSpan captures between fixed text (does not overrun)', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['put'] },
            { type: 'objectSpan', role: 'subject' },
            { type: 'templateText', options: ['on'] },
            { type: 'objectSpan', role: 'target' },
        ]
        const result = matchPatternAgainstString(pattern, 'put red bag on small table')
        if (result.type !== 'matched') throw new Error('expected matched')
        const subject = result.captures.find((c) => c.kind === 'objectSpan' && c.role === 'subject')
        const target = result.captures.find((c) => c.kind === 'objectSpan' && c.role === 'target')
        expect(subject).toMatchObject({ text: 'red bag' })
        expect(target).toMatchObject({ text: 'small table' })
    })

    it('returns noMatch for wrong vocabulary, trailing tokens, and empty input', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['help'] }]
        expect(matchPatternAgainstString(pattern, 'assist').type).toBe('noMatch')
        expect(matchPatternAgainstString(pattern, 'help me').type).toBe('noMatch')
        expect(matchPatternAgainstString(pattern, '').type).toBe('noMatch')
    })
})

describe('matchPatternAgainstTokens', () => {
    it('accepts a templateText element against a matching TextToken, case-insensitively', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['look', 'l'] }]
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'LOOK' }]
        expect(matchPatternAgainstTokens(pattern, skeleton).type).toBe('matched')
    })

    it('rejects a templateText element against a TextToken not in options', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['look', 'l'] }]
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'help' }]
        expect(matchPatternAgainstTokens(pattern, skeleton).type).toBe('noMatch')
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
        const result = matchPatternAgainstTokens(pattern, skeleton)
        if (result.type !== 'matched') throw new Error('expected matched')
        const subject = result.captures.find((c) => c.kind === 'objectSpan')
        expect(subject).toMatchObject({ kind: 'objectSpan', role: 'subject', text: 'red ball', stableRefKey: 'redBallRef' })
    })

    it('captures a capturedText element against a TextToken', () => {
        const pattern: PatternElement[] = [{ type: 'capturedText', role: 'relationLabel' }]
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'atop' }]
        const result = matchPatternAgainstTokens(pattern, skeleton)
        if (result.type !== 'matched') throw new Error('expected matched')
        expect(result.captures[0]).toMatchObject({ kind: 'capturedText', role: 'relationLabel', text: 'atop' })
    })

    it('returns noMatch on length mismatch', () => {
        const pattern: PatternElement[] = [{ type: 'templateText', options: ['look'] }]
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'look' }, { type: 'text', text: 'around' }]
        expect(matchPatternAgainstTokens(pattern, skeleton).type).toBe('noMatch')
    })

    it('returns noMatch on a token-type mismatch at a position', () => {
        const pattern: PatternElement[] = [
            { type: 'templateText', options: ['take'] },
            { type: 'objectSpan', role: 'subject' },
        ]
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'take' },
            { type: 'text', text: 'red ball' },
        ]
        expect(matchPatternAgainstTokens(pattern, skeleton).type).toBe('noMatch')
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
            { type: 'ObjectMembershipIntent', verbClass: 'acquire', rawObjectSpans: [], confidence: 1 }
        )

        const stringResult = template.matchString('take red ball')
        if (stringResult.type !== 'matched') throw new Error('expected matched via matchString')
        expect(stringResult.intent).toEqual({
            type: 'ObjectMembershipIntent',
            verbClass: 'acquire',
            rawObjectSpans: [],
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
            rawObjectSpans: [],
            confidence: 1,
            subject: 'red ball',
        })
    })
})
