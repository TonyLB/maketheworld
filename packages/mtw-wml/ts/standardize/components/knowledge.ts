import { excludeUndefined } from "../../lib/lists"
import { isSchemaKnowledge, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { isStandardKnowledge, StandardComponentData } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import { editWrap, unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"

export class StandardKnowledge extends editWrap(class StandardKnowledge extends StandardComponentWithNameAndDesc implements ComponentInterface {
    tag = 'Knowledge' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (isSchemaTreeNode(payload)) {
            if (!isSchemaKnowledge(payload.data)) {
                throw new Error('Type mismatch in StandardKnowledge constructor')
            }
        }
        else {
            if (!isStandardKnowledge(payload)) {
                throw new Error('Type mismatch in StandardKnowledge constructor')
            }
        }
    }

    override toJSON(): StandardKnowledgeData {
        return {
            key: this.key,
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
}, 'StandardKnowledge'){}

export default StandardKnowledge
