import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties, validateExpressionAsNonNegativeInteger, parsePositionCoordinates } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaExit, isSchemaFeature, isSchemaGuidance, isSchemaKnowledge, isSchemaMap, isSchemaObject, isSchemaPosition, isSchemaRoom, isSchemaShortName, isSchemaParent, isSchemaFrom, isSchemaTo, isSchemaForward, isSchemaBack, isSchemaKey, isSchemaSituation, isSchemaArea, isSchemaRender, SchemaExitTag, SchemaFeatureTag, SchemaGuidanceTag, SchemaKnowledgeTag, SchemaMapTag, SchemaObjectTag, SchemaPositionTag, SchemaRoomTag, SchemaShortNameTag, SchemaParentTag, SchemaFromTag, SchemaToTag, SchemaKeyTag, SchemaSituationTag, SchemaAreaTag, SchemaRenderTag } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaDescription, isSchemaDisplayName, isSchemaSummary } from "@tonylb/mtw-base/ts/schema/prose"
import { isSchemaString, SchemaStringTag } from "@tonylb/mtw-base/ts/schema/renderTree"
import { SchemaTag, isSchemaAsset, isSchemaCharacter, isSchemaComponent, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit"
import { PrintMode, PrintMapResult } from "@tonylb/mtw-base/ts/schema/printMap"
import { literalTagFactory } from "@tonylb/mtw-base/ts/schema/literalTagFactory"
import { enforceTypedKey, stripTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { isLegalKey } from "../../standardize/utils"
import { splitTaggedChildren } from "../utils"

const componentTemplates = {
    Exit: {
        to: { type: ParsePropertyTypes.Key },
        uuid: { type: ParsePropertyTypes.Key }
    },
    Description: {},
    Summary: {},
    DisplayName: {},
    ShortName: {},
    Instructions: {},
    Default: {},
    Parent: {},
    From: {},
    To: {},
    Forward: {},
    Back: {},
    Key: {},
    Object: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        ref: { type: ParsePropertyTypes.Expression }
    },
    Render: {},
    Room: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        display: { type: ParsePropertyTypes.Literal },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    },
    Feature: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    },
    Knowledge: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    },
    Position: {
        DEFAULT: { required: true, type: ParsePropertyTypes.Expression },
    },
    Map: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    },
    Area: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    },
    Guidance: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    },
    Situation: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    }
} as const

const { converter: shortNameConverter, printMap: shortNamePrintMap } = literalTagFactory('ShortName')
const { converter: instructionsConverter, printMap: instructionsPrintMap } = literalTagFactory('Instructions')
const { converter: defaultConverter, printMap: defaultPrintMap } = literalTagFactory('Default')
const { converter: forwardConverter, printMap: forwardPrintMap } = literalTagFactory('Forward')
const { converter: backConverter, printMap: backPrintMap } = literalTagFactory('Back')

const isSchemaExitLegalContents = (item: SchemaTag): boolean => (
    isSchemaString(item) ||
    isSchemaFrom(item) ||
    isSchemaTo(item) ||
    isSchemaForward(item) ||
    isSchemaBack(item) ||
    isSchemaRemove(item) ||
    isSchemaReplace(item)
)

const exitEndpointTagRenderLiteral = (
    typeGuard: (schema: unknown) => schema is SchemaFromTag | SchemaToTag
) => ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments): PrintMapResult[] => {
    if (!typeGuard(tag)) {
        return [{ printMode: PrintMode.naive, output: '' }]
    }
    if (children.length === 0) {
        return [{ printMode: PrintMode.naive, output: `<${tag.tag} />` }]
    }
    const textValue = children.map(({ data }) => (data)).filter(isSchemaString).map(({ value }) => (value)).join('') as string
    const naive = `<${tag.tag}>${textValue}</${tag.tag}>`
    if (naive.length + Math.min(10, args.options.indent * 4) > 80) {
        return [
            { printMode: PrintMode.nested, output: `<${tag.tag}>` },
            { printMode: PrintMode.nested, output: `    ${textValue}` },
            { printMode: PrintMode.nested, output: `</${tag.tag}>` }
        ]
    }
    else {
        return [{ printMode: PrintMode.naive, output: `<${tag.tag}>${textValue}</${tag.tag}>` }]
    }
}

