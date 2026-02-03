# Guidance Component - Planning Document

**Date**: February 1, 2026  
**Status**: Planning - Phase 1–14, Phase 15, Phase 16 implemented; Phase 17 partially implemented (backend unit tests only); Schema Instructions Tag follow-up implemented  
**Component Type**: StandardGuidance (sibling to StandardExample)

## Overview

This document plans the implementation of a new `<Guidance>` component type in WML. Guidance components provide layered, general-terms instructions for rendering algorithms based on Mark-value combinations, complementing the specific word-for-word examples provided by Example components.

### Purpose

- **Guidance elements** provide general rendering instructions for specific Mark-value combinations
- **Example elements** provide exact word-for-word renders for complete Mark-value sets
- Together, they form a "multi-shot example teaching" + "layered guidance aggregation" system

### Key Differences from Examples

| Aspect | Guidance | Example |
|--------|----------|---------|
| **Scope** | Single Mark-value or small intersection | All Marks present on Room |
| **Content** | General instructions for rendering algorithm | Exact word-for-word render |
| **Render Fields** | No DisplayName, Summary, Description | Has DisplayName, Summary, Description |
| **Instructions Field** | Single `StandardLiteral` with guidance text | N/A |
| **Mark Coverage** | Sparse (0-3 Marks typical) | Dense (all Marks) |

### Demonstration Examples

**Demonstration #1**: Guidance on single Mark-value
```xml
<Guidance key=(dark-guidance)>
    <Mark uuid=(illumination-mark)><Match>Dark</Match></Mark>
    <Instructions>Mood is spooky, play up the stretching shadows and obscured corners</Instructions>
</Guidance>
```

**Demonstration #2**: Guidance on Mark intersection
```xml
<Guidance key=(moonlight-spirits-guidance)>
    <Mark uuid=(illumination-mark)><Match>Full moonlight</Match></Mark>
    <Mark uuid=(spirits-mark)><Match>Openly active</Match></Mark>
    <Instructions>Translucent spirits cavort in the moonlight, their lines reflecting silver, and their actions particularly potent in this magically charged environment</Instructions>
</Guidance>
```

**Demonstration #3**: Guidance with zero Marks (essence/default)
```xml
<Guidance key=(tavern-essence)>
    <Instructions>The tavern has a warm, welcoming atmosphere with worn wooden furniture and the smell of ale</Instructions>
</Guidance>
```

## Core Architecture

### Component Structure

**StandardGuidance** follows the standard component pattern:

- **Payload Class**: `StandardGuidancePayload` (implements `ComponentConstructorMethods<StandardGuidanceData>`)
- **Component Class**: `StandardGuidance` (extends `componentClassFactory(StandardGuidancePayload, 'StandardGuidance')`)
- **Data Type**: `StandardGuidanceData` (extends `StandardBaseData`)

### Content Properties

- `instructions?: StandardLiteral` - General guidance text for rendering algorithm (wrapped with `{ tag: 'Instructions' }`)
- `marks: MarkFacetList` - Mark-value combinations this guidance applies to (can be empty)
- `shortName?: StandardLiteral` - Optional short name for UI display (wrapped with `{ tag: 'ShortName' }`)

### Reference Properties

None - Guidance components do not contain reference lists.

### Key Design Decisions

1. **No render fields**: Unlike Examples, Guidance has no `displayName`, `summary`, or `description` fields
2. **Sparse Mark coverage**: Guidance typically specifies 0-3 Marks (focused guidance), not all Marks (like Examples)
3. **Zero-Mark support**: Guidance can exist with empty `MarkFacetList` for essence/default guidance
4. **StandardLiteral for instructions**: Simple string content, not `StandardRender` (no rich text needed)
5. **Room-only initially**: Start with `StandardRoom.guidance` reference list; expand to Feature/Knowledge in future iteration

## Implementation Phases

### Phase 1: WML Schema Layer (`@tonylb/mtw-base` package) — **Implemented**

**Location**: `packages/mtw-base/ts/schema/components.ts` and `packages/mtw-base/ts/schema/index.ts`

**Tasks**:
1. ~~Add `SchemaGuidanceTag` type definition~~ — Done. Implemented with `SchemaImportableBase` (same shape as other component tags in `components.ts`).
2. ~~Add `isSchemaGuidance` type guard~~ — Done. Implemented using `checkTypes` with required `tag`, optional `key`/`uuid`/`from`/`ref`, and `values` for `from`/`origin` (pattern from `example.ts`).
3. ~~Add `'Guidance'` to `SchemaComponent` union type~~ — Done (in `index.ts`).
4. ~~Add `'Guidance'` case to `isSchemaComponentTag()` function~~ — Done (in `index.ts`).
5. ~~Add `'Guidance'` case to `isSchemaComponent()` function~~ — No code change; `isSchemaComponent` uses `isSchemaComponentTag(value.tag)`, so adding `'Guidance'` to `isSchemaComponentTag` suffices.
6. ~~Add `'Guidance'` case to `isSchemaTag()` function~~ — Done (in `index.ts`).

**Also wired in `index.ts`**: `SchemaGuidanceTag` added to `SchemaTag`, `SchemaAssetLegalContents`, `SchemaWithContents`, `SchemaWithKey`; `isSchemaGuidance(value)` added to `isSchemaAssetContents`; `'Guidance'` added to `isSchemaWithContents`, `isSchemaWithKey`, and `isSchemaComponentTag` arrays.

**Reference**: See how `SchemaExampleTag` and `isSchemaExample` are implemented in `example.ts` (type guard uses `checkTypes`).

**Verification**: Schema layer treats Guidance as a valid component and asset content tag; `ComponentUUID`/`isSchemaComponentUUID` accept `GUIDANCE#...`. Full WML parsing of `<Guidance>` tags requires Phase 2 (converter registration).

---

### Phase 2: Schema Converter Registration — **Implemented**

**Location**: `packages/mtw-wml/ts/schema/converters/components.ts`

**Tasks**:
1. ~~Add prefix key to PrefixKey type~~ — Done. Added `'GUIDANCE'` to the `PrefixKey` union in `packages/mtw-utilities/ts/types.ts`.
2. ~~Import schema types~~ — Done. `isSchemaGuidance` and `SchemaGuidanceTag` imported from `@tonylb/mtw-base/ts/schema/components`.
3. ~~Add to componentTemplates~~ — Done. Guidance entry added with uuid, key, from, origin, ref.
4. ~~Add to componentConverters~~ — Done. Initialize function validates properties and enforces GUIDANCE-prefixed UUIDs.
5. ~~Add to componentPrintMap~~ — Done. Renders Guidance tag with optional uuid, key, from, origin, ref.

6. ~~Add Guidance to component sort order~~ — Done. Added `'Guidance'` to `componentKeys` in `referenceSortOrder` (`packages/mtw-wml/ts/standardize/keys/reference.ts`), positioned immediately before `'Example'`. Used by `SchemaOrganization.sortOrder()`, `keySortOrder`, and authorization sorting.

**Reference**: See `Example` entries in `componentTemplates`, `componentConverters`, and `componentPrintMap`

**Verification**: `<Guidance>` tags parse correctly from WML strings without "Cannot read properties of undefined" errors; Guidance sorts before Examples in reference/schema ordering.

---

### Phase 3: Component Type System — **Implemented**

**Location**: `packages/mtw-wml/ts/standardize/components/dataTypes/abstract.ts`

**Tasks**:
1. ~~Add `'Guidance'` to `ComponentTag` type union (should be automatic if `SchemaGuidanceTag` is in `SchemaWithKey`)~~ — Done.
2. ~~Add case to `componentTagFromUpperCase()`: `case 'GUIDANCE': return 'Guidance'`~~ — Done.

**Verification**: TypeScript compilation succeeds with `'Guidance'` as a valid `ComponentTag`. Full verification: TypeScript compiles; componentTagFromUpperCase('GUIDANCE') returns 'Guidance'; GUIDANCE#... ComponentUUIDs deserialize correctly.

