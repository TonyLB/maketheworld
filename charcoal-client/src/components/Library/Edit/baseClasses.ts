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

export type CustomLinkElement = CustomActionLinkElement | CustomFeatureLinkElement

export type CustomLineBreak = {
    type: 'lineBreak';
}

export type CustomBeforeBlock = {
    type: 'before';
    children: CustomParagraphContents[];
}

export type CustomReplaceBlock = {
    type: 'replace';
    children: CustomParagraphContents[];
}

export type CustomIfBlock = {
    type: 'ifBase';
    source: string;
    isElseValid?: boolean;
    children: CustomBlock[];
}

export type CustomElseIfBlock = {
    type: 'elseif';
    source: string;
    isElseValid?: boolean;
    children: CustomBlock[];
}

export type CustomElseBlock = {
    type: 'else';
    children: CustomBlock[];
}

export type CustomExitBlock = {
    type: 'exit';
    key: string;
    from: string;
    to: string;
    children: CustomText[];
}

export type CustomParagraphContents = CustomText | CustomActionLinkElement | CustomFeatureLinkElement | CustomLineBreak | CustomBeforeBlock | CustomReplaceBlock

export const isCustomLineBreak = (item: CustomParagraphContents): item is CustomLineBreak => ('type' in item && item.type === 'lineBreak')
export const isCustomActionLink = (item: CustomParagraphContents): item is CustomActionLinkElement => ('type' in item && item.type === 'actionLink')
export const isCustomFeatureLink = (item: CustomParagraphContents): item is CustomFeatureLinkElement => ('type' in item && item.type === 'featureLink')
export const isCustomLink = (item: CustomParagraphContents): item is CustomLinkElement => (isCustomActionLink(item) || isCustomFeatureLink(item))
export const isCustomText = (item: CustomParagraphContents): item is CustomText => ('text' in item)
export const isCustomBeforeBlock = (item: CustomParagraphContents): item is CustomBeforeBlock => ('type' in item && item.type === 'before')
export const isCustomReplaceBlock = (item: CustomParagraphContents): item is CustomReplaceBlock => ('type' in item && item.type === 'replace')
export const isCustomParagraph = (item: CustomElement): item is CustomParagraphElement => ('type' in item && item.type === 'paragraph')
export const isCustomIfBlock = (item: CustomBlock | CustomParagraphContents): item is CustomIfBlock => ('type' in item && item.type === 'ifBase')
export const isCustomElseIfBlock = (item: CustomBlock | CustomParagraphContents): item is CustomElseIfBlock => ('type' in item && item.type === 'elseif')
export const isCustomElseBlock = (item: CustomBlock | CustomParagraphContents): item is CustomElseBlock => ('type' in item && item.type === 'else')
export const isCustomExitBlock = (item: CustomBlock | CustomParagraphContents): item is CustomExitBlock => ('type' in item && item.type === 'exit')

export const isCustomParagraphContents = (item: CustomElement | CustomText | CustomLineBreak): item is CustomParagraphContents => ((!('type' in item)) || ('type' in item && ['actionLink', 'featureLink', 'lineBreak', 'before', 'replace'].includes(item.type)))

export type CustomParagraphElement = {
    type: 'paragraph';
    explicitBR?: boolean;
    softBR?: boolean;
    children: CustomParagraphContents[]
}

type CustomElement = CustomLineElement |
    CustomActionLinkElement |
    CustomFeatureLinkElement |
    CustomParagraphElement |
    CustomBeforeBlock |
    CustomReplaceBlock |
    CustomIfBlock |
    CustomElseIfBlock |
    CustomElseBlock |
    CustomExitBlock

export type CustomBlock = CustomParagraphElement | CustomIfBlock | CustomElseIfBlock | CustomElseBlock | CustomExitBlock
export const isCustomBlock = (item: CustomElement | CustomText | CustomLineBreak): item is CustomBlock => ('type' in item && ['paragraph', 'ifBase', 'elseif', 'else'].includes(item.type))

declare module 'slate' {
    interface CustomTypes {
      Editor: BaseEditor & ReactEditor & { saveSelection?: Selection }
      Element: CustomElement
      Text: CustomText
    }
  }

export {}