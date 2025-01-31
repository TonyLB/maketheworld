import descendantsToRender from "./descendantsToRender"
import { Descendant } from "slate"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"

describe('descendantsToRender', () => {
    it('should return an empty StandardRender from empty paragraph', () => {
        const standard = new StandardForm('<Asset key=(base) />')
        const items: Descendant[] = [{ type: 'paragraph', children: [{ text: '' }]}]
        expect(descendantsToRender(standard)(items)).toEqual(new StandardRender([]))
    })

    it('should return a text description', () => {
        const standard = new StandardForm('<Asset key=(base) />')
        const items: Descendant[] = [{
            type: 'paragraph',
            children: [{
                text: 'This is a test ',
            },
            {
                type: 'featureLink',
                to: 'testFeature',
                children: [{ text: 'with a link' }]
            },
            {
                text: ' and more text.'
            }]
        }]
        expect(descendantsToRender(standard)(items)).toEqual(new StandardRender([
            { data: { tag: 'String', value: 'This is a test ' }, children: [] },
            { data: { tag: 'Link', to: 'testFeature', text: 'with a link' }, children: [] },
            { data: { tag: 'String', value: ' and more text.' }, children: [] }
        ]))
    })

    it('should replace paragraph breaks with LineBreak tags', () => {
        const standard = new StandardForm('<Asset key=(base) />')
        const items: Descendant[] = [{
            type: 'paragraph',
            children: [{ text: 'This is a test.' }]
        },
        {
            type: 'paragraph',
            children: [{ text: 'With two paragraphs.' }]
        }]
        expect(descendantsToRender(standard)(items)).toEqual(new StandardRender([
            { data: { tag: 'String', value: 'This is a test.' }, children: [] },
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'String', value: 'With two paragraphs.' }, children: [] }
        ]))
    })

    it('should replace space at end of last line (only) with Space tag', () => {
        const standard = new StandardForm('<Asset key=(base)><Feature key=(testFeature) /></Asset>')
        const items: Descendant[] = [{
            type: 'paragraph',
            children: [{ text: 'This is a test. ' }]
        },
        {
            type: 'paragraph',
            children: [
                { text: 'With ' },
                {
                    children: [{ text: "link"}],
                    to: "testFeature",
                    type: "featureLink"
                },
                { text: ' ' }
            ]
        }]
        expect(descendantsToRender(standard)(items)).toEqual(new StandardRender([
            { data: { tag: 'String', value: 'This is a test.' }, children: [] },
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'String', value: 'With ' }, children: [] },
            { data: { tag: 'Link', to: 'testFeature', text: 'link' }, children: [] },
            { data: { tag: 'String', value: ' ' }, children: [] }
        ]))
    })

})