**Reference**: Phase 3 required only the componentTagFromUpperCase case; ComponentTag already included 'Guidance' via SchemaWithKey.

---

### Phase 4: Component Data Types — **Implemented**

**Location**: Create `packages/mtw-wml/ts/standardize/components/dataTypes/guidance.ts`

**Tasks**:

1. ~~**Create `StandardGuidanceData` type**~~ — Done. Used `FacetListData<string>` for marks (not `MarkFacetData[]`) to match Example pattern.

2. ~~**Create `isStandardGuidanceData` type guard**~~ — Done. Imported `checkAll`/`checkTypes` from `./typeguards`; included `marks: 'facetList'` in checkTypes.

3. ~~**Export from `dataTypes/index.ts`**~~ — Done.

4. ~~**Add to `StandardComponentNonEditData` union**~~ — Done.

5. ~~**Add to `isStandardComponentData()` type guard**~~ — Done.

**Reference**: See `dataTypes/example.ts` for similar pattern with `marks` field

**Verification**: Data types compile; type guards accept valid Guidance data.

---

### Phase 5: Component Implementation — **Implemented**

**Location**: Create `packages/mtw-wml/ts/standardize/components/guidance.ts`

**Tasks**:

1. ~~**Create `StandardGuidancePayload` class**~~ — Done. Implemented in `guidance.ts` per spec (Instructions/ShortName as StandardLiteral, marks as MarkFacetList, fromSchema/fromJSON/toJSON/schema/merge/mapContents/remapReferences/nestedSchema/etc.).
   ```typescript
   import { excludeUndefined } from "../../lib/lists"
   import SchemaTagTree from "../../tagTree/schema"
   import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
   import { componentClassFactory, ComponentConstructorMethods } from "./component"
   import { StandardComponent, StandardComponentReferenceKey, NestedSchemaOptions } from "./baseClasses"
   import { StandardToJSONOptions } from "./baseClasses"
   import { StandardGuidanceData, StandardGuidanceNDJSONData } from "./dataTypes/guidance"
   import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
   import { isSchemaGuidance } from "@tonylb/mtw-base/ts/schema/components"
   import { deepEqual } from "../../lib/objects"
   import { StandardKey } from "../keys/key"
   import StandardReference from "../keys/reference"
   import { MarkFacetList, StandardMarkFacet } from "../keys/facets/mark"
   import { findTaggedChildren, recurseIntoEditable } from "../../schema/utils"
   import { StandardFormSubsetRequest } from "../baseClasses"
   import { StandardLiteral } from "../literal"
   import { HasShortName } from "./abstract"
   
   export class StandardGuidancePayload implements HasShortName, ComponentConstructorMethods<StandardGuidanceNDJSONData | StandardGuidanceData> {
       _instructions?: StandardLiteral;
       _shortName?: StandardLiteral;
       _marks: MarkFacetList;
       tag = 'Guidance' as const
   
       constructor(previous?: StandardGuidancePayload) {
           if (previous) {
               this._instructions = previous._instructions
               this._shortName = previous._shortName
               this._marks = previous._marks.clone()
           }
           else {
               this._marks = new MarkFacetList([])
           }
       }
   
       fromJSON(props: StandardGuidanceData | StandardGuidanceNDJSONData) {
           const { instructions, marks, shortName } = props
           this._instructions = instructions ? new StandardLiteral(instructions, { tag: 'Instructions' }) : undefined
           this._shortName = shortName ? new StandardLiteral(shortName, { tag: 'ShortName' }) : undefined
           this._marks = new MarkFacetList(marks ?? [])
       }
   
       fromSchema(node: GenericTreeNode<SchemaTag>) {
           if (treeNodeTypeguard(isSchemaGuidance)(node)) {
               const instructionsNode = findTaggedChildren({ children: node.children, tag: 'Instructions' })
               this._instructions = instructionsNode.length ? new StandardLiteral(instructionsNode, { tag: 'Instructions' }) : undefined
               
               const shortNameNode = findTaggedChildren({ children: node.children, tag: 'ShortName' })
               this._shortName = shortNameNode.length ? new StandardLiteral(shortNameNode, { tag: 'ShortName' }) : undefined
               
               // Parse Mark facets (only Marks with Match children)
               // findTaggedChildren handles Remove and Replace wrappers automatically
               const markNodes = findTaggedChildren({ children: node.children, tag: 'Mark' })
               
               // Helper function to check if a node contains Match children
               const hasMatchChild = (node: GenericTreeNode<SchemaTag>): boolean => {
                   return recurseIntoEditable(node, (contentNode) => {
                       const matchChildren = findTaggedChildren({ children: contentNode.children, tag: 'Match' })
                       return matchChildren.length > 0
                   }).some(result => result)
               }
               
               const parsedFacets = markNodes
                   .filter(hasMatchChild)
                   .map(markNode => {
                       return new StandardMarkFacet([markNode])
                   })
               this._marks = new MarkFacetList(parsedFacets)
               return
           }
           throw new Error('Schema mismatch in StandardGuidance constructor')
       }
   
       get instructions() { return this._instructions }
       get shortName() { return this._shortName }
       get marks() { return this._marks }
   
       toJSON(options?: StandardToJSONOptions): Omit<StandardGuidanceData, 'key' | 'universalKey'> {
           return {
               tag: 'Guidance',
               ...(this._instructions ? { instructions: this._instructions.toJSON() } : {}),
               ...(this._shortName ? { shortName: this._shortName.toJSON() } : {}),
               ...(this.marks.length ? { marks: this.marks.toJSON() } : {})
           }
       }
   
       toNDJSON(options?: StandardToJSONOptions): Omit<StandardGuidanceNDJSONData, 'key' | 'universalKey'> {
           return {
               tag: 'Guidance',
               ...(this._instructions ? { instructions: this._instructions.toJSON() } : {}),
               ...(this._shortName ? { shortName: this._shortName.toJSON() } : {}),
               ...(this.marks.length ? { marks: this.marks.toJSON() } : {})
           }
       }
   
       schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
           const children = [
               ...[this._shortName].filter(excludeUndefined).map((s) => s.nestedSchema()).flat(1),
               ...[this._instructions].filter(excludeUndefined).map((i) => i.nestedSchema()).flat(1),
               ...this.marks.items.map(facet => {
                   const ref = facet.reference as StandardReference
                   return ref.schema
               }).flat(1)
           ].filter(excludeUndefined)
           return {
               data: { tag: 'Guidance', key, uuid: universalKey },
               children
           }
       }
   
       subset({ requestType }: StandardFormSubsetRequest): this {
           if (requestType === 'Full') {
               return new StandardGuidancePayload(this) as this
           }
           const returnValue = new StandardGuidancePayload()
           return returnValue as this
       }
   
       merge(incoming: this): this {
           const returnValue = new StandardGuidancePayload()
           returnValue._instructions = (this._instructions && incoming._instructions) 
               ? this._instructions.merge(incoming._instructions) 
               : this._instructions ?? incoming._instructions
           returnValue._shortName = (this._shortName && incoming._shortName) 
               ? this._shortName.merge(incoming._shortName) 
               : this._shortName ?? incoming._shortName
           const mergedMarks = (this._marks && incoming._marks) 
               ? this._marks.merge(incoming._marks) 
               : this._marks ?? incoming._marks ?? new MarkFacetList([])
           returnValue._marks = mergedMarks ?? new MarkFacetList([])
           return returnValue as this
       }
   
       referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
           return this.marks.items.map((facet) => {
               const ref = facet.reference as StandardReference
               return { referenceType: 'Facet' as const, reference: ref }
           })
       }
   
       mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
           const returnValue = new StandardGuidancePayload(this)
           if (returnValue._shortName) {
               returnValue._shortName = returnValue._shortName.mapContents((value: string): string => {
                   const tree = callback([{ data: { tag: 'String', value }, children: [] }])
                   if (!tree.length) return ''
                   const first = tree[0]
                   if (!isSchemaString(first.data)) return ''
                   return first.data.value
               })
           }
           if (returnValue._instructions) {
               returnValue._instructions = returnValue._instructions.mapContents((value: string): string => {
                   const tree = callback([{ data: { tag: 'String', value }, children: [] }])
                   if (!tree.length) return ''
                   const first = tree[0]
                   if (!isSchemaString(first.data)) return ''
                   return first.data.value
               })
           }
           returnValue._marks = this._marks.mapContents((facet) => facet)
           return returnValue as this
       }
       
       remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
           const returnValue = new StandardGuidancePayload(this)
           returnValue._marks = this._marks.lookup(props.mappings).toFormat(props.mapTo)
           return returnValue as this
       }
   
       invert(): this {
           const returnValue = new StandardGuidancePayload()
           returnValue._instructions = this._instructions ? this._instructions.invert() as StandardLiteral : undefined
           returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
           returnValue._marks = this._marks.invert()
           return returnValue as this
       }
   
       isEmpty(): boolean {
           const hasInstructions = Boolean(this._instructions)
           const hasShortName = Boolean(this._shortName)
           const hasMarks = this._marks.length > 0
           return !(hasInstructions || hasShortName || hasMarks)
       }
   
       nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
           const { key } = options
   
           // Apply facet rendering for Mark facets
           const markNodes: GenericTreeNode<SchemaTag>[] = []
           for (const facet of this.marks.items) {
               const result = facet.renderFacet(undefined, lookup)
               if (result.aggregatedNode) {
                   markNodes.push(result.aggregatedNode)
               } else if (result.newNode) {
                   markNodes.push(result.newNode)
               }
           }
   
           const children = [
               ...[this._shortName].filter(excludeUndefined).map((s) => s.nestedSchema()).flat(1),
               ...[this._instructions].filter(excludeUndefined).map((i) => i.nestedSchema()).flat(1),
               ...markNodes
           ].filter(excludeUndefined)
   
           return {
               data: { tag: 'Guidance', key: key.key ?? '', uuid: key.universalKey },
               children
           }
       }
   }
   ```

