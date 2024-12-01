import { excludeUndefined } from "../../lib/lists"
import { isSchemaKnowledge, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { isStandardKnowledge } from "../baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import { ComponentInterface } from "./abstract"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import { editWrap } from "./editable"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { ndjsonWrap } from "./ndjson"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"

export class StandardKnowledge extends ndjsonWrap(editWrap(class StandardKnowledge extends StandardComponentWithNameAndDesc implements ComponentInterface {
    tag = 'Knowledge' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (!payload || (typeof payload === 'string' && isLegalKey(payload)) || isStandardKnowledge(payload)) {
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            if (isSchemaKnowledge(node.data)) {
                return
            }
        }
        throw new Error('Type mismatch in StandardKnowledge constructor')
    }

    override toJSON(): StandardKnowledgeData {
        return {
            ...super.toJSON(),
            tag: 'Knowledge',
            name: this.name,
            description: this.description
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return  {
            data: { tag: 'Knowledge', key: this.key },
            children: [this.name, this.description].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1)
        }
    }

    override clone(): this {
        return new StandardKnowledge(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (!(incoming instanceof StandardKnowledge)) {
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
}, 'StandardKnowledge')){}

export default StandardKnowledge
