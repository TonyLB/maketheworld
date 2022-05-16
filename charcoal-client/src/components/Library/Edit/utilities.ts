import { BaseAppearance } from "../../../wml/normalize"

export const noConditionContext = ({ contextStack }: BaseAppearance) => (!contextStack.find(({ tag }) => (tag === 'Condition')))
