import { SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag } from "../../schema/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardBaseData } from "./dataTypes/abstract"

type NameAndDesc = {
    name: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
}

export class StandardComponentWithNameAndDesc extends StandardComponentAbstract {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    constructor(args: StandardBaseData & Partial<NameAndDesc>) {
        super(args)
        this._name = args.name
        this._description = args.description
    }

    get name() {
        return this._name
    }

    get description() {
        return this._description
    }
}

export default StandardComponentWithNameAndDesc