const exitEndpointTagConverter = (
    tagName: 'From' | 'To',
    typeGuard: (schema: unknown) => schema is SchemaFromTag | SchemaToTag
): ConverterMapEntry => ({
    initialize: ({ parseOpen, contextStack }): SchemaFromTag | SchemaToTag => {
        const hasExitContext = contextStack.some(({ data }) => isSchemaExit(data))
        if (!hasExitContext) {
            throw new Error(`${tagName} tag can only be used inside an Exit`)
        }
        validateProperties(componentTemplates[tagName])(parseOpen)
        return { tag: tagName }
    },
    typeCheckContents: (item: SchemaTag): boolean => isSchemaString(item),
    finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaFromTag | SchemaToTag, SchemaStringTag> => {
        if (!typeGuard(initialTag)) {
            throw new Error('Type mismatch on schema finalize')
        }
        if (children.length === 0) {
            return {
                data: { tag: tagName },
                children: []
            }
        }
        const textValue = children
            .map(({ data }) => data)
            .filter(isSchemaString)
            .map(({ value }) => value)
            .join('')
        if (!isSchemaComponentUUID(textValue) && !isLegalKey(textValue)) {
            throw new Error(`${tagName} tag content must be a ComponentUUID or legalKey, got: ${textValue}`)
        }
        return {
            data: { tag: tagName },
            children: children.map(({ data }) => data).filter(isSchemaString).map(({ value }) => ({ data: { tag: 'String' as const, value }, children: [] }))
        }
    }
})

// Parent tag converter - similar to Literal but constrained to ComponentUUID content
// and can only be placed inside ComponentUUID tags
const parentTagRenderLiteral = ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments): PrintMapResult[] => {
    if (!isSchemaParent(tag)) {
        return [{ printMode: PrintMode.naive, output: '' }]
    }
    // Handle empty Parent tags (self-closing)
    if (children.length === 0) {
        return [{ printMode: PrintMode.naive, output: `<${tag.tag} />` }]
    }
    const textValue = children.map(({ data }) => (data)).filter(isSchemaString).map(({ value }) => (value)).join('') as string
    const naive = `<${tag.tag}>${textValue}</${tag.tag}>`
    if (naive.length + Math.min(10, args.options.indent * 4) > 80) {
        return [
            { printMode: PrintMode.nested, output: `<${tag.tag}>` },
            { printMode: PrintMode.nested, output: `    ${textValue}` },
            { printMode: PrintMode.nested, output: `</${tag.tag}>` }
        ]
    }
    else {
        return [{ printMode: PrintMode.naive, output: `<${tag.tag}>${textValue}</${tag.tag}>` }]
    }
}

// Key tag converter - similar to Parent but constrained to legalKey content
// and can only be placed inside ComponentUUID tags
const keyTagRenderLiteral = ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments): PrintMapResult[] => {
    if (!isSchemaKey(tag)) {
        return [{ printMode: PrintMode.naive, output: '' }]
    }
    const textValue = children.map(({ data }) => (data)).filter(isSchemaString).map(({ value }) => (value)).join('') as string
    const naive = `<${tag.tag}>${textValue}</${tag.tag}>`
    if (naive.length + Math.min(10, args.options.indent * 4) > 80) {
        return [
            { printMode: PrintMode.nested, output: `<${tag.tag}>` },
            { printMode: PrintMode.nested, output: `    ${textValue}` },
            { printMode: PrintMode.nested, output: `</${tag.tag}>` }
        ]
    }
    else {
        return [{ printMode: PrintMode.naive, output: `<${tag.tag}>${textValue}</${tag.tag}>` }]
    }
}

