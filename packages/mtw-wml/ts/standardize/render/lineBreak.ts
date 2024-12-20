import { isSchemaLineBreak, SchemaLineBreakTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { StandardRenderElement } from "./baseClasses"
import { isRenderTreeNode } from "./utils"

export class StandardRenderLineBreak implements StandardRenderElement {
    constructor(arg: any) {
        if (!(isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaLineBreak(arg.data) && arg.children.length === 0)) {
            throw new Error('Invalid argument to StandardRenderLineBreak constructor')
        }
    }

    get plainString() {
        return '\n'
    }

    toJSON(): GenericTreeNode<SchemaLineBreakTag> {
        return {
            data: { tag: 'br' as const },
            children: []
        }
    }

    toNDJSON() {
        return '\n'
    }
}
