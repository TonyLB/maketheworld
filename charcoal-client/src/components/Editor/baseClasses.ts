import { BaseEditor, Selection } from 'slate'
import { ReactEditor } from 'slate-react'

export type CustomText = {
    text: string;
}

export type CustomLineElement = {
    type: 'line';
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

export type CustomLinkElement = CustomFeatureLinkElement | CustomKnowledgeLinkElement

export type CustomLineBreak = {
    type: 'lineBreak';
}

export type EmptyText = {
    text: string;
}

export type CustomParagraphContents = CustomText | EmptyText | CustomFeatureLinkElement | CustomKnowledgeLinkElement | CustomLineBreak

export const isCustomLineBreak = (item: CustomParagraphContents): item is CustomLineBreak => ('type' in item && item.type === 'lineBreak')

export const isCustomFeatureLink = (item: CustomParagraphContents): item is CustomFeatureLinkElement => ('type' in item && item.type === 'featureLink')
export const isCustomKnowledgeLink = (item: CustomParagraphContents): item is CustomKnowledgeLinkElement => ('type' in item && item.type === 'knowledgeLink')
export const isCustomLink = (item: CustomParagraphContents): item is CustomLinkElement => (isCustomFeatureLink(item) || isCustomKnowledgeLink(item))
export const isCustomText = (item: CustomParagraphContents): item is CustomText => ('text' in item)
export const isCustomParagraph = (item: CustomElement): item is CustomParagraphElement => ('type' in item && item.type === 'paragraph')

export const isCustomParagraphContents = (item: CustomElement | CustomText | CustomLineBreak): item is CustomParagraphContents => ((!('type' in item)) || ('type' in item && ['featureLink', 'knowledgeLink', 'lineBreak'].includes(item.type)))

export type CustomParagraphElement = {
    type: 'paragraph';
    children: CustomParagraphContents[]
}

type CustomElement = CustomLineElement |
    CustomLinkElement |
    CustomParagraphElement

export type CustomBlock = CustomParagraphElement

export const isCustomBlock = (item: CustomElement | CustomText | CustomLineBreak): item is CustomBlock => ('type' in item && item.type === 'paragraph')

declare module 'slate' {
    interface CustomTypes {
      Editor: BaseEditor & ReactEditor & { saveSelection?: Selection }
      Element: CustomElement
      Text: CustomText
    }
  }

export {}
