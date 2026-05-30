import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { StandardLiteral } from "../../literal"
import { ExitEdgePayloadData } from "./dataTypes/exitEdge"

export class ExitEdgePayload {
    _forward?: StandardLiteral
    _back?: StandardLiteral

    constructor(arg?: ExitEdgePayloadData | ExitEdgePayload) {
        if (arg instanceof ExitEdgePayload) {
            this._forward = arg._forward ? new StandardLiteral(arg._forward, { tag: 'Forward' }) : undefined
            this._back = arg._back ? new StandardLiteral(arg._back, { tag: 'Back' }) : undefined
            return
        }
        if (arg && typeof arg === 'object') {
            this._forward = arg.forward ? new StandardLiteral(arg.forward, { tag: 'Forward' }) : undefined
            this._back = arg.back ? new StandardLiteral(arg.back, { tag: 'Back' }) : undefined
        }
    }

    get forward(): StandardLiteral | undefined { return this._forward }
    get back(): StandardLiteral | undefined { return this._back }

    toJSON(): ExitEdgePayloadData {
        return {
            ...(this._forward ? { forward: this._forward.toJSON() } : {}),
            ...(this._back ? { back: this._back.toJSON() } : {}),
        }
    }

    schemaChildren(): import("@tonylb/mtw-base/ts/genericTree").GenericTree<import("@tonylb/mtw-base/ts/schema").SchemaTag> {
        return [
            ...(this._forward ? this._forward.nestedSchema({ tag: 'Forward' }) : []),
            ...(this._back ? this._back.nestedSchema({ tag: 'Back' }) : []),
        ]
    }

    merge(incoming: ExitEdgePayload): ExitEdgePayload | undefined {
        const mergedForward = mergeLiteral(this._forward, incoming._forward)
        const mergedBack = mergeLiteral(this._back, incoming._back)
        if (!mergedForward && !mergedBack) {
            return undefined
        }
        const result = new ExitEdgePayload()
        result._forward = mergedForward
        result._back = mergedBack
        return result
    }

    diff(incoming: ExitEdgePayload | undefined): ExitEdgePayload | undefined {
        if (!incoming) {
            return this.invert()
        }
        const diffForward = diffLiteral(this._forward, incoming._forward)
        const diffBack = diffLiteral(this._back, incoming._back)
        if (!diffForward && !diffBack) {
            return undefined
        }
        const result = new ExitEdgePayload()
        result._forward = diffForward
        result._back = diffBack
        return result
    }

    invert(): ExitEdgePayload {
        const result = new ExitEdgePayload()
        result._forward = this._forward ? this._forward.invert() as StandardLiteral : undefined
        result._back = this._back ? this._back.invert() as StandardLiteral : undefined
        return result
    }

    equals(other: ExitEdgePayload): boolean {
        return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON())
    }

    lookup(mappings: import("../reference").LookupMappings): ExitEdgePayload {
        return this
    }

    toFormat(_format: import("../../components/utils/references").ReferenceFormat, _mappings?: import("../reference").LookupMappings): ExitEdgePayload {
        return this
    }
}

const mergeLiteral = (left?: StandardLiteral, right?: StandardLiteral): StandardLiteral | undefined => {
    if (left && right) {
        if (left.equals(right)) {
            return left
        }
        return left.merge(right) as StandardLiteral | undefined
    }
    return left ?? right
}

const diffLiteral = (left?: StandardLiteral, right?: StandardLiteral): StandardLiteral | undefined => {
    if (left && right) {
        return left.diff(right) as StandardLiteral | undefined
    }
    if (left && !right) {
        return left.invert() as StandardLiteral
    }
    if (!left && right) {
        return right
    }
    return undefined
}

export const createExitEdgePayloadFromSchemaChildren = (
    forwardNodes: import("@tonylb/mtw-base/ts/genericTree").GenericTree<import("@tonylb/mtw-base/ts/schema").SchemaTag>,
    backNodes: import("@tonylb/mtw-base/ts/genericTree").GenericTree<import("@tonylb/mtw-base/ts/schema").SchemaTag>
): ExitEdgePayload => {
    return new ExitEdgePayload({
        ...(forwardNodes.length ? { forward: new StandardLiteral(forwardNodes, { tag: 'Forward' }).toJSON() as StandardEditableData<string> } : {}),
        ...(backNodes.length ? { back: new StandardLiteral(backNodes, { tag: 'Back' }).toJSON() as StandardEditableData<string> } : {}),
    })
}
