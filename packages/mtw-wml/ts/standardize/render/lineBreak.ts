import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { StandardRenderAbstract, StandardRenderElement } from "./baseClasses"
import { isSchemaLineBreak, SchemaLineBreakTag } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isRenderTreeNode } from "@tonylb/mtw-base/ts/renderTree"

export class StandardRenderLineBreak extends StandardRenderAbstract implements StandardRenderElement {
    constructor(arg: any) {
        super()
        if (!(isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaLineBreak(arg.data) && arg.children.length === 0)) {
            throw new Error('Invalid argument to StandardRenderLineBreak constructor')
        }
    }

    override get plainString(): string {
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