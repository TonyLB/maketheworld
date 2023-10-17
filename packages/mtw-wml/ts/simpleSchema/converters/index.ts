import {
    SchemaAssetLegalContents,
    SchemaAssetTag,
    SchemaStoryTag,
    isSchemaAssetContents,
} from "../../schema/baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry } from "./baseClasses"
import { validateProperties } from "./utils"
import { characterConverters } from "./character"
import { componentConverters } from "./components"
import { computationConverters } from "./computation"
import { conditionalConverters } from "./conditionals"
import { importExportConverters } from "./importExport"
import { messagingConverters } from "./messaging"
import { taggedMessageConverters } from "./taggedMessages"

const validationTemplates = {
    Asset: {
        key: { required: true, type: ParsePropertyTypes.Key }
    },
    Story: {
        key: { required: true, type: ParsePropertyTypes.Key },
        instance: { required: true, type: ParsePropertyTypes.Boolean }
    },
} as const

export const converterMap: Record<string, ConverterMapEntry> = {
    Asset: {
        initialize: ({ parseOpen }): SchemaAssetTag => ({
            tag: 'Asset',
            contents: [],
            Story: undefined,
            ...validateProperties(validationTemplates.Asset)(parseOpen)
        }),
        legalContents: isSchemaAssetContents,
        finalize: (initialTag: SchemaAssetTag, contents: SchemaAssetLegalContents[] ): SchemaAssetTag => ({
            ...initialTag,
            contents
        })
    },
    Story: {
        initialize: ({ parseOpen }): SchemaStoryTag => ({
            tag: 'Story',
            contents: [],
            Story: true,
            ...validateProperties(validationTemplates.Story)(parseOpen)
        }),
        legalContents: isSchemaAssetContents,
        finalize: (initialTag: SchemaAssetTag, contents: SchemaAssetLegalContents[] ): SchemaAssetTag => ({
            ...initialTag,
            contents
        })
    },
    ...characterConverters,
    ...componentConverters,
    ...computationConverters,
    ...conditionalConverters,
    ...importExportConverters,
    ...messagingConverters,
    ...taggedMessageConverters,
}

export default converterMap