2. ~~**Create `StandardGuidance` component class**~~ — Done. Implemented in `guidance.ts`; extends componentClassFactory, overrides _wrap/clone/equals, default export.
   ```typescript
   export class StandardGuidance extends componentClassFactory(StandardGuidancePayload, 'StandardGuidance') {
       get instructions() { return this._payload.instructions }
       get shortName() { return this._payload.shortName }
       get marks() { return this._payload.marks }
   
       constructor(props: string | StandardGuidanceData | StandardGuidanceNDJSONData | GenericTreeNode<SchemaTag> | StandardGuidance) {
           super(props)
       }
   
       override _wrap(instance: StandardComponent): this {
           return new StandardGuidance(instance as StandardGuidance) as this
       }
   
       override clone(): StandardGuidance {
           const returnValue = new StandardGuidance(this)
           returnValue._payload = new StandardGuidancePayload(this._payload)
           return returnValue
       }
   
       override equals(incoming: StandardComponent): boolean {
           if (!(incoming instanceof StandardGuidance)) {
               return false
           }
           return deepEqual(this.toJSON(), incoming.toJSON())
       }
   }
   
   export default StandardGuidance
   ```

**Reference**: See `example.ts` for similar pattern with `marks`, `shortName`, and simple content fields

**Key Patterns**:
- Use `StandardLiteral` for `instructions` and `shortName` (simple string content)
- Use `MarkFacetList` for `marks` (same as Example)
- Follow omission-over-empty principle in `toJSON()` and `toNDJSON()`
- Parse Mark facets from schema using `hasMatchChild` filter (same as Example)
- Implement `nestedSchema()` with facet rendering (same as Example)

**Verification**: Component constructs from JSON and WML, serializes correctly, merge/diff operations work. Verified by TypeScript compile (`npx tsc --noEmit` in package); optional dedicated tests may be added later.

---

### Schema Instructions Tag (follow-up) — **Implemented**

Phase 5 initially used type assertions (`'Instructions' as SchemaTag['tag']`) in `guidance.ts` because the `<Instructions>` child tag was not yet a first-class schema tag. That gap is closed so that WML parsing and printing handle `<Instructions>...</Instructions>` the same way as `<ShortName>...</ShortName>`.

**Base package (`@tonylb/mtw-base`)**:
- **tagType.ts**: Added `'Instructions'` to `SchemaTagType` and `isLegalSchemaTag`.
- **components.ts**: Added `SchemaInstructionsTag = SchemaLiteralTag<'Instructions'>` and `isSchemaInstructions` via `literalTagFactory<'Instructions'>('Instructions')`.
- **index.ts**: Imported and wired `SchemaInstructionsTag` / `isSchemaInstructions` into `SchemaAssetLegalContents`, `SchemaTag`, `SchemaWithContents`, `isSchemaWithContents`, `isSchemaAssetContents`, and `isSchemaTag`; extended `isSchemaLiteralTag` to include Instructions.

**WML package (`@tonylb/mtw-wml`)**:
- **schema/converters/components.ts**: Added `Instructions: {}` to `componentTemplates`; added `instructionsConverter` and `instructionsPrintMap` via `literalTagFactory('Instructions')`; registered in `componentConverters` and `componentPrintMap`.
- **standardize/components/guidance.ts**: Removed the three `as SchemaTag['tag']` casts; `'Instructions'` is now a valid `SchemaTag['tag']`.

**Reference**: Same pattern as `SchemaShortNameTag` / ShortName in base and converters.

---

### Phase 6: Factory Integration — **Implemented**

**Location**: `packages/mtw-wml/ts/standardize/componentFactory.ts`

**Tasks**:
1. ~~Import `StandardGuidance` and `isStandardGuidanceData`~~ — Done.
   ```typescript
   import { StandardGuidance } from './components/guidance'
   import { isStandardGuidanceData } from './components/dataTypes/guidance'
   ```
   Note: Implemented as `import StandardGuidance from "./components/guidance"` and `isStandardGuidanceData` from `"./components/dataTypes"`.

2. ~~Import `isSchemaGuidance`~~ — Done. Imported from `@tonylb/mtw-base/ts/schema/components`.
   ```typescript
   import { isSchemaGuidance } from '@tonylb/mtw-base/ts/schema/components'
   ```

3. ~~Add case to `standardComponentFactory()`~~ — Done. Added Guidance case immediately after Example, following same pattern.
   ```typescript
   if ((!isSchemaTreeNode(arg) && isStandardGuidanceData(arg)) || 
       (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaGuidance)(arg))) {
       return new StandardGuidance(arg)
   }
   ```

**Reference**: See existing cases for `StandardExample`

**Verification**: `standardComponentFactory()` creates `StandardGuidance` instances from both JSON and schema

---

### Phase 7: Processing Integration — **Implemented**

**Location**: `packages/mtw-wml/ts/standardize/index.ts`

**Tasks**:

1. ~~**Add to COMPONENT_TEMPLATES**~~ — Done. Added `{ key: 'Guidance', legalParents: ['Room', 'Asset'] }` immediately after the Example entry.
2. ~~**Add to isStandardComponent()**~~ — Done. Imported `StandardGuidance` from `./components/guidance` and added `(value instanceof StandardGuidance)` to the type guard.

**Reference**: See `Example` entry in `COMPONENT_TEMPLATES` (has similar `legalParents`)

**Verification**: Guidance components are processed correctly in `StandardForm`

---

### Phase 8: Add Guidance Reference List to StandardRoom — **Implemented**

**Location**: `packages/mtw-wml/ts/standardize/components/room.ts`

**Tasks**:

