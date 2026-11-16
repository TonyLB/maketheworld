import { jsonObject, parseProblems, replyJsonObject } from './stageContract'

const fence = (json: string): string => ['Some reasoning first.', '', '```json', json, '```'].join('\n')

describe('stageContract', () => {
    it.each([
        [fence('{"answer": "blocks", "step": "tip"}'), { object: { answer: 'blocks', step: 'tip' } }],
        [fence('{"answer": blocks}'), { malformed: 'the JSON block does not parse' }],
        ['No block at all.', { malformed: 'no JSON block' }],
    ])('reads a reply\'s trailing JSON object: %j', (reply, result) => {
        expect(replyJsonObject(reply)).toEqual(result)
    })

    it('reads a JSON text as an object, or says why not', () => {
        expect(jsonObject('{"a": 1}')).toEqual({ object: { a: 1 } })
        expect(jsonObject('null')).toEqual({ malformed: 'the JSON block is not an object' })
        expect(jsonObject('["a"]')).toEqual({ malformed: 'the JSON block is not an object' })
    })

    it('gives a parse\'s problems, none for a value', () => {
        expect(parseProblems({ value: 'x' })).toEqual([])
        expect(parseProblems({ problems: ['a', 'b'] })).toEqual(['a', 'b'])
    })
})
