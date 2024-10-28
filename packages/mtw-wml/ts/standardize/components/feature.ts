import { excludeUndefined } from "../../lib/lists"
import { isSchemaFeature, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardFeatureData } from "./dataTypes/feature"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"

export class StandardFeature extends StandardComponentWithNameAndDesc {
    tag = 'Feature' as const
    constructor(args: StandardFeatureData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            if (!isSchemaFeature(args.data)) {
                throw new Error('Type mismatch in StandardFeature constructor')
            }
        }
    }

    override toJSON(): StandardFeatureData {
        return {
            key: this.key,
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

    override merge(incoming: StandardComponentAbstract): StandardFeature {
        if (!(incoming instanceof StandardFeature)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const superMerge = super.merge(incoming)
        const args: StandardFeatureData = {
            ...superMerge.toJSON(),
            tag: 'Feature',
        }
        return new StandardFeature(args)
    }
}

export default StandardFeature
