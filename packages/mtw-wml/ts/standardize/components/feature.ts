import { excludeUndefined } from "../../lib/lists"
import { isSchemaFeature, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { isStandardFeature } from "../baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import { ComponentInterface } from "./abstract"
import { StandardFeatureData } from "./dataTypes/feature"
import { editWrap } from "./editable"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { ndjsonWrap } from "./ndjson"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"

export class StandardFeature extends ndjsonWrap(editWrap(class StandardFeature extends StandardComponentWithNameAndDesc implements ComponentInterface {
    tag = 'Feature' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (!payload || (typeof payload === 'string' && isLegalKey(payload)) || isStandardFeature(payload)) {
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            if (isSchemaFeature(node.data)) {
                return
            }
        }
        throw new Error('Type mismatch in StandardAction constructor')
    }

    override toJSON(): StandardFeatureData {
        return {
            ...super.toJSON(),
            tag: 'Feature',
            name: this.name,
            description: this.description
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Feature', key: this.key },
            children: [this.name, this.description].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1)
        }
    }

    override clone(): this {
        return new StandardFeature(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (!(incoming instanceof StandardFeature)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const superMerge = super.merge(incoming as this)
        if (!superMerge) {
            throw new Error('Merge failure in StandardKnowledge')
        }
        const returnValue = this.clone() as this
        returnValue._name = superMerge.name
        returnValue._description = superMerge.description
        return returnValue
    }
}, 'StandardFeature')){}

export default StandardFeature
