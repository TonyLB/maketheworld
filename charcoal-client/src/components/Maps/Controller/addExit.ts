import { UpdateSchemaPayload } from "../../../slices/personalAssets/reducers"
import { isStandardRoom, StandardForm } from "@tonylb/mtw-wml/dist/standardize/baseClasses";

export const addExitFactory = ({ standardForm, updateSchema, parentId }: { standardForm: StandardForm, updateSchema: (action: UpdateSchemaPayload) => void, parentId: string }) => ({ to, from }: { to: string; from: string }) => {
    const destinationComponent = standardForm.byId[to]
    const children = (destinationComponent && isStandardRoom(destinationComponent))
        ? destinationComponent.shortName.children
        : []
    updateSchema({
        type: 'addChild',
        id: parentId,
        item: {
            data: { tag: 'Room', key: from },
            children: [
                { data: { tag: 'Exit', key: `${from}#${to}`, from, to }, children }
            ]
        }
    })
}
