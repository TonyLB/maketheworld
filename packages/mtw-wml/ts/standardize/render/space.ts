import { isSchemaString, SchemaSpacerTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { StandardRenderElement } from "./baseClasses"
import { isRenderTreeNode } from "./utils"

export class StandardRenderSpace implements StandardRenderElement {
    constructor(arg: any) {
        if (!(isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaString(arg.data) && arg.children.length === 0)) {
            throw new Error('Invalid argument to StandardRenderSpace constructor')
        }
    }

    get plainString() {
        return ' '
    }

    toJSON(): GenericTreeNode<SchemaSpacerTag> {
        return {
            data: { tag: 'Space' as const },
            children: []
        }
    }

    toNDJSON() {
        return ' '
    }    
}
