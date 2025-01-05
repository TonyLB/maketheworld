import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { isStandardRoom } from "@tonylb/mtw-wml/ts/standardize/baseClasses";
import { ignoreWrapped } from "@tonylb/mtw-wml/ts/schema/utils";
import { StandardFormData } from "@tonylb/mtw-wml/ts/standardize/components/dataTypes";
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree";

const schemaOutputLowerCase = (tree: GenericTree<SchemaOutputTag>): GenericTree<SchemaOutputTag> => (
    tree.map(({ data, children }) => ({
        data: isSchemaString(data) ? { ...data, value: data.value.toLowerCase() } : data,
        children: schemaOutputLowerCase(children)
    }))
)

export const addExitFactory = ({ standardForm, updateSelected, selectedPositions, addImport }: { standardForm: StandardFormData, updateSelected: (newTree: GenericTree<SchemaTag>) => void, selectedPositions: GenericTree<SchemaTag>, addImport: (key: string) => void }) => ({ to, from }: { to: string; from: string }) => {
    const destinationComponent = standardForm.byId[to]
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
    // Use updateSelection to make the update to the appropriate
    // place in the mapTree hierarchy automatically.
    //

    updateSelected([
        ...selectedPositions,
        {
            data: { tag: 'Room', key: from },
            children: [
                {
                    data: { tag: 'Exit', key: `${from}#${to}`, from, to },
                    children: schemaOutputLowerCase(children)
                }
            ]
        }
    ])
}
