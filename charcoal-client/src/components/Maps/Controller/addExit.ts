import { GenericTree } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { isStandardRoom, StandardForm } from "@tonylb/mtw-wml/dist/standardize/baseClasses";
import { isSchemaString, SchemaOutputTag, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { ignoreWrapped } from "@tonylb/mtw-wml/dist/schema/utils";

const schemaOutputLowerCase = (tree: GenericTree<SchemaOutputTag>): GenericTree<SchemaOutputTag> => (
    tree.map(({ data, children }) => ({
        data: isSchemaString(data) ? { ...data, value: data.value.toLowerCase() } : data,
        children: schemaOutputLowerCase(children)
    }))
)

export const addExitFactory = ({ standardForm, combinedStandardForm, updateSelected, selectedPositions, addImport }: { standardForm: StandardForm, combinedStandardForm: StandardForm, updateSelected: (newTree: GenericTree<SchemaTag>) => void, selectedPositions: GenericTree<SchemaTag>, addImport: (key: string) => void }) => ({ to, from }: { to: string; from: string }) => {
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