1. ~~**Add `_guidance` field to `StandardRoomPayload`**~~ — Done.
   ```typescript
   export class StandardRoomPayload implements HasShortName, ComponentConstructorMethods<StandardRoomData> {
       _shortName?: StandardLiteral;
       _exits: ExitFacetList;
       _lenses: ReferenceList;
       _features: ReferenceList;
       _examples: ReferenceList;
       _guidance: ReferenceList;  // NEW
       _characters: ReferenceList;
       tag = 'Room' as const
   ```

2. ~~**Update constructor**~~ — Done.
   ```typescript
   constructor(previous?: StandardRoomPayload) {
       if (previous) {
           this._shortName = previous._shortName
           this._exits = previous.exits.clone()
           this._lenses = previous._lenses.clone()
           this._features = previous._features.clone()
           this._examples = previous._examples.clone()
           this._guidance = previous._guidance.clone()  // NEW
           this._characters = previous._characters.clone()
       }
       else {
           this._exits = new ExitFacetList([])
           this._lenses = new ReferenceList([])
           this._examples = new ReferenceList([])
           this._guidance = new ReferenceList([])  // NEW
           this._features = new ReferenceList([])
           this._characters = new ReferenceList([])
       }
   }
   ```

3. ~~**Update `fromJSON()`**~~ — Done.
   ```typescript
   fromJSON(props: StandardRoomData) {
       const { shortName } = props
       this._shortName = shortName ? new StandardLiteral(shortName, { tag: 'ShortName' }) : undefined
       this._exits = new ExitFacetList(props.exits ?? [])
       this._lenses = new ReferenceList(props.lenses?.map((reference) => (new StandardReference(reference))) ?? [])
       this._features = new ReferenceList(props.features?.map((reference) => (new StandardReference(reference))) ?? [])
       this._examples = new ReferenceList(props.examples?.map((reference) => (new StandardReference(reference))) ?? [])
       this._guidance = new ReferenceList(props.guidance?.map((reference) => (new StandardReference(reference))) ?? [])  // NEW
       this._characters = new ReferenceList(props.characters?.map((reference) => (new StandardReference(reference))) ?? [])
   }
   ```

4. ~~**Update `fromSchema()`**~~ — Done.
   ```typescript
   fromSchema(node: GenericTreeNode<SchemaTag>) {
       if (treeNodeTypeguard(isSchemaRoom)(node)) {
           // ... existing parsing ...
           this._lenses = new ReferenceList(findTaggedChildren({ children: node.children, tag: 'Lens' }).map(childReferenceFactory))
           this._features = new ReferenceList(findTaggedChildren({ children: node.children, tag: 'Feature' }).map(childReferenceFactory))
           this._examples = new ReferenceList(findTaggedChildren({ children: node.children, tag: 'Example' }).map(childReferenceFactory))
           this._guidance = new ReferenceList(findTaggedChildren({ children: node.children, tag: 'Guidance' }).map(childReferenceFactory))  // NEW
           this._characters = new ReferenceList(findTaggedChildren({ children: node.children, tag: 'Character' }).map(childReferenceFactory))
           return
       }
       throw new Error('Schema mismatch in StandardRoom constructor')
   }
   ```

5. ~~**Add getter**~~ — Done.
   ```typescript
   get guidance() { return this._guidance }
   ```

6. ~~**Update `toJSON()`**~~ — Done.
   ```typescript
   toJSON(options?: StandardToJSONOptions): Omit<StandardRoomData, 'key' | 'universalKey'> {
       const { stripUIFields: stripUI } = options ?? {}
       return {
           tag: 'Room',
           ...(this._shortName ? { shortName: this._shortName.toJSON() } : {}),
           ...(this.exits.payload.length ? { exits: this.exits.toJSON() } : {}),
           ...(this.lenses.payload.length ? { lenses: this.lenses.toJSON() } : {}),
           ...(this.features.payload.length ? { features: this.features.toJSON() } : {}),
           ...(this.examples.payload.length ? { examples: this.examples.toJSON() } : {}),
           ...(this.guidance.payload.length ? { guidance: this.guidance.toJSON() } : {}),  // NEW
           ...(this.characters.payload.length ? { characters: this.characters.toJSON() } : {})
       }
   }
   ```

7. ~~**Update `schema()` method**~~ — Done.
   ```typescript
   schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
       const children = [
           ...[this._shortName].filter(excludeUndefined).map((s) => s.nestedSchema()).flat(1),
           ...this.exits.items.map(facet => {
               const ref = facet.reference as StandardReference
               return ref.schema
           }).flat(1),
           ...this.lenses.payload.map((reference) => (reference.schema)),
           ...this.features.payload.map((reference) => (reference.schema)),
           ...this.examples.payload.map((reference) => (reference.schema)),
           ...this.guidance.payload.map((reference) => (reference.schema)),  // NEW
           ...this.characters.payload.map((reference) => (reference.schema))
       ].filter(excludeUndefined)
       return {
           data: { tag: 'Room', key, uuid: universalKey },
           children
       }
   }
   ```

8. ~~**Update `merge()` method**~~ — Done.
   ```typescript
   merge(incoming: this): this {
       const returnValue = new StandardRoomPayload()
       returnValue._shortName = (this._shortName && incoming._shortName) 
           ? this._shortName.merge(incoming._shortName) 
           : this._shortName ?? incoming._shortName
       returnValue._exits = this._exits.merge(incoming._exits)
       returnValue._lenses = this._lenses.merge(incoming._lenses)
       returnValue._features = this._features.merge(incoming._features)
       returnValue._examples = this._examples.merge(incoming._examples)
       returnValue._guidance = this._guidance.merge(incoming._guidance)  // NEW
       returnValue._characters = this._characters.merge(incoming._characters)
       return returnValue as this
   }
   ```

9. ~~**Update `referencedKeys()` method**~~ — Done.
   ```typescript
   referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
       return [
           ...this.exits.items.map((facet) => {
               const ref = facet.reference as StandardReference
               return { referenceType: 'Facet' as const, reference: ref }
           }),
           ...this.lenses.payload.map((reference) => ({ referenceType: 'Reference' as const, reference })),
           ...this.features.payload.map((reference) => ({ referenceType: 'Reference' as const, reference })),
           ...this.examples.payload.map((reference) => ({ referenceType: 'Reference' as const, reference })),
           ...this.guidance.payload.map((reference) => ({ referenceType: 'Reference' as const, reference })),  // NEW
           ...this.characters.payload.map((reference) => ({ referenceType: 'Reference' as const, reference }))
       ]
   }
   ```

10. ~~**Update `assureReferences()` method**~~ — Done.
    ```typescript
    assureReferences(children: StandardReference[]): this {
        const returnValue = new StandardRoomPayload(this)
        
        // Dispatch children to appropriate buckets
        const lensChildren = children.filter(child => child.tag === 'Lens')
        const featureChildren = children.filter(child => child.tag === 'Feature')
        const exampleChildren = children.filter(child => child.tag === 'Example')
        const guidanceChildren = children.filter(child => child.tag === 'Guidance')  // NEW
        const characterChildren = children.filter(child => child.tag === 'Character')
        
        // Assure references in each bucket
        if (lensChildren.length) {
            returnValue._lenses = returnValue._lenses.assureReferences(lensChildren)
        }
        if (featureChildren.length) {
            returnValue._features = returnValue._features.assureReferences(featureChildren)
        }
        if (exampleChildren.length) {
            returnValue._examples = returnValue._examples.assureReferences(exampleChildren)
        }
        if (guidanceChildren.length) {
            returnValue._guidance = returnValue._guidance.assureReferences(guidanceChildren)  // NEW
        }
        if (characterChildren.length) {
            returnValue._characters = returnValue._characters.assureReferences(characterChildren)
        }
        
        return returnValue as this
    }
    ```

