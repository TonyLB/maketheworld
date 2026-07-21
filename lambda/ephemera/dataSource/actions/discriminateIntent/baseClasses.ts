// Iteration 7, Sub-iteration 1: classify's own IntentClassificationResult guards
// (Command / WorldQuestion / MultipleCommands / PromptInjectionAttempt / Unknown / Error) now
// live in `../baseClasses.ts` alongside the rest of that narrowed union. The family-specific
// guards this file used to hold (NavigationIntent, HomeIntent, AcmeOrderIntent,
// ObjectMembershipIntent, ObjectRelateIntent) were classify-LLM-output-only and are retired
// with the prompt sections that produced them --- see AGENT.classifyPlanGeneralization.planning.md.
export {}
