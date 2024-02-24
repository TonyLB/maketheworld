import { Node, NodeEntry, Transforms } from "slate";
import {
    Editor,
    Element as SlateElement
} from "slate";

export const withConditionals = (editor: Editor): Editor => {
    const { normalizeNode, isVoid } = editor

    editor.isVoid = (element) => {
        return element.type === 'ifWrapper' ? true : isVoid(element)
    }

    // editor.normalizeNode = ([node, path]) => {
    //     //
    //     // Check all nodes that could, conceivably, have strings of if/else blocks inside of them,
    //     // so (currently) the top level editor itself, and any non-paragraph blocks
    //     //
    //     if ((SlateElement.isElement(node) && Editor.isBlock(editor, node) && !isCustomParagraph(node)) || Editor.isEditor(node)) {
    //         //
    //         // Check if an ifBase element is nestled up to the start of a block, and if so add an empty paragraph as buffer
    //         //
    //         const children = [...Node.children(node, [])]
    //         if (children.length) {
    //             const firstChild = children[0]
    //             if (SlateElement.isElement(firstChild) && firstChild.type === 'ifBase') {
    //                 Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] }, { at: path })
    //                 return
    //             }
    //         }

    //         //
    //         // Check if a conditional element is nestled up to the end of a block, and if so add an empty paragraph as buffer
    //         //

    //         //
    //         // Accumulate strings of If-related blocks that are connected to each other, to evaluate their
    //         // interdependent properties.
    //         //
    //         const { ifSequences, currentIfSequence } = [...Node.children(node, [])].reduce<CustomIfSequenceReduction>((previous, [child, childPath]) => {
    //             if (SlateElement.isElement(child)) {
    //                 const { ifSequences, currentIfSequence } = previous
    //                 if (child.type === 'ifBase') {
    //                     if (currentIfSequence.length) {
    //                         return {
    //                             ifSequences: [
    //                                 ...ifSequences,
    //                                 currentIfSequence
    //                             ],
    //                             currentIfSequence: [[child, [...path, ...childPath]]]
    //                         }
    //                     }
    //                     else {
    //                         return {
    //                             ifSequences,
    //                             currentIfSequence: [[child, [...path, ...childPath]]]
    //                         }
    //                     }
    //                 }
    //                 if (child.type === 'elseif') {
    //                     return {
    //                         ifSequences,
    //                         currentIfSequence: [
    //                             ...currentIfSequence,
    //                             [child, [...path, ...childPath]]
    //                         ]
    //                     }
    //                 }
    //                 if (child.type === 'else') {
    //                     return {
    //                         ifSequences: [
    //                             ...ifSequences,
    //                             [
    //                                 ...currentIfSequence,
    //                                 [child, [...path, ...childPath]]
    //                             ],
    //                         ],
    //                         currentIfSequence: []
    //                     }
    //                 }
    //             }
    //             return previous
    //         }, { ifSequences: [], currentIfSequence: [] } as CustomIfSequenceReduction)
    //         const allIfSequences = [
    //             ...ifSequences,
    //             ...(currentIfSequence ? [currentIfSequence] : [])
    //         ]
    //         let errorNormalized: boolean = false
    //         allIfSequences.forEach((ifSequence) => {
    //             if (!errorNormalized && ifSequence.length) {
    //                 //
    //                 // First check that the firstElement is an ifBase
    //                 //
    //                 const [firstElement, firstPath] = ifSequence[0]
    //                 if (firstElement.type === 'elseif') {
    //                     //
    //                     // Set a starting elseif node to be an ifBase node instead
    //                     //
    //                     Transforms.setNodes(editor, { type: 'ifBase'}, { at: firstPath })
    //                     errorNormalized = true
    //                 }
    //                 if (firstElement.type === 'else') {
    //                     //
    //                     // Set an orphaned else node to be a paragraph node instead
    //                     //
    //                     Transforms.setNodes(editor, { type: 'paragraph' }, { at: firstPath })
    //                     errorNormalized = true
    //                 }

    //                 //
    //                 // Next, check whether there is an else in the sequence, and tag only the final
    //                 // if or else if accordingly (if all in sequence are not already tagged).  Also
    //                 // check that the path property has been populated correctly
    //                 //
    //                 const elsePresent = Boolean(ifSequence.find(([{ type }]) => (type === 'else')))
    //                 const elseUntagged = ifSequence.reduce<boolean>((previous, [item], index) => {
    //                     if (!previous && (isCustomIfBlock(item) || isCustomElseIfBlock(item))) {
    //                         if (Boolean(item.isElseValid) && elsePresent) {
    //                             return true
    //                         }
    //                         if (!elsePresent && (index === ifSequence.length - 1) && !item.isElseValid) {
    //                             return true
    //                         }
    //                     }
    //                     return previous
    //                 }, false)
    //                 if (elseUntagged) {
    //                     ifSequence.forEach(([item, itemPath], index) => {
    //                         if (isCustomIfBlock(item) || isCustomElseIfBlock(item)) {
    //                             Transforms.setNodes(
    //                                 editor,
    //                                 {
    //                                     isElseValid: (!elsePresent && index === ifSequence.length - 1) ? true : undefined
    //                                 },
    //                                 { at: itemPath }
    //                             )
    //                         }
    //                         errorNormalized = true
    //                     })
    //                 }
    //             }
    //         })
    //         if (errorNormalized) {
    //             return
    //         }
    //     }
    //     return normalizeNode([node, path])
    // }
    return editor
}

export default withConditionals
