import { Node, Path, Transforms } from "slate";
import {
    Editor,
    Element as SlateElement
} from "slate";

export const withConditionals = (editor: Editor): Editor => {
    const { normalizeNode } = editor

    editor.normalizeNode = ([node, path]) => {
        if (SlateElement.isElement(node) && node.type === 'if') {
            Transforms.removeNodes(editor, { at: path, match: (child, childPath) => (path.length === childPath.length - 1 && (SlateElement.isElement(child) && ('text' in child || editor.isInline(child)))) })
            // const textSpacerNodes = [...Node.children(editor, path)].reduce<Path[]>((previous, [child, childPath]) => {
            //     if ("text" in child) {
            //         return [
            //             childPath,
            //             ...previous
            //         ]
            //     }
            //     else {
            //         return previous
            //     }
            // }, [])
            // console.log(`textSpacerNodes: ${JSON.stringify(textSpacerNodes, null, 4)}`)
            // textSpacerNodes.forEach((childPath) => {
            //     Transforms.removeNodes(editor, { at: childPath })
            // })
            return
        }
        return normalizeNode([node, path])
    }
    return editor
}

export default withConditionals
