import Normalizer from "@tonylb/mtw-wml/dist/normalize";
import { NormalForm } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { isSchemaRoom } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"
import { UpdateNormalPayload } from "../../../slices/personalAssets/reducers"
import { SimNode } from "../Edit/MapDThree/baseClasses"

//
// TODO: Refactor stabilizeFactory to take advantage of normalReference data incoming from MapD3
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
    // const normalMap = normalForm[mapId || '']
    // if (mapId && isNormalMap(normalMap)) {
    //     let nameSet = false
    //     const newPositions: Record<string, { x: number; y: number; }> = values.reduce((previous: Record<string, { x: number; y: number }>, { roomId, x, y }: { roomId: string; x: number; y: number }) => ({
    //         ...previous,
    //         [roomId]: { x: Math.round(x), y: Math.round(y) }
    //     }), {} as Record<string, { x: number; y: number; }>)

    //     //
    //     // TODO: Right now this update is very naive about the possibility of multiple layers.  Make it smarter as the layer-handling
    //     // functionality of MapEdit becomes more sophisticated
    //     //
    //     const { tag, appearances = [] } = normalMap
    //     const normalizer = new Normalizer()
    //     normalizer._normalForm = normalForm
    //     appearances.forEach((appearance, index) => {
    //         const { contextStack } = appearance
    //         const reference: NormalReference = { tag, key: mapId, index }
    //         if (!contextStack.find(({ tag }) => (tag === 'If'))) {
    //             const baseSchema = normalizer.referenceToSchema(reference)
    //             if (isSchemaMap(baseSchema)) {
    //                 const roomContents = baseSchema.contents
    //                     .map((item) => (isSchemaRoom(item)
    //                         ? {
    //                             ...item,
    //                             ...(newPositions[item.key] || {})
    //                         } as SchemaRoomTag
    //                         : item
    //                     ))

    //                 if (!deepEqual(baseSchema.contents, nameSet ? [] : roomContents)) {
    //                     const position = normalizer._referenceToInsertPosition(reference)
    //                     updateNormal({
    //                         type: 'put',
    //                         item: {
    //                             ...baseSchema,
    //                             contents: nameSet ? [] : roomContents,
    //                             rooms: nameSet ? [] : extractConditionedItemFromContents({
    //                                 contents: roomContents as SchemaMapLegalContents[],
    //                                 typeGuard: isSchemaRoom,
    //                                 transform: ({ key, x, y }, index) => ({ conditions: [], key, x: x ?? 0, y: y ?? 0, index })
    //                             }),
    //                         },
    //                         position: { ...position, replace: true },
    //                     })
    //                 }
    //                 nameSet = true
    //             }
    //         }
    //     })

    // }
}