11. ~~**Update `withChild()` method**~~ — Done.
    ```typescript
    withChild(child: StandardReference): this {
        const returnValue = new StandardRoomPayload(this)
        switch(child.tag) {
            case 'Lens':
                returnValue._lenses = returnValue._lenses.withChild(child)
                break
            case 'Feature':
                returnValue._features = returnValue._features.withChild(child)
                break
            case 'Example':
                returnValue._examples = returnValue._examples.withChild(child)
                break
            case 'Guidance':  // NEW
                returnValue._guidance = returnValue._guidance.withChild(child)
                break
            case 'Character':
                returnValue._characters = returnValue._characters.withChild(child)
                break
        }
        return returnValue as this
    }
    ```

12. ~~**Update `removeReferences()` method**~~ — Done.
    ```typescript
    removeReferences(children: StandardReference[]): this {
        const returnValue = new StandardRoomPayload(this)
        returnValue._lenses = returnValue._lenses.removeReferences(children)
        returnValue._features = returnValue._features.removeReferences(children)
        returnValue._examples = returnValue._examples.removeReferences(children)
        returnValue._guidance = returnValue._guidance.removeReferences(children)  // NEW
        returnValue._characters = returnValue._characters.removeReferences(children)
        return returnValue as this
    }
    ```

13. ~~**Update `nestedSchema()` method**~~ — Done.
    ```typescript
    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key, organizationContext } = options
        
        // Get children from organization context
        const children = organizationContext 
            ? organizationContext.getChildrenOfParent(key)
            : []
        
        // Assure references for tree structure
        const withReferences = children.length 
            ? this.assureReferences(children)
            : this
        
        // Render exit facets
        const exitNodes: GenericTreeNode<SchemaTag>[] = []
        for (const facet of withReferences.exits.items) {
            const result = facet.renderFacet(undefined, lookup)
            if (result.aggregatedNode) {
                exitNodes.push(result.aggregatedNode)
            } else if (result.newNode) {
                exitNodes.push(result.newNode)
            }
        }
        
        // Render reference lists
        const lensNodes = withReferences.lenses.payload.map(ref => renderReference(ref, lookup, options))
        const featureNodes = withReferences.features.payload.map(ref => renderReference(ref, lookup, options))
        const exampleNodes = withReferences.examples.payload.map(ref => renderReference(ref, lookup, options))
        const guidanceNodes = withReferences.guidance.payload.map(ref => renderReference(ref, lookup, options))  // NEW
        const characterNodes = withReferences.characters.payload.map(ref => renderReference(ref, lookup, options))
        
        const schemaChildren = [
            ...[withReferences._shortName].filter(excludeUndefined).map((s) => s.nestedSchema()).flat(1),
            ...exitNodes,
            ...lensNodes,
            ...featureNodes,
            ...exampleNodes,
            ...guidanceNodes,  // NEW
            ...characterNodes
        ].filter(excludeUndefined)
        
        return {
            data: { tag: 'Room', key: key.key ?? '', uuid: key.universalKey },
            children: schemaChildren
        }
    }
    ```

14. ~~**Add getter to `StandardRoom` component class**~~ — Done.
    ```typescript
    export class StandardRoom extends componentClassFactory(StandardRoomPayload, 'StandardRoom') {
        get shortName() { return this._payload.shortName }
        get exits() { return this._payload.exits }
        get lenses() { return this._payload.lenses }
        get features() { return this._payload.features }
        get examples() { return this._payload.examples }
        get guidance() { return this._payload.guidance }  // NEW
        get characters() { return this._payload.characters }
        
        // ... rest of class ...
    }
    ```

**Location**: `packages/mtw-wml/ts/standardize/components/dataTypes/room.ts`

**Tasks**:

15. ~~**Add `guidance` field to `StandardRoomData` type**~~ — Done.
    ```typescript
    export type StandardRoomData = {
        tag: 'Room';
        shortName?: StandardEditableData<string>;
        exits?: ExitFacetData[];
        lenses?: ReferenceListData;
        features?: ReferenceListData;
        examples?: ReferenceListData;
        guidance?: ReferenceListData;  // NEW
        characters?: ReferenceListData;
    } & StandardBaseData
    ```

**Reference**: See how `examples` is integrated throughout `room.ts`

**Verification**: Rooms can contain Guidance references, serialize/deserialize correctly, merge operations work

---

### Phase 9: Unit Tests - Backend — Implemented

**Location**: Create `packages/mtw-wml/ts/standardize/components/guidance.test.ts`

**Tasks**:

1. ~~**Test construction from JSON**~~ — Done.
   ```typescript
   describe('StandardGuidance', () => {
       it('should construct from JSON data', () => {
           const data: StandardGuidanceData = {
               tag: 'Guidance',
               key: 'test-guidance',
               instructions: 'Test instructions',
               marks: [],
               shortName: 'Test'
           }
           const guidance = new StandardGuidance(data)
           expect(guidance.key).toBe('test-guidance')
           expect(guidance.instructions).toBeDefined()
           expect(guidance.shortName).toBeDefined()
       })
   })
   ```

2. ~~**Test construction from WML**~~ — Done.
   ```typescript
   it('should construct from WML schema', () => {
       const wml = `
           <Guidance key=(dark-guidance)>
               <ShortName>Dark Guidance</ShortName>
               <Instructions>Mood is spooky, play up shadows</Instructions>
               <Mark uuid=(illumination-mark)><Match>Dark</Match></Mark>
           </Guidance>
       `
       const guidance = new StandardGuidance(wml)
       expect(guidance.key).toBe('dark-guidance')
       expect(guidance.instructions).toBeDefined()
       expect(guidance.marks.length).toBe(1)
   })
   ```

3. ~~**Test serialization (toJSON)**~~ — Done.
   ```typescript
   it('should serialize to JSON correctly', () => {
       const wml = `
           <Guidance key=(test)>
               <Instructions>Test instructions</Instructions>
           </Guidance>
       `
       const guidance = new StandardGuidance(wml)
       const json = guidance.toJSON()
       expect(json.tag).toBe('Guidance')
       expect(json.instructions).toBeDefined()
   })
   ```

4. ~~**Test deserialization round-trip**~~ — Done.
   ```typescript
   it('should round-trip JSON → Component → JSON', () => {
       const original: StandardGuidanceData = {
           tag: 'Guidance',
           key: 'test',
           instructions: 'Test instructions',
           marks: []
       }
       const guidance = new StandardGuidance(original)
       const json = guidance.toJSON()
       const guidance2 = new StandardGuidance({ ...json, key: 'test' })
       expect(guidance2.toJSON()).toEqual(json)
   })
   ```

5. ~~**Test schema generation**~~ — Done.
   ```typescript
   it('should generate schema correctly', () => {
       const guidance = new StandardGuidance({
           tag: 'Guidance',
           key: 'test',
           instructions: 'Test instructions'
       })
       const schema = guidance.schema
       expect(schema.data.tag).toBe('Guidance')
       expect(schema.data.key).toBe('test')
   })
   ```

6. ~~**Test merge operations**~~ — Done.
   ```typescript
   it('should merge two guidance components', () => {
       const guidance1 = new StandardGuidance({
           tag: 'Guidance',
           key: 'test',
           instructions: 'First'
       })
       const guidance2 = new StandardGuidance({
           tag: 'Guidance',
           key: 'test',
           instructions: ' Second'
       })
       const merged = guidance1.merge(guidance2)
       // Test merge behavior based on StandardLiteral merge semantics
   })
   ```

7. ~~**Test isEmpty()**~~ — Done.
   ```typescript
   it('should detect empty guidance', () => {
       const empty = new StandardGuidance({
           tag: 'Guidance',
           key: 'test'
       })
       expect(empty._payload.isEmpty()).toBe(true)
       
       const notEmpty = new StandardGuidance({
           tag: 'Guidance',
           key: 'test',
           instructions: 'Not empty'
       })
       expect(notEmpty._payload.isEmpty()).toBe(false)
   })
   ```

8. ~~**Test invert()**~~ — Done.
   ```typescript
   it('should invert guidance operations', () => {
       const guidance = new StandardGuidance({
           tag: 'Guidance',
           key: 'test',
           instructions: 'Test'
       })
       const inverted = guidance.invert()
       // Test invert behavior
   })
   ```

