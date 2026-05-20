import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { componentDisplayLabel } from "../../../../lib/componentDisplayLabel"
import { ReferenceListItem } from "./ReferenceListEditorGeneric"

type ComponentTag =
    | "Character"
    | "Map"
    | "Room"
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
        .map<ReferenceListItem>((ref, index) => {
            const universalKey = ref.universalKey
            const component = universalKey ? standardForm.byUniversalId[universalKey] : undefined

            const title = component
                ? (componentDisplayLabel(component, { standardForm, fallbackLabel: "Untitled" }) ?? "Untitled")
                : "Untitled"

            return {
                id: universalKey ?? ref.standardKey.key ?? `${index}`,
                title
            }
        })
}
