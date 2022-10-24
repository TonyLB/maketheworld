import { BaseAppearance } from "@tonylb/mtw-wml/dist/normalize/baseClasses"

export const noConditionContext = ({ contextStack }: BaseAppearance) => (!contextStack.find(({ tag }) => (tag === 'If')))
