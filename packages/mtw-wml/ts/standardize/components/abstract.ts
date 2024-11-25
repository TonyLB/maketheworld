import { unique } from "../../list";
import { Schema } from "../../schema";
import { isSchemaWithKey, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaShortNameTag, SchemaTag } from "../../schema/baseClasses";
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses";
import { EditWrappedStandardNode, SerializeNDJSONMixin } from "../baseClasses";
import { isLegalKey, nodeFromWML } from "../utils";
import { StandardBaseData } from "./dataTypes/abstract"
import { isSchemaTreeNode } from "./utils";

export interface ComponentInterface {
    key: string;
    universalKey?: string;
    schema: GenericTreeNode<SchemaTag>;
    clone(): this;
    toJSON(): Record<string, any>;
    merge(incoming: this): this | undefined;
    withUniversalKey(key: string): this;
}

export class StandardComponentAbstract implements ComponentInterface {
    _key: string;
    _remove?: boolean;
    _universalKey?: string;
    constructor(...args: any[]) {
        const payload = args[0]
        if (!payload) {
            this._key = ''
        }
        else if (typeof payload === 'string') {
            if (isLegalKey(payload)) {
                this._key = payload
            }
            else {
                const node = nodeFromWML(payload)
                if (!treeNodeTypeguard(isSchemaWithKey)(node)) {
                    throw new Error('Cannot convert non-keyed schema item to StandardComponent')
                }
                this._key = node.data.key
            }
        }
        else if (isSchemaTreeNode(payload) && treeNodeTypeguard((data): data is { key: string } => (Boolean(data && ('key' in data) && (data as any).key)))(payload)) {
            const { data } = payload
            this._key = data.key
        }
        else if (payload && ('key' in payload)) {
            this._key = payload.key
            if ('universalKey' in payload) {
                this._universalKey = payload.universalKey
            }
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
    get universalKey(): string | undefined { return this._universalKey}

    toJSON(): StandardBaseData & SerializeNDJSONMixin {
        return {
            key: this.key,
            universalKey: this.universalKey
        }
    }

    clone(): this {
        throw new Error('Cannot call clone on abstract class')
    }
    
    merge(incoming: this): this | undefined {
        throw new Error('Cannot call merge on abstract class')
    }

    withUniversalKey(key: string): this {
        const returnValue = this.clone()
        returnValue._universalKey = key
        return returnValue
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

export interface HasFileAssociation {
    fileAssociation?: string;
    withFileAssociation(fileName: string): this;
}

export default StandardComponentAbstract
