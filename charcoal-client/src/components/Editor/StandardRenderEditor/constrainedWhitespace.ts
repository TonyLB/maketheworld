import { Transforms } from "slate"
import {
    Editor,
    Text
} from "slate"

export const withConstrainedWhitespace = (editor: Editor): Editor => {
    const { normalizeNode } = editor

    editor.normalizeNode = ([node, path]) => {
        if (Text.isText(node)) {
            const match = node.text.match(/\s{3,}/)
            if (match && match[0] && typeof match.index === 'number') {
                // Cap runs of 3+ whitespace at two (insertion-slot shape); delete excess beyond first two spaces
                Transforms.delete(editor, {
                    at: { path, offset: match.index + 2 },
                    distance: match[0].length - 2
                })
                return
            }
        }
        return normalizeNode([node, path])
    }
    return editor
}

export default withConstrainedWhitespace
