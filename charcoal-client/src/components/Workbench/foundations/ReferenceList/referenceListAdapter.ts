import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { ReferenceListItem } from "./ReferenceListEditorGeneric"

type ComponentTag =
    | "Character"
    | "Map"
    | "Room"
    | "Feature"
    | "Knowledge"
    | "Example"
    | "Guidance"
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

            let title = "Untitled"

            if (component && (component as any).shortName) {
                const shortNameData = (component as any).shortName?._payload?.plain?.toJSON()
                if (typeof shortNameData === "string" && shortNameData.trim().length) {
                    title = shortNameData
                }
            }

            return {
                id: universalKey ?? ref.standardKey.key ?? `${index}`,
                title
            }
        })
}