9. ~~**Test Mark facets**~~ — Done.
   ```typescript
   it('should handle Mark facets correctly', () => {
       const wml = `
           <Guidance key=(test)>
               <Mark uuid=(mark1)><Match>Value1</Match></Mark>
               <Mark uuid=(mark2)><Match>Value2</Match></Mark>
           </Guidance>
       `
       const guidance = new StandardGuidance(wml)
       expect(guidance.marks.length).toBe(2)
   })
   ```

10. ~~**Test zero-Mark guidance**~~ — Done.
    ```typescript
    it('should support guidance with zero marks', () => {
        const wml = `
            <Guidance key=(essence)>
                <Instructions>Default essence guidance</Instructions>
            </Guidance>
        `
        const guidance = new StandardGuidance(wml)
        expect(guidance.marks.length).toBe(0)
        expect(guidance.instructions).toBeDefined()
    })
    ```

**Reference**: See `example.test.ts` for similar test patterns

**Verification**: All tests pass with `npm run test -- --watchAll=false ts/standardize/components/guidance.test.ts`

---

### Phase 10: Unit Tests - Room Integration — Implemented

**Location**: Update `packages/mtw-wml/ts/standardize/components/room.test.ts`

**Tasks**:

1. ~~**Test Room with Guidance references**~~ — Done.
   ```typescript
   it('should handle guidance references', () => {
       const wml = `
           <Room key=(tavern)>
               <Guidance key=(dark-guidance)/>
               <Guidance key=(moonlight-guidance)/>
           </Room>
       `
       const room = new StandardRoom(wml)
       expect(room.guidance.payload.length).toBe(2)
   })
   ```

2. ~~**Test Room serialization with Guidance**~~ — Done.
   ```typescript
   it('should serialize guidance references correctly', () => {
       const room = new StandardRoom({
           tag: 'Room',
           key: 'tavern',
           guidance: [
               { tag: 'Guidance', key: 'dark-guidance', ref: 1 }
           ]
       })
       const json = room.toJSON()
       expect(json.guidance).toBeDefined()
       expect(json.guidance?.length).toBe(1)
   })
   ```

3. ~~**Test Room merge with Guidance**~~ — Done.
   ```typescript
   it('should merge guidance references', () => {
       const room1 = new StandardRoom({
           tag: 'Room',
           key: 'tavern',
           guidance: [{ tag: 'Guidance', key: 'guidance1', ref: 1 }]
       })
       const room2 = new StandardRoom({
           tag: 'Room',
           key: 'tavern',
           guidance: [{ tag: 'Guidance', key: 'guidance2', ref: 1 }]
       })
       const merged = room1.merge(room2)
       expect(merged.guidance.payload.length).toBe(2)
   })
   ```

4. ~~**Test assureReferences with Guidance**~~ — Done.
   ```typescript
   it('should assure guidance references correctly', () => {
       const room = new StandardRoom({
           tag: 'Room',
           key: 'tavern'
       })
       const guidanceRef = new StandardReference({
           tag: 'Guidance',
           key: 'test-guidance',
           ref: 1
       })
       const withReferences = room._payload.assureReferences([guidanceRef])
       expect(withReferences.guidance.payload.length).toBe(1)
   })
   ```

**Verification**: All Room tests pass including new Guidance integration tests

---

### Phase 11: Frontend - Guidance Editor Component — **Implemented**

**Location**: Create `charcoal-client/src/components/Workbench/GuidanceEdit/GuidanceEditor.tsx` (and `GuidanceEdit/index.ts`).

**Tasks**:

1. ~~**Create GuidanceEditor component**~~ — Done. GuidanceEdit/GuidanceEditor created; shortName via TopLevelStandardLiteralEditor, instructions via debounced multiline TextField with StandardLiteral (tag: 'Instructions'); Marks section placeholder until Phase 12; WorkbenchAssetEditor routing added for componentLayer when layer is StandardGuidance.
   ```typescript
   import React from 'react'
   import { Box, TextField } from '@mui/material'
   import { useDispatch, useSelector } from 'react-redux'
   import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
   import { getComponentPayload } from '../../../../slices/personalAssets/selectors'
   import { updateComponent } from '../../../../slices/personalAssets'
   import { StandardGuidance } from '@tonylb/mtw-wml/ts/standardize/components/guidance'
   import MarkFacetsEditor from '../MarkFacetsEditor'
   
   interface GuidanceEditorProps {
       componentId: ComponentUUID
   }
   
   export const GuidanceEditor: React.FC<GuidanceEditorProps> = ({ componentId }) => {
       const dispatch = useDispatch()
       const component = useSelector(getComponentPayload(componentId))
       
       if (!(component instanceof StandardGuidance)) {
           return null
       }
       
       const handleInstructionsChange = (value: string) => {
           const updated = component.clone()
           // Update instructions field
           // TODO: Implement StandardLiteral update pattern
           dispatch(updateComponent({ componentId, component: updated }))
       }
       
       const handleShortNameChange = (value: string) => {
           const updated = component.clone()
           // Update shortName field
           // TODO: Implement StandardLiteral update pattern
           dispatch(updateComponent({ componentId, component: updated }))
       }
       
       return (
           <Box sx={{ p: 2 }}>
               <TextField
                   label="Short Name"
                   fullWidth
                   value={component.shortName?.toJSON() ?? ''}
                   onChange={(e) => handleShortNameChange(e.target.value)}
                   sx={{ mb: 2 }}
               />
               
               <TextField
                   label="Instructions"
                   fullWidth
                   multiline
                   rows={4}
                   value={component.instructions?.toJSON() ?? ''}
                   onChange={(e) => handleInstructionsChange(e.target.value)}
                   helperText="General guidance for rendering algorithm"
                   sx={{ mb: 2 }}
               />
               
               <MarkFacetsEditor
                   componentId={componentId}
                   marks={component.marks}
               />
           </Box>
       )
   }
   
   export default GuidanceEditor
   ```

**Key Patterns**:
- Use `TextField` for `shortName` and `instructions` (simple text fields)
- Reuse `MarkFacetsEditor` component from Example editor (if it exists, or create it)
- Follow existing editor patterns for component updates via Redux

**Reference**: See `ExampleEditor` for similar structure with `shortName` and `marks`

**Verification**: GuidanceEditor renders correctly when navigating to a Guidance layer (Phase 13 adds Room Guidance section and navigation); short name and instructions persist via updateStandard; readonly respected.

---

### Phase 12: Frontend - MarkFacetsEditor Component — **Implemented**

**Location**: Create `charcoal-client/src/components/Workbench/MarkFacetsEditor/` (created at Workbench level to match existing editor folders; planning doc had `editors/MarkFacetsEditor`).

**Note**: This component may already exist if Example editor has been implemented. If so, reuse it. If not, create it as a shared component.

**Tasks**:

