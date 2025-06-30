import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";
import { isStandardReferencePayloadData, StandardReferenceData } from "./reference"

export type StandardPositionData = {
    room: StandardReferenceData;
    x: number;
    y: number;
}

export const isSimplePositionData = (arg: any): arg is StandardPositionData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkTypes({
        required: { x: CheckTypes.NUMBER, y: CheckTypes.NUMBER },
        values: {
            room: (room: any) => (isStandardReferencePayloadData(room))
        }
    })(arg)
}