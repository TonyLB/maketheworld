import { excludeUndefined } from "../../lib/lists"
import { isSchemaFeature, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { isStandardFeature, StandardComponentData } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardFeatureData } from "./dataTypes/feature"
import { unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"

export class StandardFeature extends StandardComponentWithNameAndDesc implements ComponentInterface {
    _match?: StandardFeature;
    tag = 'Feature' as const
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (match) {
            this._match = new StandardFeature(match)
        }
        if (isSchemaTreeNode(payload)) {
            if (!isSchemaFeature(payload.data)) {
                throw new Error('Type mismatch in StandardFeature constructor')
            }
        }
        else {
            if (!isStandardFeature(payload)) {
                throw new Error('Type mismatch in StandardAction constructor')
            }
        }
    }

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    override toJSON(): StandardFeatureData | StandardRemoveData | StandardReplaceData {
        return wrapJSON<StandardFeature, StandardFeatureData>(this, (value) => ({
            key: value.key,
            tag: 'Feature',
            name: value.name,
            description: value.description
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return wrapSchema(this, (value: StandardFeature) => ({
            data: { tag: 'Feature', key: value.key },
            children: [value.name, value.description].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1)
        }))
    }

    override clone(): this {
        return new StandardFeature(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (!(incoming instanceof StandardFeature)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        return wrapMerge<StandardFeature>(this, incoming, StandardFeature, (base, incoming) => {
            const superMerge = super.merge.bind(base)(incoming as this)
            if (!superMerge) {
                throw new Error('Merge failure in StandardRoom')
            }
            const args: StandardFeatureData = {
                ...superMerge.toJSON(),
                tag: 'Feature',
            }
            return new StandardFeature(args)
        }) as this | undefined
    }
}

export default StandardFeature
