import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { UpdateStandardPayload } from "../../../slices/personalAssets/reducers";
import { StandardExit } from "@tonylb/mtw-wml/ts/standardize/components/exit";

const schemaOutputLowerCase = (tree: GenericTree<SchemaOutputTag>): GenericTree<SchemaOutputTag> => (
    tree.map(({ data, children }) => ({
        data: isSchemaString(data) ? { ...data, value: data.value.toLowerCase() } : data,
        children: schemaOutputLowerCase(children)
    }))
)

export const addExitFactory = ({ standardForm, editable, addImport, updateStandard }: {
    standardForm: StandardForm,
    editable: StandardForm,
    addImport: (key: `ROOM#${string}`) => void,
    updateStandard: (action: UpdateStandardPayload) => void
}) => ({ to, from }: { to: `ROOM#${string}`; from: `ROOM#${string}` }) => {
    const destinationComponent = standardForm.byUniversalId[to]
    const exitName = (destinationComponent && destinationComponent instanceof StandardRoom)
        ? destinationComponent.shortName?._payload?.plain?.toJSON()?.toLowerCase() ?? ''
        : ''
    if (!(editable.byUniversalId[to])) {
        addImport(to)
    }
    if (!(from in standardForm)) {
        addImport(from)
    }

    //
    // Use updateStandard to add the exit to the source room
    //
    updateStandard({
        type: 'update',
        update: (standard) => {
            const draft = standard._clone()
            const sourceComponent = draft.byUniversalId[from]
            if (sourceComponent && sourceComponent instanceof StandardRoom) {
                const newExit = new StandardExit({
                    from,
                    to,
                    name: exitName
                })
                sourceComponent.exits.push(newExit)
            }
            return draft
        }
    })
}
