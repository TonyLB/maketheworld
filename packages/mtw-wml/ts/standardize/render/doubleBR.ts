import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { StandardRenderAbstract, StandardRenderElement } from "./baseClasses"
import { isSchemaDoubleBR, SchemaDoubleBRTag } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isRenderTreeNode } from "@tonylb/mtw-base/ts/renderTree"

export class StandardRenderDoubleBR extends StandardRenderAbstract implements StandardRenderElement {
    constructor(arg: any) {
        super()
        if (!(isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaDoubleBR(arg.data) && arg.children.length === 0)) {
            throw new Error('Invalid argument to StandardRenderDoubleBR constructor')
        }
    }

    override get plainString(): string {
        return '\n\n'
    }

    override toJSON(): GenericTreeNode<SchemaDoubleBRTag> {
        return {
            data: { tag: 'DoubleBR' as const },
            children: []
        }
    }

    override toNDJSON() {
        return this.toJSON()
    }

    override clone() {
        return new StandardRenderDoubleBR(this.toJSON())
    }
}

export default StandardRenderDoubleBR
