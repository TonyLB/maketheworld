import { BaseEditor } from 'slate'
import { ReactEditor } from 'slate-react'

export type CustomElement = { type: 'line'; children: CustomText[] }
export type CustomText = { text: string }

declare module 'slate' {
    interface CustomTypes {
      Editor: BaseEditor & ReactEditor
      Element: CustomElement
      Text: CustomText
    }
  }

export {}