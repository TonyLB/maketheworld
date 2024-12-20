import { isSchemaString, SchemaStringTag } from "../../schema/baseClasses";
import { GenericTreeNode } from "../../tree/baseClasses";
import { StandardRenderElement } from "./baseClasses"

export class StandardRenderString implements StandardRenderElement {
    _text: string;

    constructor(arg: any) {
        if (typeof arg === 'string') {
            this._text = arg
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
            }
        }
        throw new Error('Invalid argument to StandardRenderString constructor')
    }

    get plainString() {
        return this._text
    }

    toJSON(): GenericTreeNode<SchemaStringTag> {
        return {
            data: { tag: 'String' as const, value: this._text },
            children: []
        }
    }

    toNDJSON() {
        return this._text
    }
}