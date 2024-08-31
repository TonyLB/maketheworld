import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { UpdateSchemaPayload } from "../../../slices/personalAssets/reducers"
import { isStandardRoom, StandardForm } from "@tonylb/mtw-wml/dist/standardize/baseClasses";
import { isSchemaString, SchemaOutputTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { ignoreWrapped } from "@tonylb/mtw-wml/dist/schema/utils";

const schemaOutputLowerCase = (tree: GenericTree<SchemaOutputTag>): GenericTree<SchemaOutputTag> => (
    tree.map(({ data, children }) => ({
        data: isSchemaString(data) ? { ...data, value: data.value.toLowerCase() } : data,
        children: schemaOutputLowerCase(children)
    }))
)

export const addExitFactory = ({ standardForm, combinedStandardForm, updateSchema, addImport, parentId }: { standardForm: StandardForm, combinedStandardForm: StandardForm, updateSchema: (action: UpdateSchemaPayload) => void, addImport: (key: string) => void, parentId: string }) => ({ to, from }: { to: string; from: string }) => {
    const destinationComponent = combinedStandardForm.byId[to]
    const children = (destinationComponent && isStandardRoom(destinationComponent))
        ? ignoreWrapped(destinationComponent.shortName)?.children ?? []
        : []
    if (!(to in standardForm)) {
        addImport(to)
    }
    if (!(from in standardForm)) {
        addImport(from)
    }
    //
    // TODO: ISS-4347: Create updateSelection function in mapContext which allows updates localized to the
    // place in the ancestor-hierarchy of the selection (as recorded in mapTree) that is legal
    // for the action in question
    //
    // TODO: Use updateSelection in place of updateStandard to make the update to the appropriate
    // place in the mapTree hierarchy automatically.
    //

    // updateSchema({
    //     type: 'addChild',
    //     id: parentId,
    //     item: {
    //         data: { tag: 'Room', key: from },
    //         children: [
    //             {
    //                 data: { tag: 'Exit', key: `${from}#${to}`, from, to },
    //                 children: schemaOutputLowerCase(children)
    //             }
    //         ]
    //     }
    // })
}
