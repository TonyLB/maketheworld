import { pieceAnswer } from './pieceAnswer'

const ANSWERS = ['blocks', 'allows']

describe('pieceAnswer', () => {
    it.each([
        ['The teapot tilts on the table.\nAnswer: blocks', { answer: 'blocks' }],
        ['Answer: allows\nOn reflection, no.\nAnswer: blocks', { answer: 'blocks' }],
        ['  Answer: Allows.  ', { answer: 'allows' }],
        ['Answer: blocks, since the teapot moves apart from the table', { answer: 'blocks' }],
        ['The rule blocks it.', { malformed: 'no Answer line' }],
        ['Answer: maybe', { malformed: '"maybe" is not one of blocks, allows' }],
        ['Answer:', { malformed: '"" is not one of blocks, allows' }],
        ['The two move apart. Answer: blocks', { malformed: 'no Answer line' }],
    ])('reads an Answer line: %j', (reply, grade) => {
        expect(pieceAnswer(reply, ANSWERS)).toEqual(grade)
    })

    const fence = (json: string): string => ['The teapot is lifted off the table, so it moves relative to it.', '', '```json', json, '```'].join('\n')

    it.each([
        [fence('{"answer": "blocks"}'), { answer: 'blocks' }],
        [fence('{"answer": " Allows "}'), { answer: 'allows' }],
        ['The two tip together, "glued to" as they are. {"answer": "allows"}', { answer: 'allows' }],
        [fence('{"answer": "maybe"}'), { malformed: '"maybe" is not one of blocks, allows' }],
        [fence('{"answer": blocks}'), { malformed: 'the JSON block does not parse' }],
        [fence('{"verdict": "blocks"}'), { malformed: 'the JSON block has no string "answer"' }],
        [`${fence('{"answer": "allows"}')}\nAnswer: blocks`, { answer: 'allows' }],
    ])('reads a JSON answer, over any Answer line: %j', (reply, grade) => {
        expect(pieceAnswer(reply, ANSWERS)).toEqual(grade)
    })

    it('grades draft 1\'s inline verdict as before, since it has no JSON', () => {
        expect(pieceAnswer('The action of tipping the table tips both together as a single unit. Answer: allows', ANSWERS)).toEqual({ malformed: 'no Answer line' })
    })
})
