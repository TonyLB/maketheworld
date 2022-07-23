import { BaseAppearance } from "@tonylb/mtw-wml/dist/normalize"

export const noConditionContext = ({ contextStack }: BaseAppearance) => (!contextStack.find(({ tag }) => (tag === 'Condition')))
