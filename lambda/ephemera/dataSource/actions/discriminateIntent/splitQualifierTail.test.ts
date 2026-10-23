import { splitQualifierTail } from './splitQualifierTail'

describe('splitQualifierTail', () => {
    it.each(['on', 'on top of', 'off', 'in', 'inside', 'out of', 'from'])('splits at "%s" into a head and one link', (preposition) => {
        expect(splitQualifierTail(`cup ${preposition} table`)).toEqual({
            head: 'cup',
            links: [{ preposition, span: 'table' }],
        })
    })

    it('matches "out of" and "on top of" as one phrase, ahead of "out" and "on"', () => {
        expect(splitQualifierTail('coin out of box').links).toEqual([{ preposition: 'out of', span: 'box' }])
        expect(splitQualifierTail('cup on top of table').links).toEqual([{ preposition: 'on top of', span: 'table' }])
    })

    it('splits a chain at each preposition', () => {
        expect(splitQualifierTail('cup on saucer on table')).toEqual({
            head: 'cup',
            links: [{ preposition: 'on', span: 'saucer' }, { preposition: 'on', span: 'table' }],
        })
    })

    it('peels a leading article from each piece', () => {
        expect(splitQualifierTail('the cup on the table')).toEqual({
            head: 'cup',
            links: [{ preposition: 'on', span: 'table' }],
        })
    })

    it('splits only at whole words: "on" inside "onion" is no split point', () => {
        expect(splitQualifierTail('onion on table')).toEqual({
            head: 'onion',
            links: [{ preposition: 'on', span: 'table' }],
        })
    })

    it.each([
        ['an empty head', 'off the hat'],
        ['a trailing preposition', 'cup on'],
    ])('leaves %s whole', (_label, tail) => {
        expect(splitQualifierTail(tail)).toEqual({ head: tail, links: [] })
    })

    it.each(['cup under table', 'box of matches', 'cup onto table', 'coin into box', 'coin out box'])('does not split "%s": the word is outside the closed set', (tail) => {
        expect(splitQualifierTail(tail)).toEqual({ head: tail, links: [] })
    })

    it('ignores case and keeps the preposition as typed, whitespace collapsed', () => {
        expect(splitQualifierTail('Cup  On   Top  OF  Table')).toEqual({
            head: 'Cup',
            links: [{ preposition: 'On Top OF', span: 'Table' }],
        })
    })
})
