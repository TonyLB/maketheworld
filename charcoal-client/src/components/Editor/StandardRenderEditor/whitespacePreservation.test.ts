import { Descendant } from 'slate'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import descendantsFromRender from './descendantsFromRender'
import descendantsToRender from './descendantsToRender'
import { CustomBlock } from '../baseClasses'

const spaceTag = { data: { tag: 'Space' as const }, children: [] as [] }
const brTag = { data: { tag: 'br' as const }, children: [] as [] }

describe('Whitespace preservation (target semantics)', () => {
    const standardForm = new StandardForm(deIndentWML(`
        <Asset uuid=(test)>
            <Feature key=(feature1) />
            <Knowledge key=(knowledge1) />
        </Asset>
    `))

    const toRender = descendantsToRender(standardForm)
    const fromRender = (render: StandardRender) => descendantsFromRender(render, { standard: standardForm })

    const roundTrip = (slate: Descendant[]) => {
        const render = toRender(slate as CustomBlock[])
        const back = fromRender(render)
        return { render, back }
    }

    describe('Track A -- document boundary', () => {
        describe('outbound (Slate -> StandardRender)', () => {
            it('should emit trailing Space tag for single-paragraph trailing space', () => {
                const slate: Descendant[] = [{ type: 'paragraph', children: [{ text: 'Hello ' }] }]
                const json = toRender(slate as CustomBlock[]).toJSON()
                expect(json).toEqual(['Hello', spaceTag])
            })

            it('should emit leading Space tag for single-paragraph leading space', () => {
                const slate: Descendant[] = [{ type: 'paragraph', children: [{ text: ' Hello' }] }]
                const json = toRender(slate as CustomBlock[]).toJSON()
                expect(json).toEqual([spaceTag, 'Hello'])
            })
        })

        describe('inbound (StandardRender -> Slate)', () => {
            it('should map document-end Space to trailing space on last paragraph', () => {
                const render = new StandardRender(['Hello', spaceTag])
                const result = fromRender(render)
                expect(result).toEqual([{
                    type: 'paragraph',
                    children: [{ text: 'Hello ' }]
                }])
            })

            it('should map document-start Space to leading space on first paragraph', () => {
                const render = new StandardRender([spaceTag, 'Hello'])
                const result = fromRender(render)
                expect(result).toEqual([{
                    type: 'paragraph',
                    children: [{ text: ' Hello' }]
                }])
            })
        })

        describe('full round-trip', () => {
            it('should preserve trailing space on single paragraph', () => {
                const slate: Descendant[] = [{ type: 'paragraph', children: [{ text: 'Hello ' }] }]
                const { render, back } = roundTrip(slate)
                expect(render.toJSON()).toEqual(['Hello', spaceTag])
                expect(back).toEqual([{
                    type: 'paragraph',
                    children: [{ text: 'Hello ' }]
                }])
            })

            it('should preserve leading space on single paragraph', () => {
                const slate: Descendant[] = [{ type: 'paragraph', children: [{ text: ' Hello' }] }]
                const { render, back } = roundTrip(slate)
                expect(render.toJSON()).toEqual([spaceTag, 'Hello'])
                expect(back).toEqual([{
                    type: 'paragraph',
                    children: [{ text: ' Hello' }]
                }])
            })
        })
    })

    describe('Track B -- paragraph boundary (Space adjacent to br)', () => {
        describe('outbound (Slate -> StandardRender)', () => {
            it('should emit Space before br for trailing space on non-final paragraph', () => {
                const slate: Descendant[] = [
                    { type: 'paragraph', children: [{ text: 'Line one ' }] },
                    { type: 'paragraph', children: [{ text: 'Line two' }] }
                ]
                const json = toRender(slate as CustomBlock[]).toJSON()
                expect(json).toEqual(['Line one', spaceTag, brTag, 'Line two'])
            })

            it('should emit Space after br for leading space on paragraph after break', () => {
                const slate: Descendant[] = [
                    { type: 'paragraph', children: [{ text: 'Line one' }] },
                    { type: 'paragraph', children: [{ text: ' Line two' }] }
                ]
                const json = toRender(slate as CustomBlock[]).toJSON()
                expect(json).toEqual(['Line one', brTag, spaceTag, 'Line two'])
            })
        })

        describe('inbound (StandardRender -> Slate)', () => {
            it('should map Space before br to trailing space on preceding paragraph', () => {
                const render = new StandardRender(['Line one', spaceTag, brTag, 'Line two'])
                const result = fromRender(render)
                expect(result).toEqual([
                    { type: 'paragraph', children: [{ text: 'Line one ' }] },
                    { type: 'paragraph', children: [{ text: 'Line two' }] }
                ])
            })

            it('should map Space after br to leading space on following paragraph', () => {
                const render = new StandardRender(['Line one', brTag, spaceTag, 'Line two'])
                const result = fromRender(render)
                expect(result).toEqual([
                    { type: 'paragraph', children: [{ text: 'Line one' }] },
                    { type: 'paragraph', children: [{ text: ' Line two' }] }
                ])
            })
        })

        describe('full round-trip', () => {
            it('should preserve trailing space before next paragraph', () => {
                const slate: Descendant[] = [
                    { type: 'paragraph', children: [{ text: 'Line one ' }] },
                    { type: 'paragraph', children: [{ text: 'Line two' }] }
                ]
                const { render, back } = roundTrip(slate)
                expect(render.toJSON()).toEqual(['Line one', spaceTag, brTag, 'Line two'])
                expect(back).toEqual([
                    { type: 'paragraph', children: [{ text: 'Line one ' }] },
                    { type: 'paragraph', children: [{ text: 'Line two' }] }
                ])
            })

            it('should preserve leading space after previous paragraph', () => {
                const slate: Descendant[] = [
                    { type: 'paragraph', children: [{ text: 'Line one' }] },
                    { type: 'paragraph', children: [{ text: ' Line two' }] }
                ]
                const { render, back } = roundTrip(slate)
                expect(render.toJSON()).toEqual(['Line one', brTag, spaceTag, 'Line two'])
                expect(back).toEqual([
                    { type: 'paragraph', children: [{ text: 'Line one' }] },
                    { type: 'paragraph', children: [{ text: ' Line two' }] }
                ])
            })

            it('should preserve trailing space after inline link on non-final paragraph', () => {
                const slate: Descendant[] = [
                    {
                        type: 'paragraph',
                        children: [
                            { text: 'See ' },
                            { type: 'featureLink', to: 'feature1', children: [{ text: 'link' }] },
                            { text: ' ' }
                        ]
                    },
                    { type: 'paragraph', children: [{ text: 'Next line' }] }
                ]
                const { render, back } = roundTrip(slate)
                expect(render.toJSON()).toEqual([
                    'See ',
                    { data: { tag: 'Link', to: 'feature1', text: 'link' }, children: [] },
                    spaceTag,
                    brTag,
                    'Next line'
                ])
                expect(back).toEqual([
                    {
                        type: 'paragraph',
                        children: [
                            { text: 'See ' },
                            { type: 'featureLink', to: 'feature1', children: [{ text: 'link' }] },
                            { text: ' ' }
                        ]
                    },
                    { type: 'paragraph', children: [{ text: 'Next line' }] }
                ])
            })
        })
    })
})
