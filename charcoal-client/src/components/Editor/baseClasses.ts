import { BaseEditor, Selection, Text } from 'slate'
import { ReactEditor } from 'slate-react'

/** Inline link elements (custom); paragraph and text use Slate defaults. */
export type CustomFeatureLinkElement = {
    type: 'featureLink';
    to: string;
    children: Text[]
}

export type CustomKnowledgeLinkElement = {
    type: 'knowledgeLink';
    to: string;
    children: Text[]
}

export type CustomLinkElement = CustomFeatureLinkElement | CustomKnowledgeLinkElement

/** Contents of a paragraph: Slate text nodes or our custom link inlines. */
export type CustomParagraphContents = Text | CustomFeatureLinkElement | CustomKnowledgeLinkElement

export const isCustomFeatureLink = (item: CustomParagraphContents): item is CustomFeatureLinkElement => ('type' in item && item.type === 'featureLink')
export const isCustomKnowledgeLink = (item: CustomParagraphContents): item is CustomKnowledgeLinkElement => ('type' in item && item.type === 'knowledgeLink')
export const isCustomLink = (item: CustomParagraphContents): item is CustomLinkElement => (isCustomFeatureLink(item) || isCustomKnowledgeLink(item))
export const isCustomParagraph = (item: CustomElement): item is CustomParagraphElement => ('type' in item && item.type === 'paragraph')

export const isCustomParagraphContents = (item: CustomElement | Text): item is CustomParagraphContents => ((!('type' in item)) || ('type' in item && ['featureLink', 'knowledgeLink'].includes(item.type)))

export type CustomParagraphElement = {
    type: 'paragraph';
    children: CustomParagraphContents[]
}

type CustomElement = CustomLinkElement | CustomParagraphElement

export type CustomBlock = CustomParagraphElement

export const isCustomBlock = (item: CustomElement | Text): item is CustomBlock => ('type' in item && item.type === 'paragraph')

declare module 'slate' {
    interface CustomTypes {
      Editor: BaseEditor & ReactEditor & { saveSelection?: Selection }
      Element: CustomElement
    }
  }

export {}