export const componentConverters: Record<string, ConverterMapEntry> = {
    Exit: {
        initialize: ({ parseOpen }): SchemaExitTag => {
            const { to, uuid, ...rest } = validateProperties(componentTemplates.Exit)(parseOpen)
            return {
                tag: 'Exit',
                ...(to !== undefined ? { to } : {}),
                ...(uuid !== undefined ? { uuid } : {}),
                ...rest
            }
        },
        typeCheckContents: isSchemaExitLegalContents,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaExitTag, SchemaTag> => {
            if (!isSchemaExit(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children
            }
        }
    },
    ShortName: shortNameConverter,
    Instructions: instructionsConverter,
    Default: defaultConverter,
    Forward: forwardConverter,
    Back: backConverter,
    From: exitEndpointTagConverter('From', isSchemaFrom),
    To: exitEndpointTagConverter('To', isSchemaTo),
    Parent: {
        initialize: ({ parseOpen, contextStack }): SchemaParentTag => {
            // Validate that Parent tag is inside a ComponentUUID
            const hasComponentContext = contextStack.some(({ data }) => isSchemaComponent(data))
            if (!hasComponentContext) {
                throw new Error(`Parent tag can only be used inside a ComponentUUID (Room, Feature, etc.)`)
            }
            // Validate properties using componentTemplates (Parent has no properties)
            validateProperties(componentTemplates.Parent)(parseOpen)
            return { tag: 'Parent' }
        },
        typeCheckContents: (item: SchemaTag): boolean => {
            // Parent can only contain String tags (ComponentUUID may be split across multiple strings)
            // The combined result will be validated in finalize
            return isSchemaString(item)
        },
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaParentTag, SchemaStringTag> => {
            if (!isSchemaParent(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            // Allow empty Parent tags (to express "no parent")
            if (children.length === 0) {
                return {
                    data: { tag: 'Parent' },
                    children: []
                }
            }
            // If not empty, validate that the combined string content is a ComponentUUID or legalKey
            const textValue = children
                .map(({ data }) => data)
                .filter(isSchemaString)
                .map(({ value }) => value)
                .join('')
            if (!isSchemaComponentUUID(textValue) && !isLegalKey(textValue)) {
                throw new Error(`Parent tag content must be a ComponentUUID or legalKey, got: ${textValue}`)
            }
            return {
                data: { tag: 'Parent' },
                children: children.map(({ data }) => data).filter(isSchemaString).map(({ value }) => ({ data: { tag: 'String' as const, value }, children: [] }))
            }
        }
    },
    Key: {
        initialize: ({ parseOpen, contextStack }): SchemaKeyTag => {
            // Validate that Key tag is inside a ComponentUUID
            const hasComponentContext = contextStack.some(({ data }) => isSchemaComponent(data))
            if (!hasComponentContext) {
                throw new Error(`Key tag can only be used inside a ComponentUUID (Room, Feature, etc.)`)
            }
            // Validate properties using componentTemplates (Key has no properties)
            validateProperties(componentTemplates.Key)(parseOpen)
            return { tag: 'Key' }
        },
        typeCheckContents: (item: SchemaTag): boolean => {
            // Key can only contain String tags (legalKey may be split across multiple strings)
            // The combined result will be validated in finalize
            return isSchemaString(item)
        },
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaKeyTag, SchemaStringTag> => {
            if (!isSchemaKey(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            // Key tags cannot be empty
            if (children.length === 0) {
                throw new Error('Key tag must contain a legalKey value')
            }
            // Validate that the combined string content is a legalKey
            const textValue = children
                .map(({ data }) => data)
                .filter(isSchemaString)
                .map(({ value }) => value)
                .join('')
            if (!isLegalKey(textValue)) {
                throw new Error(`Key tag content must be a legalKey, got: ${textValue}`)
            }
            return {
                data: { tag: 'Key' },
                children: children.map(({ data }) => data).filter(isSchemaString).map(({ value }) => ({ data: { tag: 'String' as const, value }, children: [] }))
            }
        }
    },
    Object: {
        initialize: ({ parseOpen, contextStack }): SchemaObjectTag => {
            const hasRoomContext = contextStack.some(({ data }) => isSchemaRoom(data))
            const hasAssetContext = contextStack.some(({ data }) => isSchemaAsset(data))
            if (!hasRoomContext && !hasAssetContext) {
                throw new Error('Object tag can only be used inside a Room or Asset')
            }
            const { uuid, key, ref } = validateProperties(componentTemplates.Object)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            const uuidTrimmed = (uuid ?? '').trim()
            if (!uuidTrimmed) {
                throw new Error('Object tag must have a non-empty uuid')
            }
            return {
                tag: 'Object',
                uuid: enforceTypedKey('OBJECT')(uuidTrimmed),
                ...(key ? { key } : {}),
                ...(refValue !== undefined ? { ref: refValue } : {}),
            }
        },
        typeCheckContents: (item: SchemaTag): boolean => (
            isSchemaShortName(item) || isSchemaSituation(item) || isSchemaReplace(item) || isSchemaRemove(item)
        ),
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaObjectTag, SchemaTag> => {
            if (!isSchemaObject(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            const uuidTrimmed = (initialTag.uuid ?? '').trim()
            if (!uuidTrimmed) {
                throw new Error('Object tag must have a non-empty uuid')
            }
            const uuidNormalized = enforceTypedKey('OBJECT')(uuidTrimmed)
            // Respects Remove/Replace wrappers around ShortName (see splitTaggedChildren), so an
            // incremental edit (e.g. merge/diff round-trip) satisfies the "must have a ShortName"
            // requirement without needing a literal, fully-resolved <ShortName> child.
            const { matched: shortNameMatches, remainder: otherChildren } = splitTaggedChildren({ children, tag: 'ShortName' })
            if (shortNameMatches.length === 0) {
                throw new Error('Object tag must contain exactly one ShortName child')
            }
            if (shortNameMatches.length > 1) {
                throw new Error('Object tag must contain exactly one ShortName child')
            }
            const [shortNameMatch] = shortNameMatches
            let shortNameChildren: GenericTree<SchemaTag>
            if (isSchemaShortName(shortNameMatch.data)) {
                // Bare ShortName: canonicalize to a single trimmed String child, as before.
                const textValue = shortNameMatch.children
                    .map(({ data }) => data)
                    .filter(isSchemaString)
                    .map(({ value }) => value)
                    .join('')
                    .trim()
                if (!textValue) {
                    throw new Error('Object ShortName must contain non-empty text after trim')
                }
                shortNameChildren = [{
                    data: { tag: 'ShortName' },
                    children: [{ data: { tag: 'String' as const, value: textValue }, children: [] }],
                }]
            }
            else {
                // Remove/Replace-wrapped ShortName edit: the final text only exists after merge,
                // so preserve the edit node as-is rather than trying to resolve/validate it here.
                shortNameChildren = [shortNameMatch]
            }
            return {
                data: { tag: 'Object', uuid: uuidNormalized },
                children: [
                    ...shortNameChildren,
                    ...otherChildren,
                ],
            }
        },
    },
    /**
     * PROVISIONAL: Room `<Render>` parse rules are stricter than ideal for ephemera placeholders and
     * partial facet payloads. `finalize` requires three ordered children and non-empty DisplayName
     * text after trim, which forces workarounds (for example `PLACEHOLDER_RENDER_INVISIBLE_TITLE` in
     * `lambda/ephemera/dataSource/perception/orchestrate.ts`). When relaxing this contract, update
     * emit paths (for example `SituationRoomFacetPayload.toProseTripletChildren` and
     * `situationRoomRenderPayloadFromCacheRenderedContent` in the ephemera lambda) and remove those
     * placeholders in the same change set so WML round-trip stays coherent.
     *
     * Character joined this whitelist alongside Room/Feature/Knowledge once Character's own
     * ephemera-wire render path landed (`lambda/ephemera/dataSource/perception/
     * characterRenderWmlFromCacheRecord.ts`) --- `StandardCharacterData.render` already existed for
     * JSON/ephemera-wire construction (Phase 1 of the objectCharacterRenderHosts iteration), but the
     * parse-time whitelist here was deliberately left behind pending that consumer. Object's `render`
     * field remains data-layer-only; its own whitelist entry is still deferred until Object has a real
     * (non-shortName-stub) render path.
     */
    Render: {
        initialize: ({ parseOpen, contextStack }): SchemaRenderTag => {
            const hasEphemeraRenderParent = contextStack.some(({ data }) => (
                isSchemaRoom(data) || isSchemaFeature(data) || isSchemaKnowledge(data) || isSchemaCharacter(data)
            ))
            if (!hasEphemeraRenderParent) {
                throw new Error('Render tag can only be used inside a Room, Feature, Knowledge, or Character')
            }
            validateProperties(componentTemplates.Render)(parseOpen)
            return { tag: 'Render' }
        },
        typeCheckContents: (item: SchemaTag): boolean => (
            isSchemaDisplayName(item) || isSchemaSummary(item) || isSchemaDescription(item)
        ),
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaRenderTag, SchemaTag> => {
            if (!isSchemaRender(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            if (children.length !== 3) {
                throw new Error('Render tag must contain exactly three children: DisplayName, Summary, Description in order')
            }
            const [first, second, third] = children
            if (!isSchemaDisplayName(first.data) || !isSchemaSummary(second.data) || !isSchemaDescription(third.data)) {
                throw new Error('Render children must be DisplayName, Summary, Description in order')
            }
            const displayNameChildren = compressWhitespace(first.children)
            const summaryChildren = compressWhitespace(second.children)
            const descriptionChildren = compressWhitespace(third.children)
            const displayNameText = displayNameChildren
                .map(({ data }) => data)
                .filter(isSchemaString)
                .map(({ value }) => value)
                .join('')
                .trim()
            if (!displayNameText) {
                throw new Error('Render DisplayName must contain non-empty text after trim')
            }
            return {
                data: { tag: 'Render' },
                children: [
                    { data: { tag: 'DisplayName' }, children: displayNameChildren },
                    { data: { tag: 'Summary' }, children: summaryChildren },
                    { data: { tag: 'Description' }, children: descriptionChildren },
                ],
            }
        },
    },
    Room: {
        initialize: ({ parseOpen }): SchemaRoomTag => {
            const { uuid, ref, ...rest } = validateProperties(componentTemplates.Room)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Room',
                uuid: uuid ? enforceTypedKey('ROOM')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        }
    },
    Feature: {
        initialize: ({ parseOpen }): SchemaFeatureTag => {
            const { uuid, ref, ...rest } = validateProperties(componentTemplates.Feature)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Feature',
                uuid: uuid ? enforceTypedKey('FEATURE')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        }
    },
    Knowledge: {
        initialize: ({ parseOpen }): SchemaKnowledgeTag => {
            const { uuid, ref, ...rest } = validateProperties(componentTemplates.Knowledge)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Knowledge',
                uuid: uuid ? enforceTypedKey('KNOWLEDGE')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        }
    },
    Position: {
        initialize: ({ parseOpen }): SchemaPositionTag => {
            const { DEFAULT } = validateProperties(componentTemplates.Position)(parseOpen)
            if (typeof DEFAULT === 'undefined') {
                throw new Error(`Position tag must have DEFAULT property with comma-separated coordinates`)
            }
            const coordinates = parsePositionCoordinates(DEFAULT as string, 'DEFAULT', parseOpen.tag)
            return {
                tag: 'Position', x: coordinates.x, y: coordinates.y
            }
        }
    },
    Map: {
        initialize: ({ parseOpen }): SchemaMapTag => {
            const { uuid, ref, ...rest } = validateProperties(componentTemplates.Map)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Map',
                uuid: uuid ? enforceTypedKey('MAP')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        },
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaMapTag, SchemaTag> => {
            if (!isSchemaMap(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children
            }
        }
    },
    Guidance: {
        initialize: ({ parseOpen }): SchemaGuidanceTag => {
            const { uuid, ref, ...rest } = validateProperties(componentTemplates.Guidance)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Guidance',
                uuid: uuid ? enforceTypedKey('GUIDANCE')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        }
    },
    Situation: {
        initialize: ({ parseOpen }): SchemaSituationTag => {
            const { uuid, ref, ...rest } = validateProperties(componentTemplates.Situation)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Situation',
                uuid: uuid ? enforceTypedKey('SITUATION')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        }
    },
    Area: {
        initialize: ({ parseOpen }): SchemaAreaTag => {
            const { uuid, ref, ...rest } = validateProperties(componentTemplates.Area)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Area',
                uuid: uuid ? enforceTypedKey('AREA')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        }
    }
}

export const componentPrintMap: Record<string, PrintMapEntry> = {
    Exit: ({ tag: { data: tag, children }, ...args }) => {

        const { context, persistentOnly } = args.options
        if (!isSchemaExit(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        const isTopologyShape = Boolean(tag.uuid) ||
            children.some(({ data }) => isSchemaFrom(data) || isSchemaTo(data) || isSchemaForward(data) || isSchemaBack(data))

        if (persistentOnly && !tag.to && !tag.uuid) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }

        if (isTopologyShape) {
            return tagRender({
                ...args,
                tag: 'Exit',
                properties: [
                    ...(tag.uuid ? [{ key: 'uuid', type: 'key' as const, value: tag.uuid }] : []),
                ],
                node: { data: tag, children }
            })
        }

        const roomsContextList = context.filter(isSchemaRoom)
        const roomContext: SchemaTag | undefined = roomsContextList.length > 0 ? roomsContextList.slice(-1)[0] : undefined
        const roomContextTypecheck = (roomContext: SchemaTag | undefined): roomContext is SchemaRoomTag | undefined => (!roomContext || isSchemaRoom(roomContext))
        if (!roomContextTypecheck(roomContext)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Exit',
            //
            // Do not render to/from properties when they can be derived from the room context
            //
            properties: [
                { key: 'to', type: 'key' as 'key', value: tag.to ?? '' },
            ],
            node: { data: tag, children }
        })
    },
    ShortName: shortNamePrintMap,
    Instructions: instructionsPrintMap,
    Default: defaultPrintMap,
    Forward: forwardPrintMap,
    Back: backPrintMap,
    From: exitEndpointTagRenderLiteral(isSchemaFrom),
    To: exitEndpointTagRenderLiteral(isSchemaTo),
    Parent: parentTagRenderLiteral,
    Key: keyTagRenderLiteral,
    Object: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaObject(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Object',
            properties: [
                ...(tag.uuid ? [{ key: 'uuid', type: 'key' as const, value: stripTypedKey('OBJECT')(tag.uuid) }] : []),
                ...(tag.key ? [{ key: 'key', type: 'key' as const, value: tag.key }] : []),
            ],
            node: { data: tag, children },
        })
    },
    Render: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaRender(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Render',
            properties: [],
            node: { data: tag, children },
        })
    },
    Room: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        //
        // Reassemble the contents out of name and description fields
        //
        if (!isSchemaRoom(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Room',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('ROOM')(tag.uuid) : '' },
                ...(tag.key ? [{ key: 'key', type: 'key' as const, value: tag.key }] : []),
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref !== undefined ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })

    },
    Feature: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        //
        // Reassemble the contents out of name and description fields
        //
        if (!isSchemaFeature(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Feature',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('FEATURE')(tag.uuid) : '' },
                ...(tag.key ? [{ key: 'key', type: 'key' as const, value: tag.key }] : []),
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref !== undefined ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })
    },
    Knowledge: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        //
        // Reassemble the contents out of name and description fields
        //
        if (!isSchemaKnowledge(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Knowledge',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('KNOWLEDGE')(tag.uuid) : '' },
                { key: 'key', type: 'key', value: tag.key ?? '' },
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref !== undefined ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })
    },
    Position: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaPosition(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Position',
            properties: [
                //
                // Render coordinates as DEFAULT expression property: {x, y}
                //
                { key: undefined, type: 'expression', value: `${tag.x}, ${tag.y}` }
            ],
            node: { data: tag, children }
        })
    },
    Map: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaMap(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Map',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('MAP')(tag.uuid) : '' },
                { key: 'key', type: 'key', value: tag.key ?? '' },
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref !== undefined ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })
    },
    Guidance: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaGuidance(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Guidance',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('GUIDANCE')(tag.uuid) : '' },
                ...(tag.key ? [{ key: 'key', type: 'key' as const, value: tag.key }] : []),
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref !== undefined ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })
    },
    Situation: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaSituation(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Situation',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('SITUATION')(tag.uuid) : '' },
                ...(tag.key ? [{ key: 'key', type: 'key' as const, value: tag.key }] : []),
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref !== undefined ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })
    },
    Area: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaArea(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Area',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('AREA')(tag.uuid) : '' },
                { key: 'key', type: 'key', value: tag.key ?? '' },
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref !== undefined ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })
    }
}