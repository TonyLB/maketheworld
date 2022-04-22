import ohm from 'ohm-js';const result=ohm.makeRecipe(["grammar",{"source":"WMLQuerySelector {\r\n    WMLQueryContents = MatchAncestry\r\n\r\n    wmlLegalTag = \"Asset\" |\r\n        \"Character\" |\r\n        \"Name\" |\r\n        \"Pronouns\" |\r\n        \"OneCoolThing\" |\r\n        \"Outfit\" |\r\n        \"FirstImpression\" |\r\n        \"Condition\" |\r\n        \"Layer\" |\r\n        \"Exit\" |\r\n        \"Description\" |\r\n        \"Room\"\r\n\r\n    stringText = (~(\"<\" | \"{\" | \"\\\"\") any | \"\\\\<\" | \"\\\\{\" | \"\\\\\\\"\")+\r\n\r\n    legalProperties = \"key\" |\r\n        \"to\" |\r\n        \"from\"\r\n\r\n    propertyEqualityFilter = whitespace* legalProperties whitespace* \"=\\\"\" stringText \"\\\"\"\r\n\r\n    propertyFilter = \"[\" propertyEqualityFilter \"]\"\r\n\r\n    firstFilter = \":first\"\r\n\r\n    nthChildFilter = \":nthChild(\" digit* \")\"\r\n\r\n    matchComponent = wmlLegalTag |\r\n        propertyFilter |\r\n        firstFilter |\r\n        nthChildFilter\r\n\r\n    matchPredicate = matchComponent+\r\n\r\n    MatchAncestry = matchPredicate+\r\n\r\n    whitespace = \"\\t\"\r\n        | \"\\x0B\"    -- verticalTab\r\n        | \"\\x0C\"    -- formFeed\r\n        | \" \"\r\n        | \"\\u00A0\"  -- noBreakSpace\r\n        | \"\\uFEFF\"  -- byteOrderMark\r\n\r\n}"},"WMLQuerySelector",null,"WMLQueryContents",{"WMLQueryContents":["define",{"sourceInterval":[24,56]},null,[],["app",{"sourceInterval":[43,56]},"MatchAncestry",[]]],"wmlLegalTag":["define",{"sourceInterval":[64,326]},null,[],["alt",{"sourceInterval":[78,326]},["terminal",{"sourceInterval":[78,85]},"Asset"],["terminal",{"sourceInterval":[97,108]},"Character"],["terminal",{"sourceInterval":[120,126]},"Name"],["terminal",{"sourceInterval":[138,148]},"Pronouns"],["terminal",{"sourceInterval":[160,174]},"OneCoolThing"],["terminal",{"sourceInterval":[186,194]},"Outfit"],["terminal",{"sourceInterval":[206,223]},"FirstImpression"],["terminal",{"sourceInterval":[235,246]},"Condition"],["terminal",{"sourceInterval":[258,265]},"Layer"],["terminal",{"sourceInterval":[277,283]},"Exit"],["terminal",{"sourceInterval":[295,308]},"Description"],["terminal",{"sourceInterval":[320,326]},"Room"]]],"stringText":["define",{"sourceInterval":[334,398]},null,[],["plus",{"sourceInterval":[347,398]},["alt",{"sourceInterval":[348,396]},["seq",{"sourceInterval":[348,371]},["not",{"sourceInterval":[348,367]},["alt",{"sourceInterval":[350,366]},["terminal",{"sourceInterval":[350,353]},"<"],["terminal",{"sourceInterval":[356,359]},"{"],["terminal",{"sourceInterval":[362,366]},"\""]]],["app",{"sourceInterval":[368,371]},"any",[]]],["terminal",{"sourceInterval":[374,379]},"\\<"],["terminal",{"sourceInterval":[382,387]},"\\{"],["terminal",{"sourceInterval":[390,396]},"\\\""]]]],"legalProperties":["define",{"sourceInterval":[406,463]},null,[],["alt",{"sourceInterval":[424,463]},["terminal",{"sourceInterval":[424,429]},"key"],["terminal",{"sourceInterval":[441,445]},"to"],["terminal",{"sourceInterval":[457,463]},"from"]]],"propertyEqualityFilter":["define",{"sourceInterval":[471,557]},null,[],["seq",{"sourceInterval":[496,557]},["star",{"sourceInterval":[496,507]},["app",{"sourceInterval":[496,506]},"whitespace",[]]],["app",{"sourceInterval":[508,523]},"legalProperties",[]],["star",{"sourceInterval":[524,535]},["app",{"sourceInterval":[524,534]},"whitespace",[]]],["terminal",{"sourceInterval":[536,541]},"=\""],["app",{"sourceInterval":[542,552]},"stringText",[]],["terminal",{"sourceInterval":[553,557]},"\""]]],"propertyFilter":["define",{"sourceInterval":[565,612]},null,[],["seq",{"sourceInterval":[582,612]},["terminal",{"sourceInterval":[582,585]},"["],["app",{"sourceInterval":[586,608]},"propertyEqualityFilter",[]],["terminal",{"sourceInterval":[609,612]},"]"]]],"firstFilter":["define",{"sourceInterval":[620,642]},null,[],["terminal",{"sourceInterval":[634,642]},":first"]],"nthChildFilter":["define",{"sourceInterval":[650,690]},null,[],["seq",{"sourceInterval":[667,690]},["terminal",{"sourceInterval":[667,679]},":nthChild("],["star",{"sourceInterval":[680,686]},["app",{"sourceInterval":[680,685]},"digit",[]]],["terminal",{"sourceInterval":[687,690]},")"]]],"matchComponent":["define",{"sourceInterval":[698,801]},null,[],["alt",{"sourceInterval":[715,801]},["app",{"sourceInterval":[715,726]},"wmlLegalTag",[]],["app",{"sourceInterval":[738,752]},"propertyFilter",[]],["app",{"sourceInterval":[764,775]},"firstFilter",[]],["app",{"sourceInterval":[787,801]},"nthChildFilter",[]]]],"matchPredicate":["define",{"sourceInterval":[809,841]},null,[],["plus",{"sourceInterval":[826,841]},["app",{"sourceInterval":[826,840]},"matchComponent",[]]]],"MatchAncestry":["define",{"sourceInterval":[849,880]},null,[],["plus",{"sourceInterval":[865,880]},["app",{"sourceInterval":[865,879]},"matchPredicate",[]]]],"whitespace_verticalTab":["define",{"sourceInterval":[917,941]},null,[],["terminal",{"sourceInterval":[917,923]},"\u000b"]],"whitespace_formFeed":["define",{"sourceInterval":[953,974]},null,[],["terminal",{"sourceInterval":[953,959]},"\f"]],"whitespace_noBreakSpace":["define",{"sourceInterval":[1001,1026]},null,[],["terminal",{"sourceInterval":[1001,1009]}," "]],"whitespace_byteOrderMark":["define",{"sourceInterval":[1038,1064]},null,[],["terminal",{"sourceInterval":[1038,1046]},"﻿"]],"whitespace":["define",{"sourceInterval":[888,1064]},null,[],["alt",{"sourceInterval":[901,1064]},["terminal",{"sourceInterval":[901,905]},"\t"],["app",{"sourceInterval":[917,923]},"whitespace_verticalTab",[]],["app",{"sourceInterval":[953,959]},"whitespace_formFeed",[]],["terminal",{"sourceInterval":[986,989]}," "],["app",{"sourceInterval":[1001,1009]},"whitespace_noBreakSpace",[]],["app",{"sourceInterval":[1038,1046]},"whitespace_byteOrderMark",[]]]]}]);export default result;