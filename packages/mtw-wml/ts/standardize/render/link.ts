import { GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { StandardRenderElement, StandardRenderAbstract } from "./baseClasses"
import { isSchemaLink, SchemaLinkTag } from "@tonylb/mtw-base/ts/schema/renderTree";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema";
import { isRenderTreeNode } from "@tonylb/mtw-base/ts/renderTree";

export class StandardRenderLink extends StandardRenderAbstract implements StandardRenderElement {
    _to: string;
    _text: string;

    constructor(arg: any) {
        super()
        if (isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaLink(arg.data)) {
            this._to = arg.data.to
            this._text = arg.data.text
        }
        else {
            throw new Error('Invalid argument to StandardRenderLink constructor')
        }
    }

    override get plainString() {
        return `${this._text}`
    }

    override toJSON(): GenericTreeNodeFiltered<SchemaLinkTag, SchemaOutputTag> {
        return {
            data: { tag: 'Link' as const, to: this._to, text: this._text },
            children: [{ data: { tag: 'String' as const, value: this._text }, children: [] }]
        }
    }

    override toNDJSON() {
        return {
            data: { tag: 'Link' as const, to: this._to, text: this._text },
            children: []
        }
    }    
}

export default StandardRenderLink