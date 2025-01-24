import descendantsFromRender from './descendantsFromRender'
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardRender, StandardRenderSimple } from "@tonylb/mtw-wml/ts/standardize/render"
import StandardRenderString from "@tonylb/mtw-wml/ts/standardize/render/string"
import StandardRenderLineBreak from "@tonylb/mtw-wml/ts/standardize/render/lineBreak"
import StandardRenderSpace from "@tonylb/mtw-wml/ts/standardize/render/space"
import StandardRenderLink from "@tonylb/mtw-wml/ts/standardize/render/link"
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature"
import StandardAction from "@tonylb/mtw-wml/ts/standardize/components/action"
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('descendantsFromRender', () => {
    const standardForm = new StandardForm(deIndentWML(`
        <Asset key=(test)>
            <Feature key=(feature1) />
            <Action key=(action1) src={true} />
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

    it('should handle StandardRenderLink to action', () => {
        const render = new StandardRender([{ data: { tag: 'Link', to: 'action1', text: 'Action Link' }, children: ['Action Link'] }])
        const result = descendantsFromRender(render, { standard: standardForm })
        expect(result).toEqual([{
            type: 'paragraph',
            children: [{
                type: 'actionLink',
                to: 'action1',
                children: [{ text: 'Action Link' }]
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