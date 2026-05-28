import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardComponent } from "./components/baseClasses"
import StandardCharacter from "./components/character"
import StandardFeature from "./components/feature"
import StandardGuidance from "./components/guidance"
import StandardSituation from "./components/situation"
import StandardImage from "./components/image"
import StandardKnowledge from "./components/knowledge"
import StandardMap from "./components/map"
import StandardMessage from "./components/message"
import StandardMoment from "./components/moment"
import StandardArea from "./components/area"
import StandardRoom from "./components/room"
import StandardMark, { StandardLens } from "./components/worldState"
import { isSchemaCharacter, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaTreeNode } from "../schema"
import { StandardComponentInputData } from "./baseClasses"
import { isStandardCharacterData, isStandardFeatureData, isStandardGuidanceInputData, isStandardImageData, isStandardKnowledgeData, isStandardMapInputData, isStandardMessageData, isStandardMomentData, isStandardAreaData, isStandardRoomInputData, isStandardMarkData, isStandardLensInputData, isStandardSituationInputData } from "./components/dataTypes"
import { isSchemaFeature, isSchemaGuidance, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaArea, isSchemaRoom, isSchemaSituation } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaImage } from "@tonylb/mtw-base/ts/schema/image"
import { isSchemaMark, isSchemaLens } from "@tonylb/mtw-base/ts/schema/worldState"
import { resolveStandardizeFromSchemaContext, WmlStandardizeMode } from "./wmlStandardizeMode"

//
// standardComponentFactory takes an incoming argument that can apply to any of the StandardComponent classes,
// finds the correct constructor, and creates the sub-typed class. It also returns the child-schema remainder
// produced by the component's fromSchema pipeline (currently always [] for data-based construction).
//
export type StandardComponentFactoryResult = {
    component: StandardComponent | undefined;
    remainder: GenericTree<SchemaTag>;
}

export type StandardComponentFactoryOptions = {
    standardizeMode?: WmlStandardizeMode
}

export const standardComponentFactory = (
    arg: StandardComponentInputData | GenericTreeNode<SchemaTag>,
    options?: StandardComponentFactoryOptions
): StandardComponentFactoryResult => {
    const fromSchemaContext = resolveStandardizeFromSchemaContext(
        options?.standardizeMode !== undefined
            ? { standardizeMode: options.standardizeMode }
            : undefined
    )
    //
    // Data-based construction: build the component directly from StandardComponentData and
    // return an empty remainder (no child schema is produced by fromSchema in this path).
    //
    if (!isSchemaTreeNode(arg)) {
        if (isStandardCharacterData(arg)) {
            return { component: new StandardCharacter(arg), remainder: [] }
        }
        if (isStandardGuidanceInputData(arg)) {
            return { component: new StandardGuidance(arg), remainder: [] }
        }
        if (isStandardSituationInputData(arg)) {
            return { component: new StandardSituation(arg), remainder: [] }
        }
        if (isStandardRoomInputData(arg)) {
            return { component: new StandardRoom(arg), remainder: [] }
        }
        if (isStandardFeatureData(arg)) {
            return { component: new StandardFeature(arg), remainder: [] }
        }
        if (isStandardKnowledgeData(arg)) {
            return { component: new StandardKnowledge(arg), remainder: [] }
        }
        if (isStandardMapInputData(arg)) {
            return { component: new StandardMap(arg), remainder: [] }
        }
        if (isStandardMessageData(arg)) {
            return { component: new StandardMessage(arg), remainder: [] }
        }
        if (isStandardMomentData(arg)) {
            return { component: new StandardMoment(arg), remainder: [] }
        }
        if (isStandardAreaData(arg)) {
            return { component: new StandardArea(arg), remainder: [] }
        }
        if (isStandardImageData(arg)) {
            return { component: new StandardImage(arg), remainder: [] }
        }
        if (isStandardMarkData(arg)) {
            return { component: new StandardMark(arg), remainder: [] }
        }
        if (isStandardLensInputData(arg)) {
            return { component: new StandardLens(arg), remainder: [] }
        }
        return { component: undefined, remainder: [] }
    }

    //
    // Schema-based construction: construct an \"empty\" component and then populate it via
    // the shared fromSchema entry point, capturing the child-schema remainder. This mirrors
    // the previous behavior where constructors accepted schema nodes and delegated to
    // fromSchema internally, but makes the delegation explicit and exposes the remainder.
    //
    const node = arg
    if (treeNodeTypeguard(isSchemaCharacter)(node)) {
        const instance = new StandardCharacter(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaGuidance)(node)) {
        const instance = new StandardGuidance(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaSituation)(node)) {
        const instance = new StandardSituation(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaRoom)(node)) {
        const instance = new StandardRoom(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaFeature)(node)) {
        const instance = new StandardFeature(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaKnowledge)(node)) {
        const instance = new StandardKnowledge(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaMap)(node)) {
        const instance = new StandardMap(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaMessage)(node)) {
        const instance = new StandardMessage(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaMoment)(node)) {
        const instance = new StandardMoment(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaArea)(node)) {
        const instance = new StandardArea(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaImage)(node)) {
        const instance = new StandardImage(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaMark)(node)) {
        const instance = new StandardMark(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }
    if (treeNodeTypeguard(isSchemaLens)(node)) {
        const instance = new StandardLens(undefined as any)
        const remainder = instance.fromSchema(node, fromSchemaContext)
        return { component: instance, remainder }
    }

    return { component: undefined, remainder: [] }
}
