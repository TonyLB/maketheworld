import { createEditor, Editor, Text, Transforms } from 'slate'
import withConstrainedWhitespace from './constrainedWhitespace'

const normalizeText = (text: string): string => {
    const editor = withConstrainedWhitespace(createEditor())
    editor.children = [{ type: 'paragraph', children: [{ text }] }]
    Editor.normalize(editor, { force: true })
    const node = editor.children[0].children[0]
    return Text.isText(node) ? node.text : text
}

describe('withConstrainedWhitespace', () => {
    it('returns the same editor instance', () => {
        const editor = createEditor()
        expect(withConstrainedWhitespace(editor)).toBe(editor)
    })

    it('preserves a single interior space', () => {
        expect(normalizeText('Hello world')).toBe('Hello world')
    })

    it('preserves exactly two consecutive spaces (insertion slot)', () => {
        expect(normalizeText('Hello  world')).toBe('Hello  world')
    })

    it('caps three or more consecutive spaces at two', () => {
        expect(normalizeText('Hello   world')).toBe('Hello  world')
        expect(normalizeText('Hello    world')).toBe('Hello  world')
    })
})
