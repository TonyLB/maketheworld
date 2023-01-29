import { BaseEditor, Selection } from 'slate'
import { ReactEditor } from 'slate-react'

export type CustomText = {
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

export type CustomParagraphContents = CustomText | CustomActionLinkElement | CustomFeatureLinkElement | CustomLineBreak | CustomBeforeBlock | CustomReplaceBlock

export const isCustomLineBreak = (item: CustomParagraphContents): item is CustomLineBreak => ('type' in item && item.type === 'lineBreak')
export const isCustomActionLink = (item: CustomParagraphContents): item is CustomActionLinkElement => ('type' in item && item.type === 'actionLink')
export const isCustomFeatureLink = (item: CustomParagraphContents): item is CustomFeatureLinkElement => ('type' in item && item.type === 'featureLink')
export const isCustomLink = (item: CustomParagraphContents): item is CustomLinkElement => (isCustomActionLink(item) || isCustomFeatureLink(item))
export const isCustomText = (item: CustomParagraphContents): item is CustomText => ('text' in item)
export const isCustomBeforeBlock = (item: CustomParagraphContents): item is CustomBeforeBlock => ('type' in item && item.type === 'before')
export const isCustomReplaceBlock = (item: CustomParagraphContents): item is CustomReplaceBlock => ('type' in item && item.type === 'replace')
export const isCustomElementWithChildren = (item: CustomText | CustomParagraphElement | CustomParagraphContents): item is CustomParagraphElement | CustomBeforeBlock | CustomReplaceBlock => ("type" in item && ['paragraph', 'before', 'replace'].includes(item.type))

export type CustomParagraphElement = {
    type: 'paragraph';
    children: CustomParagraphContents[]
}

export type CustomDescriptionElement = {
    type: 'description';
    children: CustomParagraphElement[]
}

type CustomElement = CustomLineElement |
    CustomActionLinkElement |
    CustomFeatureLinkElement |
    CustomParagraphElement |
    CustomDescriptionElement |
    CustomBeforeBlock |
    CustomReplaceBlock


declare module 'slate' {
    interface CustomTypes {
      Editor: BaseEditor & ReactEditor & { saveSelection?: Selection }
      Element: CustomElement
      Text: CustomText
    }
  }

export {}