import { SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaConditionTag, SchemaOutputTag, SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses';
import { GenericTree, GenericTreeFiltered, GenericTreeNodeFiltered, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses';
import { BaseEditor, Path, Selection } from 'slate'
import { ReactEditor } from 'slate-react'

export type CustomText = {
    highlight?: boolean;
    text: string;
}

export type CustomLineElement = {
    type: 'line';
    children: CustomText[]
}

export type CustomActionLinkElement = {
    type: 'actionLink';
    to: string;
    children: CustomText[]
}

export type CustomFeatureLinkElement = {
    type: 'featureLink';
    to: string;
    children: CustomText[]
}

export type CustomKnowledgeLinkElement = {
    type: 'knowledgeLink';
    to: string;
    children: CustomText[]
}

export type CustomLinkElement = CustomActionLinkElement | CustomFeatureLinkElement | CustomKnowledgeLinkElement

export type CustomLineBreak = {
    type: 'lineBreak';
}

export type CustomReplaceBlock = {
    type: 'replace';
    children: CustomParagraphContents[];
}

export type CustomInheritedReadOnlyElement = {
    type: 'inherited';
    children: CustomBlock[];
}

export type EmptyText = {
    text: string;
}

export type CustomIfWrapper = {
    type: 'ifWrapper';
    children: EmptyText[];
    treeId: string;
    subTree: GenericTreeNodeFiltered<SchemaConditionTag, SchemaTag>;
}

//
// CustomNewIfWrapper can only be created by the AddIf button, and is immediately
// processed by onChange into a CustomIfWrapper
//
export type CustomNewIfWrapper = {
    type: 'newIfWrapper';
    children: CustomParagraphContents[];
}

export type CustomExitBlock = {
    type: 'exit';
    key: string;
    from: string;
    to: string;
    children: CustomText[];
}

export type CustomParagraphContents = CustomText | EmptyText | CustomActionLinkElement | CustomFeatureLinkElement | CustomKnowledgeLinkElement | CustomLineBreak | CustomReplaceBlock | CustomIfWrapper | CustomNewIfWrapper

export const isCustomLineBreak = (item: CustomParagraphContents): item is CustomLineBreak => ('type' in item && item.type === 'lineBreak')
export const isCustomActionLink = (item: CustomParagraphContents): item is CustomActionLinkElement => ('type' in item && item.type === 'actionLink')
export const isCustomFeatureLink = (item: CustomParagraphContents): item is CustomFeatureLinkElement => ('type' in item && item.type === 'featureLink')
export const isCustomKnowledgeLink = (item: CustomParagraphContents): item is CustomKnowledgeLinkElement => ('type' in item && item.type === 'knowledgeLink')
export const isCustomLink = (item: CustomParagraphContents): item is CustomLinkElement => (isCustomActionLink(item) || isCustomFeatureLink(item) || isCustomKnowledgeLink(item))
export const isCustomText = (item: CustomParagraphContents): item is CustomText => ('text' in item)
export const isCustomReplaceBlock = (item: CustomParagraphContents): item is CustomReplaceBlock => ('type' in item && item.type === 'replace')
export const isCustomParagraph = (item: CustomElement): item is CustomParagraphElement => ('type' in item && item.type === 'paragraph')
export const isCustomInherited = (item: CustomElement): item is CustomInheritedReadOnlyElement => ('type' in item && item.type === 'inherited')
export const isCustomIfWrapper = (item: CustomBlock | CustomParagraphContents): item is CustomIfWrapper => ('type' in item && item.type === 'ifWrapper')
export const isCustomNewIfWrapper = (item: CustomBlock | CustomParagraphContents): item is CustomNewIfWrapper => ('type' in item && item.type === 'newIfWrapper')
// export const isCustomIfBlock = (item: CustomBlock | CustomParagraphContents): item is CustomIfBlock => ('type' in item && item.type === 'ifBase')
// export const isCustomElseIfBlock = (item: CustomBlock | CustomParagraphContents): item is CustomElseIfBlock => ('type' in item && item.type === 'elseif')
// export const isCustomElseBlock = (item: CustomBlock | CustomParagraphContents): item is CustomElseBlock => ('type' in item && item.type === 'else')

export const isCustomParagraphContents = (item: CustomElement | CustomText | CustomLineBreak): item is CustomParagraphContents => ((!('type' in item)) || ('type' in item && ['actionLink', 'featureLink', 'knowledgeLink', 'lineBreak', 'replace'].includes(item.type)))

export type CustomParagraphElement = {
    type: 'paragraph';
    explicitBR?: boolean;
    softBR?: boolean;
    children: CustomParagraphContents[]
}

type CustomElement = CustomLineElement |
    CustomLinkElement |
    CustomParagraphElement |
    CustomInheritedReadOnlyElement |
    CustomReplaceBlock |
    CustomIfWrapper |
    CustomNewIfWrapper

export type CustomBlock = CustomParagraphElement |
    CustomInheritedReadOnlyElement |
    CustomIfWrapper |
    CustomNewIfWrapper

export const isCustomBlock = (item: CustomElement | CustomText | CustomLineBreak): item is CustomBlock => ('type' in item && ['paragraph', 'inherited', 'replace', 'exit', 'ifWrapper', 'newIfWrapper'].includes(item.type))

declare module 'slate' {
    interface CustomTypes {
      Editor: BaseEditor & ReactEditor & { saveSelection?: Selection }
      Element: CustomElement
      Text: CustomText
    }
  }

export {}