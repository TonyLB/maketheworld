import { isSchemaLineBreak, SchemaLineBreakTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { StandardRenderAbstract, StandardRenderElement } from "./baseClasses"
import { isRenderTreeNode } from "./utils"

export class StandardRenderLineBreak extends StandardRenderAbstract implements StandardRenderElement {
    constructor(arg: any) {
        super()
        if (!(isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaLineBreak(arg.data) && arg.children.length === 0)) {
            throw new Error('Invalid argument to StandardRenderLineBreak constructor')
        }
    }

    override get plainString() {
        return '\n'
    }

    override toJSON(): GenericTreeNode<SchemaLineBreakTag> {
        return {
            data: { tag: 'br' as const },
            children: []
        }
    }

    override toNDJSON() {
        return '\n'
    }
}

export default StandardRenderLineBreak