import { interpretParseBody } from './interpretParse'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'

describe('interpretParseBody', () => {
    it('accepts a valid multi-token skeleton', () => {
        expect(interpretParseBody(
            '{"tokens":[{"type":"text","text":"put"},{"type":"objectSpan","span":"bag"},{"type":"text","text":"in"},{"type":"objectSpan","span":"box"}]}'
        )).toEqual({
            success: true,
            response: {
                tokens: [
                    { type: 'text', text: 'put' },
                    { type: 'objectSpan', span: 'bag' },
                    { type: 'text', text: 'in' },
                    { type: 'objectSpan', span: 'box' },
                ],
            },
        })
    })

    it('accepts a valid zero-referent (all-text) skeleton', () => {
        expect(interpretParseBody('{"tokens":[{"type":"text","text":"look"}]}')).toEqual({
            success: true,
            response: { tokens: [{ type: 'text', text: 'look' }] },
        })
    })

    it('trims token text/span whitespace', () => {
        expect(interpretParseBody('{"tokens":[{"type":"objectSpan","span":" bag "}]}')).toEqual({
            success: true,
            response: { tokens: [{ type: 'objectSpan', span: 'bag' }] },
        })
    })

    it('rejects a missing tokens field', () => {
        const parsed = interpretParseBody('{}')
        expect(parsed.success).toBe(false)
        if (!parsed.success) {
            expect(parsed.errorMessage).toBe(objectManipulationErrorMessages.parseParseFailed)
        }
    })

    it('rejects a non-array tokens field', () => {
        const parsed = interpretParseBody('{"tokens":"not an array"}')
        expect(parsed.success).toBe(false)
    })

    it('rejects an empty tokens array', () => {
        const parsed = interpretParseBody('{"tokens":[]}')
        expect(parsed.success).toBe(false)
    })

    it('rejects an unknown token type', () => {
        const parsed = interpretParseBody('{"tokens":[{"type":"verb","text":"put"}]}')
        expect(parsed.success).toBe(false)
    })

    it('rejects an empty span string', () => {
        const parsed = interpretParseBody('{"tokens":[{"type":"objectSpan","span":"  "}]}')
        expect(parsed.success).toBe(false)
    })

    it('rejects an empty text string', () => {
        const parsed = interpretParseBody('{"tokens":[{"type":"text","text":""}]}')
        expect(parsed.success).toBe(false)
    })

    it('rejects a token with a forbidden field', () => {
        const parsed = interpretParseBody(
            '{"tokens":[{"type":"objectSpan","span":"bag","objectId":"OBJECT#Bag"}]}'
        )
        expect(parsed.success).toBe(false)
    })

    it('rejects invalid JSON', () => {
        const parsed = interpretParseBody('not json')
        expect(parsed.success).toBe(false)
        if (!parsed.success) {
            expect(parsed.errorMessage).toBe(objectManipulationErrorMessages.parseParseFailed)
        }
    })
})
