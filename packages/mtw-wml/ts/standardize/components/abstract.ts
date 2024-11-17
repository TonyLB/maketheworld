import { SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaShortNameTag, SchemaTag } from "../../schema/baseClasses";
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses";
import { EditWrappedStandardNode } from "../baseClasses";
import { StandardBaseData } from "./dataTypes/abstract"
import { isSchemaTreeNode } from "./utils";

export interface ComponentInterface {
    key: string;
    schema: GenericTreeNode<SchemaTag>;
    clone(): this;
    toJSON(): Record<string, any>;
    merge(incoming: this): this | undefined;
}

export class StandardComponentAbstract implements ComponentInterface {
    _key: string;
    _remove?: boolean;
    constructor(...args: any[]) {
        const payload = args[0]
        if (isSchemaTreeNode(payload) && treeNodeTypeguard((data): data is { key: string } => (Boolean(data && ('key' in data) && (data as any).key)))(payload)) {
            const { data } = payload
            this._key = data.key
        }
        else if (payload && ('key' in payload)) {
            this._key = payload.key
        }
        else {
            throw new Error('Cannot convert non-keyed schema item to StandardComponent')
        }

    }

    get key(): string {
        return this._key
    }

    get schema(): GenericTreeNode<SchemaTag> {
        throw new Error('Cannot call schema on abstract class')
    }

    get isRemove() { return false }
    get isReplace() { return false }
    get match(): StandardComponentAbstract | undefined { return undefined }
    get payload(): StandardComponentAbstract { return this }

    toJSON(): StandardBaseData {
        return { key: this.key }
    }

    clone(): this {
        throw new Error('Cannot call clone on abstract class')
    }
    
    merge(incoming: this): this | undefined {
        throw new Error('Cannot call merge on abstract class')
    }
}

export interface HasName {
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
}

export interface HasDescription {
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
}

export interface HasShortName {
    shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
}

export default StandardComponentAbstract
