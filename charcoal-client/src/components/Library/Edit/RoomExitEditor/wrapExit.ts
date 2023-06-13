import { Transforms } from "slate"
import {
    Editor,
    Text,
    Element as SlateElement,
    Node,
    Path
} from "slate"
import { isCustomBlock, isCustomExitBlock } from "../baseClasses"

export const withExitWrapping = (roomId: string) => (editor: Editor): Editor => {
    const { normalizeNode } = editor

    editor.normalizeNode = ([node, path]: [Node, Path]) => {
        if (Text.isText(node) && node.text.trim()) {
            const [parent] = Editor.parent(editor, path)
            if (!parent || !(SlateElement.isElement(parent) && isCustomBlock(parent) && isCustomExitBlock(parent))) {
                Transforms.wrapNodes(editor, { type: 'exit', to: '', from: roomId, key: '', children: [] }, { at: path })
                return
            }
        }
        return normalizeNode([node, path])
    }
    return editor
}

export default withExitWrapping
