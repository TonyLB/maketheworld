import { peelLeadingArticleWhenTail, spanIsNameSubsequence, spanMatchForms } from './spanMatchForms'

describe('spanMatchForms', () => {
    it.each([
        ['the cup', ['the cup', 'cup']],
        ['  The   Thing ', ['the thing', 'thing']],
        ['cup', ['cup']],
        ['the', ['the']],
        ['   ', []],
    ])('lists the span as given, then peeled when that differs (%j)', (input, expected) => {
        expect(spanMatchForms(input)).toEqual(expected)
    })
})

describe('peelLeadingArticleWhenTail', () => {
    it.each([
        ['the broom', 'broom'],
        ['  an apple  ', 'apple'],
        ['some coins', 'coins'],
        ['A widget', 'widget'],
        ['AN AXE', 'AXE'],
        ['THE rope', 'rope'],
        ['Some rope', 'rope'],
        ['get a broom', 'get a broom'],
    ])('peels leading article when tail remains (%j -> %j)', (input, expected) => {
        expect(peelLeadingArticleWhenTail(input)).toBe(expected)
    })

    it.each([
        ['a', 'a'],
        ['the', 'the'],
        ['an', 'an'],
        ['some', 'some'],
        ['ax', 'ax'],
        ['axe', 'axe'],
        ['somebody', 'somebody'],
        ['another', 'another'],
        ['lord of the rings', 'lord of the rings'],
    ])('leaves span unchanged when peel would be empty or no article (%j)', (input, expected) => {
        expect(peelLeadingArticleWhenTail(input)).toBe(expected)
    })
})

describe('spanIsNameSubsequence', () => {
    it.each([
        ['cup', 'big red cup'],
        ['red cup', 'big red cup'],
        ['big cup', 'big red cup'],
        ['big red cup', 'big red cup'],
        ['the cup', 'red cup'],
        ['  Red   CUP ', 'red cup'],
    ])('matches %j against %j', (span, name) => {
        expect(spanIsNameSubsequence(span, name)).toBe(true)
    })

    it.each([
        ['cup red', 'red cup'],
        ['cup', 'cupboard'],
        ['cup', 'teacup'],
        ['up', 'cup up'],
        ['cup cup', 'cup'],
        ['mug', 'red cup'],
        ['', 'red cup'],
        ['the', 'the cup'],
        ['some', 'some coins'],
        ['an', 'an axe'],
    ])('does not match %j against %j', (span, name) => {
        expect(spanIsNameSubsequence(span, name)).toBe(false)
    })
})
