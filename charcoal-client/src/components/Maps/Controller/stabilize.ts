import Normalizer from "@tonylb/mtw-wml/dist/normalize";
import { NormalForm } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { isSchemaRoom } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"
import { UpdateNormalPayload } from "../../../slices/personalAssets/reducers"
import { SimNode } from "../Edit/MapDThree/baseClasses"

//
// TODO: Refactor stabilizeFactory to use incoming Schema TreeId rather than in-built reference
//
export const stabilizeFactory = (props: { normalForm: NormalForm; mapId: string; updateNormal: (action: UpdateNormalPayload) => void }) => (values: SimNode[]) => {
    const { mapId, normalForm, updateNormal } = props
    const normalizer = new Normalizer()
    normalizer._normalForm = normalForm
    values.forEach(({ reference, x, y }) => {
        const previousSchema = normalizer.referenceToSchema(reference)
        if (previousSchema && isSchemaRoom(previousSchema) && (previousSchema.x !== Math.round(x) || previousSchema.y !== Math.round(y))) {
            updateNormal({
                type: 'put',
                item: {
                    ...previousSchema,
                    x: Math.round(x),
                    y: Math.round(y)
                },
                position: { ...normalizer._referenceToInsertPosition(reference), replace: true }
            })
        }
    })
}