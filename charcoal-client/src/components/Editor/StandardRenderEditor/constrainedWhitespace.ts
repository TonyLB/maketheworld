import { Transforms } from "slate"
import {
    Editor,
    Text
} from "slate"

export const withConstrainedWhitespace = (editor: Editor): Editor => {
    const { normalizeNode } = editor

    editor.normalizeNode = ([node, path]) => {
        if (Text.isText(node)) {
            const match = node.text.match(/\s{2,}/)
            if (match && match[0] && typeof match.index === 'number') {
                // Collapse run of 2+ spaces to one: keep first space, delete the rest (Slate Location = Point for text)
                Transforms.delete(editor, {
                    at: { path, offset: match.index + 1 },
                    distance: match[0].length - 1
                })
                return
            }
        }
        return normalizeNode([node, path])
    }
    return editor
}

export default withConstrainedWhitespace
