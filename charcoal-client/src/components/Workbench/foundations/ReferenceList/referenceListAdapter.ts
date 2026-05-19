import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import StandardSituation from "@tonylb/mtw-wml/ts/standardize/components/situation"
import { situationIdToLabel } from "../../../../lib/situationLabel"
import { ReferenceListItem } from "./ReferenceListEditorGeneric"
import type { ComponentUUID } from "@tonylb/mtw-base/ts/schema"

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

            let title = "Untitled"

            if (component && component instanceof StandardSituation && universalKey) {
                title = situationIdToLabel(universalKey as ComponentUUID, standardForm)
            } else if (component && (component as any).shortName) {
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
