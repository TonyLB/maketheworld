import {
    Editor
} from "slate";

export const withConditionals = (editor: Editor): Editor => {
    const { isVoid } = editor

    editor.isVoid = (element) => {
        return ['newIfWrapper', 'ifWrapper'].includes(element.type) ? true : isVoid(element)
    }

    return editor
}

export default withConditionals
