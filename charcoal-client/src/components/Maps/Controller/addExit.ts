import { UpdateSchemaPayload } from "../../../slices/personalAssets/reducers"
import { isStandardRoom, StandardForm } from "@tonylb/mtw-wml/dist/standardize/baseClasses";

export const addExitFactory = ({ standardForm, combinedStandardForm, updateSchema, addImport, parentId }: { standardForm: StandardForm, combinedStandardForm: StandardForm, updateSchema: (action: UpdateSchemaPayload) => void, addImport: (key: string) => void, parentId: string }) => ({ to, from }: { to: string; from: string }) => {
    const destinationComponent = combinedStandardForm.byId[to]
    const children = (destinationComponent && isStandardRoom(destinationComponent))
        ? destinationComponent.shortName.children
        : []
    if (!(to in standardForm)) {
        addImport(to)
    }
    if (!(from in standardForm)) {
        addImport(from)
    }
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