1. ~~**Create MarkFacetsEditor component**~~ — Done. Created `MarkFacetsEditor.tsx` and `index.ts` under `charcoal-client/src/components/Workbench/MarkFacetsEditor/`. List display with reference label and Match value; remove by index; Add Mark via dialog (ComponentSelectorDialog with `tag="Mark"` + TextField for Match); empty state "No marks specified (applies to all situations)"; readonly disables Add/Remove. Wired into GuidanceEditor with `handleMarksChange` updating `_payload._marks` in draft.
   ```typescript
   import React from 'react'
   import { Box, Typography, Button, List, ListItem, ListItemText, IconButton } from '@mui/material'
   import DeleteIcon from '@mui/icons-material/Delete'
   import AddIcon from '@mui/icons-material/Add'
   import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
   import { MarkFacetList } from '@tonylb/mtw-wml/ts/standardize/keys/facets/mark'
   
   interface MarkFacetsEditorProps {
       componentId: ComponentUUID
       marks: MarkFacetList
       onChange?: (marks: MarkFacetList) => void
   }
   
   export const MarkFacetsEditor: React.FC<MarkFacetsEditorProps> = ({ 
       componentId, 
       marks,
       onChange 
   }) => {
       const handleAddMark = () => {
           // TODO: Implement add mark dialog
           // Should allow selecting a Mark component and entering a Match value
       }
       
       const handleRemoveMark = (index: number) => {
           // TODO: Implement remove mark
           // Create new MarkFacetList without the item at index
           // Call onChange with updated list
       }
       
       return (
           <Box>
               <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                   <Typography variant="subtitle1">Marks</Typography>
                   <Button
                       startIcon={<AddIcon />}
                       onClick={handleAddMark}
                       size="small"
                   >
                       Add Mark
                   </Button>
               </Box>
               
               <List>
                   {marks.items.map((facet, index) => {
                       const ref = facet.reference
                       const payload = facet.payload
                       return (
                           <ListItem
                               key={index}
                               secondaryAction={
                                   <IconButton edge="end" onClick={() => handleRemoveMark(index)}>
                                       <DeleteIcon />
                                   </IconButton>
                               }
                           >
                               <ListItemText
                                   primary={ref.key ?? ref.universalKey}
                                   secondary={`Match: ${payload}`}
                               />
                           </ListItem>
                       )
                   })}
               </List>
               
               {marks.items.length === 0 && (
                   <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                       No marks specified (applies to all situations)
                   </Typography>
               )}
           </Box>
       )
   }
   
   export default MarkFacetsEditor
   ```

**Key Patterns**:
- Display list of Mark facets with Mark reference and Match value
- Add/remove Mark facets
- Show helpful message when zero Marks (applies to all situations)

**Reference**: See existing facet editors (Exit facets in Room editor) for patterns

**Verification**: MarkFacetsEditor displays marks correctly and handles add/remove; GuidanceEditor shows marks list and persists add/remove via updateStandard; readonly respected.

---

### Phase 13: Frontend - Guidance Section in Room Editor — **Implemented**

**Location**: Update `charcoal-client/src/components/Workbench/RoomEdit/RoomEditor.tsx` (actual path; planning doc had referenced `editors/RoomEditor/index.tsx`).

**Tasks**:

1. ~~**Add Guidance section to RoomEditor**~~ — Done. Added `guidanceListContext` (form → room `_guidance` descriptor), `handleGuidanceItemClick` (navigateToComponentLayer), and a second `ReferenceListEditor` block after Examples with `title="Guidance"`, `tag="Guidance"`, `listContext={guidanceListContext}`, `onItemClick={handleGuidanceItemClick}`. Also added `"Guidance"` to `ComponentTag` in ReferenceListEditor.tsx and referenceListAdapter.ts.

**Key Patterns**:
- Use `ReferenceListEditor` for add/remove/list management (same as Features/Examples)
- Navigate to layered Guidance view when clicking a Guidance item
- Place after Examples section, before Characters section

**Reference**: See Examples section in RoomEditor for exact pattern

**Verification**: Guidance section appears in Room editor; add/remove Guidance references works; clicking an item navigates to the Guidance layer (GuidanceEditor). Readonly/disabled respected.

---

### Phase 14: Frontend - LayeredGuidanceTabs Component — **Implemented**

**Location**: Create `charcoal-client/src/components/Workbench/foundations/LayeredContext/LayeredGuidanceTabs.tsx`

**Tasks**:

1. ~~**Create LayeredGuidanceTabs component**~~ (following Pattern 4 from `AGENT.layered-context-patterns.md`) — Done.
   ```typescript
   import React, { useState, useEffect } from 'react'
   import { Box, Tabs, Tab } from '@mui/material'
   import { useSelector, useDispatch } from 'react-redux'
   import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
   import { getComponentPayload } from '../../../../slices/personalAssets/selectors'
   import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
   import GuidanceEditor from '../../editors/GuidanceEditor'
   
   interface LayeredGuidanceTabsProps {
       parentComponentId: ComponentUUID
       currentGuidanceId?: ComponentUUID
   }
   
   export const LayeredGuidanceTabs: React.FC<LayeredGuidanceTabsProps> = ({ 
       parentComponentId,
       currentGuidanceId 
   }) => {
       const dispatch = useDispatch()
       const parentComponent = useSelector(getComponentPayload(parentComponentId))
       
       if (!(parentComponent instanceof StandardRoom)) {
           return null
       }
       
       // Get guidance references from parent
       const guidanceRefs = parentComponent.guidance.payload
       
       // Build siblings list with labels
       const siblings = guidanceRefs.map(ref => {
           const guidanceComponent = useSelector(getComponentPayload(ref.universalKey))
           const label = guidanceComponent?.shortName?.toJSON() ?? 'Untitled'
           return {
               id: ref.universalKey,
               label
           }
       })
       
       // Current selection state
       const [currentId, setCurrentId] = useState<ComponentUUID | null>(
           currentGuidanceId ?? siblings[0]?.id ?? null
       )
       
       // Sync with prop changes
       useEffect(() => {
           if (currentGuidanceId && currentGuidanceId !== currentId) {
               setCurrentId(currentGuidanceId)
           }
       }, [currentGuidanceId])
       
       const handleTabChange = (_: React.SyntheticEvent, newValue: ComponentUUID) => {
           setCurrentId(newValue)
           // Update breadcrumb navigation
           dispatch(updateBreadcrumbLayer({
               parentComponentId,
               layerType: 'Guidance',
               currentLayerId: newValue
           }))
       }
       
       if (siblings.length === 0) {
           return (
               <Box sx={{ p: 2 }}>
                   <Typography variant="body2" color="text.secondary">
                       No guidance defined. Add guidance in the Room editor.
                   </Typography>
               </Box>
           )
       }
       
       return (
           <Box>
               <Tabs
                   value={currentId ?? false}
                   onChange={handleTabChange}
                   variant="scrollable"
                   scrollButtons="auto"
                   aria-label="Guidance layers"
               >
                   {siblings.map(({ id, label }) => (
                       <Tab key={id} value={id} label={label || 'Untitled'} />
                   ))}
               </Tabs>
               
               {currentId && <GuidanceEditor componentId={currentId} />}
           </Box>
       )
   }
   
   export default LayeredGuidanceTabs
   ```

