import descendantsFromRender from './descendantsFromRender'
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('descendantsFromRender', () => {
    const standardForm = new StandardForm(deIndentWML(`
        <Asset key=(test)>
            <Feature key=(feature1) />
            <Knowledge key=(knowledge1) />
        </Asset>
    `))

    it('should handle StandardRenderString', () => {
        const render = new StandardRender(['Hello'])
        const result = descendantsFromRender(render, { standard: standardForm })
        expect(result).toEqual([{
            type: 'paragraph',
            children: [{ text: 'Hello' }]
        }])
    })

    it('should handle StandardRenderLineBreak', () => {
        const render = new StandardRender([{ data: { tag: 'br' }, children: [] }])
        const result = descendantsFromRender(render, { standard: standardForm })
        expect(result).toEqual([{
            type: 'paragraph',
            children: [{ text: '' }]
        }])
    })

    it('should handle StandardRenderSpace', () => {
        const render = new StandardRender([{ data: { tag: 'Space' }, children: [] }])
        const result = descendantsFromRender(render, { standard: standardForm })
        expect(result).toEqual([{
            type: 'paragraph',
            children: [{ text: ' ' }]
        }])
    })

    it('should handle StandardRenderLink to feature', () => {
        const render = new StandardRender([{ data: { tag: 'Link', to: 'feature1', text: 'Feature Link' }, children: ['Feature Link'] }])
        const result = descendantsFromRender(render, { standard: standardForm })
        expect(result).toEqual([{
            type: 'paragraph',
            children: [{
                type: 'featureLink',
                to: 'feature1',
                children: [{ text: 'Feature Link' }]
            }]
        }])
    })

    it('should handle StandardRenderLink to knowledge', () => {
        const render = new StandardRender([{ data: { tag: 'Link', to: 'knowledge1', text: 'Knowledge Link' }, children: ['Knowledge Link'] }])
        const result = descendantsFromRender(render, { standard: standardForm })
        expect(result).toEqual([{
            type: 'paragraph',
            children: [{
                type: 'knowledgeLink',
                to: 'knowledge1',
                children: [{ text: 'Knowledge Link' }]
            }]
        }])
    })

    it('should handle mixed elements', () => {
        const render = new StandardRender([
            'Hello',
            { data: { tag: 'Space' }, children: [] },
            'World',
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'Link', to: 'feature1', text: 'Feature Link' }, children: ['Feature Link'] }
        ])
        const result = descendantsFromRender(render, { standard: standardForm })
        expect(result).toEqual([
            {
                type: 'paragraph',
                children: [
                    { text: 'Hello World' },
                ]
            },
            {
                type: 'paragraph',
                children: [{
                    type: 'featureLink',
                    to: 'feature1',
                    children: [{ text: 'Feature Link' }]
                }]
            }
        ])
    })
})