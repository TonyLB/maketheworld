import { StandardEditableData, editWrappedTypeguard } from "@tonylb/mtw-base/ts/editable"
import { StandardReferenceData, isStandardReferenceData } from "../../dataTypes/reference"
import { isStandardLiteralData } from "../../../literal"

export type ExitEdgePayloadData = {
    forward?: StandardEditableData<string>
    back?: StandardEditableData<string>
}

export type StandardExitEdgeData = {
    tag: 'Exit'
    uuid: string
    from: StandardEditableData<StandardReferenceData>
    to: StandardEditableData<StandardReferenceData>
    payload: ExitEdgePayloadData
}

export const isExitEdgePayloadData = (arg: unknown): arg is ExitEdgePayloadData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    const payload = arg as ExitEdgePayloadData
    if ('forward' in payload && payload.forward !== undefined && !isStandardLiteralData(payload.forward)) {
        return false
    }
    if ('back' in payload && payload.back !== undefined && !isStandardLiteralData(payload.back)) {
        return false
    }
    return true
}

export const isStandardExitEdgeData = (arg: unknown): arg is StandardExitEdgeData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    if (!('tag' in arg) || (arg as StandardExitEdgeData).tag !== 'Exit') {
        return false
    }
    const referenceEditable = editWrappedTypeguard(isStandardReferenceData)
    return typeof (arg as StandardExitEdgeData).uuid === 'string'
        && referenceEditable((arg as StandardExitEdgeData).from)
        && referenceEditable((arg as StandardExitEdgeData).to)
        && isExitEdgePayloadData((arg as StandardExitEdgeData).payload)
}

export const isStandardExitEdgeEnvelope = (arg: unknown): arg is StandardEditableData<StandardExitEdgeData> => {
    return editWrappedTypeguard(isStandardExitEdgeData)(arg)
}
