import { isSchemaImage, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { isStandardImage, SerializeNDJSONMixin } from "../baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import StandardComponentAbstract, { ComponentInterface, HasFileAssociation } from "./abstract"
import { StandardImageData } from "./dataTypes/image"
import { editWrap } from "./editable"
import { isSchemaTreeNode } from "./utils"

export class StandardImage extends editWrap(class StandardImage extends StandardComponentAbstract implements ComponentInterface, HasFileAssociation {
    tag = 'Image' as const
    _fileAssociation?: string;
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (isStandardImage(payload) && ('fileName' in payload as any) && typeof (payload as any).fileName === 'string') {
            this._fileAssociation = (payload as any).fileName
            return
        }
        if (!payload || (typeof payload === 'string' && isLegalKey(payload)) || isStandardImage(payload)) {
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            if (treeNodeTypeguard(isSchemaImage)(node)) {
                return
            }
        }
        throw new Error('Type mismatch in StandardImage constructor')
    }

    override toJSON(): StandardImageData {
        return {
            ...super.toJSON(),
            tag: 'Image'
        }
    }

    toNDJSON(args: { from?: { assetId: string; key: string; }; exportAs?: string; }): StandardImageData & SerializeNDJSONMixin {
        return {
            ...this.toJSON(),
            fileName: this._fileAssociation,
            exportAs: args.exportAs,
            from: args.from
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Image', key: this.key },
            children: []
        }
    }

    get fileAssociation() { return this._fileAssociation }

    override clone(): this {
        return new StandardImage(this.toJSON()).withFileAssociation(this._fileAssociation) as this
    }

    override merge(incoming: this): this | undefined {
        if (incoming.key !== this.key || !(incoming instanceof StandardImage)) {
            throw new Error('Source mismatch in StandardAction merge')
        }
        const returnValue = this.clone()
        return returnValue
    }

    withFileAssociation(fileName: string | undefined): this {
        const returnValue = this.clone()
        returnValue._fileAssociation = fileName
        return returnValue
    }
    
}, 'StandardImge'){}

export default StandardImage
