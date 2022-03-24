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

export type CustomDescriptionElement = {
    type: 'description';
    children: (CustomText | CustomActionLinkElement | CustomFeatureLinkElement)[]
}

type CustomElement = CustomLineElement |
    CustomActionLinkElement |
    CustomFeatureLinkElement |
    CustomDescriptionElement

declare module 'slate' {
    interface CustomTypes {
      Editor: BaseEditor & ReactEditor & { saveSelection?: Selection }
      Element: CustomElement
      Text: CustomText
    }
  }

export {}