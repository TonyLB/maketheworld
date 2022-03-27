import ohm from 'ohm-js';const result=ohm.makeRecipe(["grammar",{"source":"WMLQuerySelector {\r\n    WMLQueryContents = MatchAncestry\r\n\r\n    wmlLegalTag = \"Asset\" |\r\n        \"Character\" |\r\n        \"Name\" |\r\n        \"Pronouns\" |\r\n        \"OneCoolThing\" |\r\n        \"Outfit\" |\r\n        \"FirstImpression\" |\r\n        \"Condition\" |\r\n        \"Layer\" |\r\n        \"Exit\" |\r\n        \"Room\"\r\n\r\n    stringText = (~(\"<\" | \"{\" | \"\\\"\") any | \"\\\\<\" | \"\\\\{\" | \"\\\\\\\"\")+\r\n\r\n    legalProperties = \"key\" |\r\n        \"to\" |\r\n        \"from\"\r\n\r\n    propertyEqualityFilter = whitespace* legalProperties whitespace* \"=\\\"\" stringText \"\\\"\"\r\n\r\n    propertyFilter = \"[\" propertyEqualityFilter \"]\"\r\n\r\n    matchComponent = wmlLegalTag |\r\n        propertyFilter\r\n\r\n    matchPredicate = matchComponent+\r\n\r\n    MatchAncestry = matchPredicate+\r\n\r\n    whitespace = \"\\t\"\r\n        | \"\\x0B\"    -- verticalTab\r\n        | \"\\x0C\"    -- formFeed\r\n        | \" \"\r\n        | \"\\u00A0\"  -- noBreakSpace\r\n        | \"\\uFEFF\"  -- byteOrderMark\r\n\r\n}"},"WMLQuerySelector",null,"WMLQueryContents",{"WMLQueryContents":["define",{"sourceInterval":[24,56]},null,[],["app",{"sourceInterval":[43,56]},"MatchAncestry",[]]],"wmlLegalTag":["define",{"sourceInterval":[64,301]},null,[],["alt",{"sourceInterval":[78,301]},["terminal",{"sourceInterval":[78,85]},"Asset"],["terminal",{"sourceInterval":[97,108]},"Character"],["terminal",{"sourceInterval":[120,126]},"Name"],["terminal",{"sourceInterval":[138,148]},"Pronouns"],["terminal",{"sourceInterval":[160,174]},"OneCoolThing"],["terminal",{"sourceInterval":[186,194]},"Outfit"],["terminal",{"sourceInterval":[206,223]},"FirstImpression"],["terminal",{"sourceInterval":[235,246]},"Condition"],["terminal",{"sourceInterval":[258,265]},"Layer"],["terminal",{"sourceInterval":[277,283]},"Exit"],["terminal",{"sourceInterval":[295,301]},"Room"]]],"stringText":["define",{"sourceInterval":[309,373]},null,[],["plus",{"sourceInterval":[322,373]},["alt",{"sourceInterval":[323,371]},["seq",{"sourceInterval":[323,346]},["not",{"sourceInterval":[323,342]},["alt",{"sourceInterval":[325,341]},["terminal",{"sourceInterval":[325,328]},"<"],["terminal",{"sourceInterval":[331,334]},"{"],["terminal",{"sourceInterval":[337,341]},"\""]]],["app",{"sourceInterval":[343,346]},"any",[]]],["terminal",{"sourceInterval":[349,354]},"\\<"],["terminal",{"sourceInterval":[357,362]},"\\{"],["terminal",{"sourceInterval":[365,371]},"\\\""]]]],"legalProperties":["define",{"sourceInterval":[381,438]},null,[],["alt",{"sourceInterval":[399,438]},["terminal",{"sourceInterval":[399,404]},"key"],["terminal",{"sourceInterval":[416,420]},"to"],["terminal",{"sourceInterval":[432,438]},"from"]]],"propertyEqualityFilter":["define",{"sourceInterval":[446,532]},null,[],["seq",{"sourceInterval":[471,532]},["star",{"sourceInterval":[471,482]},["app",{"sourceInterval":[471,481]},"whitespace",[]]],["app",{"sourceInterval":[483,498]},"legalProperties",[]],["star",{"sourceInterval":[499,510]},["app",{"sourceInterval":[499,509]},"whitespace",[]]],["terminal",{"sourceInterval":[511,516]},"=\""],["app",{"sourceInterval":[517,527]},"stringText",[]],["terminal",{"sourceInterval":[528,532]},"\""]]],"propertyFilter":["define",{"sourceInterval":[540,587]},null,[],["seq",{"sourceInterval":[557,587]},["terminal",{"sourceInterval":[557,560]},"["],["app",{"sourceInterval":[561,583]},"propertyEqualityFilter",[]],["terminal",{"sourceInterval":[584,587]},"]"]]],"matchComponent":["define",{"sourceInterval":[595,649]},null,[],["alt",{"sourceInterval":[612,649]},["app",{"sourceInterval":[612,623]},"wmlLegalTag",[]],["app",{"sourceInterval":[635,649]},"propertyFilter",[]]]],"matchPredicate":["define",{"sourceInterval":[657,689]},null,[],["plus",{"sourceInterval":[674,689]},["app",{"sourceInterval":[674,688]},"matchComponent",[]]]],"MatchAncestry":["define",{"sourceInterval":[697,728]},null,[],["plus",{"sourceInterval":[713,728]},["app",{"sourceInterval":[713,727]},"matchPredicate",[]]]],"whitespace_verticalTab":["define",{"sourceInterval":[765,789]},null,[],["terminal",{"sourceInterval":[765,771]},"\u000b"]],"whitespace_formFeed":["define",{"sourceInterval":[801,822]},null,[],["terminal",{"sourceInterval":[801,807]},"\f"]],"whitespace_noBreakSpace":["define",{"sourceInterval":[849,874]},null,[],["terminal",{"sourceInterval":[849,857]}," "]],"whitespace_byteOrderMark":["define",{"sourceInterval":[886,912]},null,[],["terminal",{"sourceInterval":[886,894]},"﻿"]],"whitespace":["define",{"sourceInterval":[736,912]},null,[],["alt",{"sourceInterval":[749,912]},["terminal",{"sourceInterval":[749,753]},"\t"],["app",{"sourceInterval":[765,771]},"whitespace_verticalTab",[]],["app",{"sourceInterval":[801,807]},"whitespace_formFeed",[]],["terminal",{"sourceInterval":[834,837]}," "],["app",{"sourceInterval":[849,857]},"whitespace_noBreakSpace",[]],["app",{"sourceInterval":[886,894]},"whitespace_byteOrderMark",[]]]]}]);export default result;