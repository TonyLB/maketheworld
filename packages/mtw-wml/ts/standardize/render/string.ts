import { isSchemaString, SchemaStringTag } from "../../schema/baseClasses";
import { GenericTreeNode } from "../../tree/baseClasses";
import { StandardRenderElement, StandardRenderAbstract } from "./baseClasses"

export class StandardRenderString extends StandardRenderAbstract implements StandardRenderElement {
    _text: string;

    constructor(arg: any) {
        super()
        if (typeof arg === 'string') {
            this._text = arg
            return
        }
        else if (typeof arg === 'object') {
            if (
                'data' in arg &&
                isSchemaString(arg.data) &&
                'children' in arg &&
                Array.isArray(arg.children) &&
                arg.children.length === 0
            ) {
                this._text = arg.data.value
                return
            }
        }
        throw new Error('Invalid argument to StandardRenderString constructor')
    }

    override get plainString() {
        return this._text
    }

    override toJSON(): GenericTreeNode<SchemaStringTag> {
        return {
            data: { tag: 'String' as const, value: this._text },
            children: []
        }
    }

    override toNDJSON() {
        return this._text
    }
}

export default StandardRenderString
