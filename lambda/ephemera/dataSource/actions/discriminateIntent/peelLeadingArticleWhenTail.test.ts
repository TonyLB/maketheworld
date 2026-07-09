import { peelLeadingArticleWhenTail } from './peelLeadingArticleWhenTail'

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
