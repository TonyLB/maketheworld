import { Node, Path, Transforms } from "slate";
import {
    Editor,
    Element as SlateElement
} from "slate";

//
// TODO: Figure out how to normalize when an ElseIf block exists not following an IfBase or ElseIf block (turn it into an IfBase block and
// wrap it in an If block if needed)
//
// TODO: Figure out how to normalize when an Else block exists not following an IfBase or ElseIf block (change its wrapper to
// a Paragraph block)
//
// TODO: Figure out how to preserve line-breaks as something more than paragraph breaks, now that paragraphs can be broken by
// other types of blocks (which don't necessarily imply line-breaks).  Short-term:  Continue to preserve it as a paragraph
// break, even if this implies an empty-line paragraph as a marker when a line-break is immediately followed by an IfBlock.
//
export const withConditionals = (editor: Editor): Editor => {
    const { normalizeNode } = editor

    editor.normalizeNode = ([node, path]) => {
        if (SlateElement.isElement(node)) {
            if (node.type === 'ifBase') {
                const parent = Editor.parent(editor, path)
                //
                // TODO: Remove CustomIfBlock and reuse the name to rename CustomIfBase ... If, ElseIf and Else will be at
                // the same level as paragraphs, and their coordination will be handled by normalizeNode
                //
                if (SlateElement.isElement(parent) && parent.type === 'paragraph') {
                    //
                    // TODO: Figure out how to normalize when a sequence of IfBase, ElseIf or Else records exist in a paragraph (Change the
                    // IfBase to a Paragraph block as a sibling, then wrap the remainder of the sequence inside a newly created sibling IfBlock
                    // following)
                    //

                }

            }
        }
        // if (SlateElement.isElement(node) && node.type === 'if') {
        //     const isInlineChild = (child: Node) => (SlateElement.isElement(child) && ('text' in child || editor.isInline(child)))
        //     if (node.children.find(isInlineChild)) {
        //         Transforms.liftNodes(editor, { at: path, match: (child, childPath) => ((path.length === childPath.length - 1) && (isInlineChild(child))) })
        //         return
        //     }
        //     if (node.children.length === 0 || ((node.children.length === 1) && ('text' in node.children[0]) && (node.children[0] as any).text === '')) {
        //         Transforms.removeNodes(editor, { at: path })
        //         return
        //     }
        //     if (node.children[0].type === 'else') {
        //         Transforms.unwrapNodes(editor, { at: [...path, 0] })
        //         Transforms.unwrapNodes(editor, { at: [...path] })
        //         return
        //     }
        // }
        return normalizeNode([node, path])
    }
    return editor
}

export default withConditionals
