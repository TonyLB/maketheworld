import { Transforms } from "slate"
import {
    Editor,
    Text,
    Element as SlateElement
} from "slate"

export const withConstrainedWhitespace = (editor: Editor): Editor => {
    const { normalizeNode } = editor

    editor.normalizeNode = ([node, path]) => {
        if (Text.isText(node)) {
            const match = node.text.match(/\s{2,}/)
            if (match && match.length > 1 && match[1]) {
                Transforms.delete(editor, { at: [...path, match.index + 1], distance: match[1].length - 1 })
                return
            }
        }
        return normalizeNode([node, path])
    }
    return editor
}

export default withConstrainedWhitespace
