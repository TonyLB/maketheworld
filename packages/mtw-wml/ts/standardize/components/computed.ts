import { isSchemaComputed, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardComputedData } from "./dataTypes/computed"
import { isSchemaTreeNode } from "./utils"

export class StandardComputed extends StandardComponentAbstract {
    _src?: string;
    _dependencies?: string[];
    tag = 'Computed' as const
    constructor(args: StandardComputedData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            const { data } = args
            if (!isSchemaComputed(data)) {
                throw new Error('Type mismatch in StandardRoom constructor')
            }
            this._src = data.src
            this._dependencies = data.dependencies
        }
        else {
            this._src = args.src
            this._dependencies = args.dependencies
        }
    }

    get src() { return this._src }
    get dependencies() { return this._dependencies }

    override toJSON(): StandardComputedData {
        return {
            key: this.key,
            tag: 'Computed',
            src: this.src ?? '',
            dependencies: this.dependencies
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Computed', key: this.key, src: this.src ?? '', dependencies: this.dependencies },
            children: []
        }
    }

    override merge(incoming: StandardComponentAbstract): StandardComputed {
        if (!(incoming instanceof StandardComputed)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const args: StandardComputedData = {
            key: this.key,
            tag: 'Computed',
            src: incoming.src ?? this.src ?? '',
            dependencies: incoming.dependencies ?? this.dependencies
        }
        return new StandardComputed(args)
    }
}

export default StandardComputed
