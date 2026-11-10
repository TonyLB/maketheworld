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
    ])('reads %j', (reply, grade) => {
        expect(pieceAnswer(reply, ANSWERS)).toEqual(grade)
    })
})
