import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { StandardRenderElement, StandardRenderAbstract } from "./baseClasses"
import { isSchemaDoubleSpace, SchemaDoubleSpaceTag } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isRenderTreeNode } from "@tonylb/mtw-base/ts/renderTree"

export class StandardRenderDoubleSpace extends StandardRenderAbstract implements StandardRenderElement {
    constructor(arg: any) {
        super()
        if (!(isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaDoubleSpace(arg.data) && arg.children.length === 0)) {
            throw new Error('Invalid argument to StandardRenderDoubleSpace constructor')
        }
    }

    override get plainString() {
        return '  '
    }

    override toJSON(): GenericTreeNode<SchemaDoubleSpaceTag> {
        return {
            data: { tag: 'DoubleSpace' as const },
            children: []
        }
    }

    override toNDJSON() {
        return this.toJSON()
    }
    
    override clone() {
        return new StandardRenderDoubleSpace(this.toJSON())
    }
}

export default StandardRenderDoubleSpace
