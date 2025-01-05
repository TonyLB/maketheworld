import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { StandardRenderElement, StandardRenderAbstract } from "./baseClasses"
import { isSchemaSpacer, SchemaSpacerTag } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isRenderTreeNode } from "@tonylb/mtw-base/ts/renderTree"

export class StandardRenderSpace extends StandardRenderAbstract implements StandardRenderElement {
    constructor(arg: any) {
        super()
        if (!(isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaSpacer(arg.data) && arg.children.length === 0)) {
            throw new Error('Invalid argument to StandardRenderSpace constructor')
        }
    }

    override get plainString() {
        return ' '
    }

    override toJSON(): GenericTreeNode<SchemaSpacerTag> {
        return {
            data: { tag: 'Space' as const },
            children: []
        }
    }

    override toNDJSON() {
        return this.toJSON()
    }    
}

export default StandardRenderSpace