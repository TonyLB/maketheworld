import { ParseTag } from "../parser/baseClasses"

enum PrettyPrintEvaluations {
    Unevaluated,
    NoNesting,
    HasTagsToInheritNesting,
    MustNest
}

type ParsePrettyPrintEvaluation = {
    tag: ParseTag;
    evaluation: PrettyPrintEvaluations;
}