**Key Patterns**:
- Use MUI `Tabs` with `variant="scrollable"` and `scrollButtons="auto"` (Pattern 4)
- Use `shortName` for tab labels (not `instructions`)
- Fall back to "Untitled" when `shortName` is missing
- Single editor panel below tabs (payload editing only)
- No add/remove buttons (that's in parent RoomEditor)

**Reference**: See `AGENT.layered-context-patterns.md` Pattern 4 implementation notes

**Verification**: LayeredGuidanceTabs renders tabs from Room guidance refs, switches editor by tab, syncs breadcrumb via `navigateToComponentLayer`. Exported from LayeredContext index. Room with zero guidance shows empty-state message.

---

### Phase 15: Frontend - Workbench Navigation Integration — **Implemented**

**Implementation note**: Implemented without LayeredGuidanceTabs: when `currentView === 'componentLayer'` and the layer component is `StandardGuidance`, `WorkbenchAssetEditor.tsx` renders `GuidanceEditor(componentId)` directly (single edit pane). Breadcrumbs in `WorkbenchContainer.tsx` distinguish Guidance via `instanceof StandardGuidance` and show shortName or "Guidance". Navigation and back-navigation work.

**Location**: Update `charcoal-client/src/components/Workbench/index.tsx` (or equivalent router)

**Tasks**:

1. **Add Guidance layer route**:
   ```typescript
   // In workbench router/view selector:
   if (currentView === 'componentLayer' && layerType === 'Guidance') {
       return (
           <LayeredGuidanceTabs
               parentComponentId={parentComponentId}
               currentGuidanceId={currentLayerId}
           />
       )
   }
   ```

2. **Update breadcrumb rendering**:
   ```typescript
   // Add 'Guidance' case to breadcrumb label generation:
   if (breadcrumb.kind === 'componentLayer' && breadcrumb.layerType === 'Guidance') {
       return 'Guidance'
   }
   ```

**Key Patterns**:
- Breadcrumbs show: **Asset → Room → Guidance**
- Clicking "Room" exits Guidance view back to Room editor
- Clicking "Guidance" stays in Guidance view (no-op or refresh)

**Reference**: See Examples navigation integration for exact pattern

**Verification**: Navigation works correctly, breadcrumbs display properly, back navigation works

---

### Phase 16: Frontend - Redux State Integration — **Implemented**

**Implementation note**: Implemented via generic `componentLayer` rather than explicit `ComponentLayerType`: `charcoal-client/src/slices/UI/workbench/index.ts` uses `WorkbenchBreadcrumbKind = 'component' | 'componentLayer'` and `navigateToComponentLayer(parentComponentId, layerComponentId)`; the UI derives Guidance (vs Examples/Mark) from the layer component via `instanceof StandardGuidance`. Selectors `getCurrentView`, `getCurrentComponentLayerId` support Guidance layer navigation.

**Location**: Update `charcoal-client/src/slices/UI/index.ts` (or equivalent navigation slice)

**Tasks**:

1. **Add Guidance layer type**:
   ```typescript
   export type ComponentLayerType = 'Examples' | 'Guidance'
   
   export interface ComponentLayerBreadcrumb {
       kind: 'componentLayer'
       componentId: ComponentUUID
       layerType: ComponentLayerType
       currentLayerId?: ComponentUUID
   }
   ```

2. **Update breadcrumb actions**:
   ```typescript
   // Ensure pushBreadcrumb, popBreadcrumb, updateBreadcrumbLayer handle 'Guidance' layer type
   ```

3. **Update selectors**:
   ```typescript
   // Ensure currentView, currentLayerType, currentLayerId selectors handle 'Guidance'
   ```

**Reference**: See Examples layer type integration for exact pattern

**Verification**: Redux state correctly tracks Guidance layer navigation

---

### Phase 17: Integration Testing — **Partially implemented**

**Implementation note**: Backend unit tests exist (`packages/mtw-wml/ts/standardize/components/guidance.test.ts`, Guidance coverage in `room.test.ts`). Dedicated integration tests (backend merge/serialize, frontend navigation/edit, E2E) as described below are not yet present.

**Location**: Manual testing and integration test suite

**Tasks**:

1. **Backend integration tests**:
   - Create Guidance component via WML parsing
   - Add Guidance to Room via reference list
   - Serialize Room with Guidance to JSON
   - Deserialize Room with Guidance from JSON
   - Merge two Rooms with different Guidance references
   - Test StandardForm operations with Guidance components

2. **Frontend integration tests**:
   - Navigate to Room editor
   - Add Guidance reference via ReferenceListEditor
   - Navigate to Guidance layer view
   - Edit Guidance instructions and marks
   - Switch between Guidance tabs
   - Navigate back to Room editor
   - Verify Guidance persists correctly

3. **End-to-end tests**:
   - Create Room with Guidance in frontend
   - Save to backend
   - Reload from backend
   - Verify Guidance renders correctly

**Verification**: All integration tests pass, no regressions in existing functionality

---

## Future Enhancements (Not in Initial Implementation)

### Phase 18: Create AGENT.rendering.md (After Phases 1-17)

**Prerequisite**: Complete Phases 1-17 first. Create this document after implementation so we can document what we've learned and get it right the first time.

**Location**: `packages/mtw-wml/ts/standardize/components/AGENT.rendering.md`

**Purpose**: Lay out the constraints established so far about how Guidance, Examples, Lenses, and Marks work together to provide a framework for rendering components in different world-states. This will be a living document—fill it out as we go along and implement more patterns.

### Phase 19: Extend to Feature and Knowledge (Future)

Once Guidance is proven in Room context, extend to Feature and Knowledge:

1. Add `guidance: ReferenceList` to `StandardFeature` and `StandardKnowledge`
2. Update Feature/Knowledge data types
3. Add Guidance section to FeatureEditor and KnowledgeEditor
4. Create LayeredGuidanceTabs instances for Feature/Knowledge
5. Update COMPONENT_TEMPLATES to include `['Feature', 'Knowledge']` as legal parents

### Phase 20: Advanced Mark Facet UI (Future)

Enhance MarkFacetsEditor with:

1. Mark picker dialog (select from available Mark components)
2. Match value autocomplete (suggest values from existing Examples)
3. Visual indication of Mark coverage (which Marks are specified)
4. Conflict detection (overlapping Mark combinations with different guidance)

### Phase 21: Guidance Rendering Integration (Future)

Integrate Guidance into rendering pipeline:

1. Design aggregation algorithm for layered guidance
2. Implement guidance lookup by Mark-value combination
3. Integrate with LLM rendering system
4. Add guidance preview in Room/Feature/Knowledge editors

---

## Verification Checklist

After completing all phases, verify:

- [ ] Guidance component can be parsed from WML string
- [ ] Guidance component can be created from JSON data
- [ ] Guidance component serializes correctly (toJSON)
- [ ] Guidance component deserializes correctly (round-trip)
- [ ] Guidance component generates correct schema
- [ ] Guidance component generates correct nested schema
- [ ] Guidance component merge operations work
- [ ] Guidance component equals/diff operations work
- [ ] Guidance component isEmpty() works correctly
- [ ] Guidance component invert() works correctly
- [ ] Guidance component handles Mark facets correctly
- [ ] Guidance component supports zero Marks
- [ ] Guidance appears in standardComponentFactory() lookups
- [x] Guidance appears in COMPONENT_TEMPLATES array
- [x] Guidance passes isStandardComponent() type guard
- [ ] Guidance can be stored in StandardForm
- [ ] Room can contain Guidance references
- [ ] Room serializes Guidance references correctly
- [ ] Room deserializes Guidance references correctly
- [ ] Room merge operations handle Guidance correctly
- [ ] Room assureReferences() handles Guidance correctly
- [x] All backend unit tests pass
- [x] All Room integration tests pass
- [ ] GuidanceEditor renders correctly
- [ ] MarkFacetsEditor renders correctly
- [ ] Guidance section appears in Room editor
- [ ] LayeredGuidanceTabs renders correctly
- [ ] Workbench navigation handles Guidance layer
- [ ] Breadcrumbs display correctly for Guidance
- [ ] Redux state tracks Guidance navigation
- [ ] All frontend integration tests pass
- [ ] No regressions in existing functionality

---

## Related Documentation

- [`AGENT.md`](./AGENT.md) - Component concepts and design goals
- [`AGENT.implementation.md`](./AGENT.implementation.md) - Step-by-step guide for adding components
- [`AGENT.usage.md`](./AGENT.usage.md) - Practical usage examples
- [`example.ts`](./example.ts) - Reference implementation (sibling component with marks)
- [`room.ts`](./room.ts) - Reference implementation (parent component with reference lists)
- [`../keys/facets/AGENT.facets.md`](../keys/facets/AGENT.facets.md) - Mark facet system documentation
- [`../../charcoal-client/src/components/Workbench/foundations/LayeredContext/AGENT.layered-context-patterns.md`](../../../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/AGENT.layered-context-patterns.md) - Layered context UI patterns

---

## Notes

- **Guidance vs. Example**: Guidance provides general instructions for rendering algorithms; Examples provide exact word-for-word renders
- **Zero-Mark support**: Guidance can exist with empty MarkFacetList for essence/default guidance
- **Room-only initially**: Start with Room integration; expand to Feature/Knowledge in future iteration
- **StandardLiteral for instructions**: Simple string content, not StandardRender (no rich text needed)
- **LayeredContext Pattern 4**: Use MUI scrollable tabs for sibling navigation
- **Payload-only editing**: Add/remove/list management in parent editor; LayeredGuidanceTabs only edits payload
