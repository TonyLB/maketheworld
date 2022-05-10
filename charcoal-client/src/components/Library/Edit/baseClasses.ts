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
    key: string;
    children: CustomText[]
}

export type CustomFeatureLinkElement = {
    type: 'featureLink';
    to: string;
    key: string;
    children: CustomText[]
}

export type CustomParagraphContents = CustomText | CustomActionLinkElement | CustomFeatureLinkElement

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
    CustomDescriptionElement



declare module 'slate' {
    interface CustomTypes {
      Editor: BaseEditor & ReactEditor & { saveSelection?: Selection }
      Element: CustomElement
      Text: CustomText
    }
  }

export {}