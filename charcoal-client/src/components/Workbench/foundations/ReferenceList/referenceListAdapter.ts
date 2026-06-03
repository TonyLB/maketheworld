import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { componentDisplayLabel } from "../../../../lib/componentDisplayLabel"
import { ReferenceListItem } from "./ReferenceListEditorGeneric"

type ComponentTag =
    | "Character"
    | "Map"
    | "Room"
    | "Area"
    | "Feature"
    | "Knowledge"
    | "Guidance"
    | "Situation"
    | "Lens"
    | "Mark"
    | "Message"

export const referenceListToItems = ({
    referenceList,
    standardForm,
    tag
}: {
    referenceList: ReferenceList
    standardForm: StandardForm
    tag?: ComponentTag
}): ReferenceListItem[] => {
    const references = referenceList.payload

    return references
        .filter((ref) => {
            if (!tag) {
                return true
            }
            return ref.tag === tag
        })
        .map<ReferenceListItem>((ref) => {
            const universalKey = ref.universalKey
            if (!universalKey) {
                throw new Error(
                    'ReferenceList row requires universalKey; do not use local key as list item id'
                )
            }
            const component = standardForm.byUniversalId[universalKey]

            const title = component
                ? (componentDisplayLabel(component, { standardForm, fallbackLabel: "Untitled" }) ?? "Untitled")
                : "Untitled"

            return {
                id: universalKey,
                title
            }
        })
}
