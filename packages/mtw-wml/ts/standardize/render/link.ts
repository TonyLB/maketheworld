import { GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { StandardRenderElement, StandardRenderAbstract } from "./baseClasses"
import { isSchemaLink, SchemaLinkTag } from "@tonylb/mtw-base/ts/schema/renderTree";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema";
import { isRenderTreeNode } from "@tonylb/mtw-base/ts/renderTree";
import StandardReference, { StandardKey } from "../components/reference";
import { ReferenceFormat } from "../components/utils/references";

export class StandardRenderLink extends StandardRenderAbstract implements StandardRenderElement {
    _to: string | StandardKey;
    _text: string;

    constructor(arg: any) {
        super()
        if (arg instanceof StandardRenderLink) {
            this._to = arg._to
            this._text = arg._text
            return
        }
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
            data: { tag: 'Link' as const, to: this._to instanceof StandardKey ? this._to.universalKey ?? this._to.key ?? '' : this._to, text: this._text },
            children: [{ data: { tag: 'String' as const, value: this._text }, children: [] }]
        }
    }

    override toNDJSON() {
        return {
            data: { tag: 'Link' as const, to: this._to instanceof StandardKey ? this._to.universalKey ?? this._to.key ?? '' : this._to, text: this._text },
            children: []
        }
    }

    override clone() {
        return new StandardRenderLink(this)
    }

    override remapReferences({ mapping, mapTo }: { mapping: StandardKey[]; mapTo: ReferenceFormat }): this {
        const returnValue = this.clone() as this
        if (this._to instanceof StandardKey) {
            const mappedReference = new StandardReference(this._to).lookup(mapping).toFormat(mapTo)
            returnValue._to = mappedReference.standardKey
        }
        else {
            const findMatch = mapping.find(({ key, universalKey }) => (key === this._to || universalKey === this._to))
            if (findMatch) {
                returnValue._to = new StandardReference(findMatch).lookup(mapping).toFormat(mapTo).standardKey
            }
        }
        return returnValue
    }
}

export default StandardRenderLink