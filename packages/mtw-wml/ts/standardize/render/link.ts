import { isSchemaLink, SchemaLinkTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { StandardRenderElement } from "./baseClasses"
import { isRenderTreeNode } from "./utils"

export class StandardRenderLink implements StandardRenderElement {
    _to: string;
    _text: string;

    constructor(arg: any) {
        if (isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaLink(arg.data) && arg.children.length === 0) {
            this._to = arg.data.to
            this._text = arg.data.text
        }
        else {
            throw new Error('Invalid argument to StandardRenderLink constructor')
        }
    }

    get plainString() {
        return `${this._text}`
    }

    toJSON(): GenericTreeNode<SchemaLinkTag> {
        return {
            data: { tag: 'Link' as const, to: this._to, text: this._text },
            children: []
        }
    }

    toNDJSON() {
        return {
            data: { tag: 'Link' as const, to: this._to, text: this._text },
            children: []
        }
    }    
}
