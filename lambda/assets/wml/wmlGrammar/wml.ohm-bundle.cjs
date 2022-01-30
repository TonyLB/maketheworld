'use strict';const ohm=require('ohm-js');module.exports=ohm.makeRecipe(["grammar",{"source":"WorldMarkupLangage {\r\n\r\n    //\r\n    // This section defines the tags that make up the WML language\r\n    //\r\n\r\n    WMLFileContents = AssetExpression\r\n            | CharacterExpression\r\n\r\n    CharacterExpression = TagExpression<\"Character\", (\"key\" | \"player\" | \"fileName\" | \"zone\" | \"subFolder\"), none, none, CharacterLegalContents>\r\n    CharacterLegalContents = LiteralNameExpression\r\n            | LiteralValueTag<\"Pronouns\">\r\n            | LiteralValueTag<\"OneCoolThing\">\r\n            | LiteralValueTag<\"Outfit\">\r\n            | LiteralValueTag<\"FirstImpression\">\r\n\r\n    AssetExpression = TagExpression<\"Asset\", (\"key\" | \"fileName\" | \"zone\" | \"subFolder\"), none, none, AssetLegalContents>\r\n    AssetLegalContents = LayerExpression\r\n            | ConditionExpression\r\n            | RoomExpression\r\n            | ExitExpression\r\n            | LiteralNameExpression\r\n            | string\r\n\r\n    ImportExpression = TagExpression<\"Import\", (\"from\"), none, none, ImportLegalContents>\r\n    ImportLegalContents = UseExpression\r\n\r\n    UseExpression = TagExpression<\"Use\", (\"key\" | \"as\"), none, none, none>\r\n\r\n    ConditionExpression = TagExpression<\"Condition\", none, \"if\", none, ConditionLegalContents>\r\n    ConditionLegalContents = RoomExpression\r\n            | ConditionExpression\r\n            | TextContents\r\n            | LayerExpression\r\n            | ExitExpression\r\n\r\n    LayerExpression = TagExpression<\"Layer\", \"key\", none, none, LayerLegalContents>\r\n    LayerLegalContents = RoomExpression\r\n            | ConditionExpression\r\n            | ExitExpression\r\n\r\n    ExitExpression = TagExpression<\"Exit\", (\"key\" | \"to\" | \"from\"), none, none, string>\r\n            | TagSelfClosing<\"Exit\", (\"key\" | \"to\" | \"from\"), none, none>\r\n\r\n    RoomExpression = TagExpression<\"Room\", (\"key\" | \"display\"), none, \"global\", RoomContents>\r\n    RoomContents = TextContents\r\n            | NameExpression\r\n            | ExitExpression\r\n\r\n    LiteralNameExpression = LiteralValueTag<\"Name\">\r\n    NameExpression = ValueTag<\"Name\">\r\n\r\n    LiteralValueTag<label> = TagExpression<label, none, none, none, string>\r\n\r\n    ValueTag<label> = TagExpression<label, none, none, none, TextContents>\r\n    TextContents = string | EmbeddedJSExpression\r\n\r\n    //\r\n    // The following define the ways in which tags can be structured\r\n    //\r\n\r\n    TagExpression<tag, tagLiteralArgs, tagProgramArgs, tagBooleanArgs, LegalContents> = TagOpen<tag, tagLiteralArgs, tagProgramArgs, tagBooleanArgs> LegalContents* TagClose<tag>\r\n    string = (stringText | spaceCompressor)+\r\n    stringText = (~(\"<\" | \"{\" | space) any | \"\\\\<\" | \"\\\\{\")+\r\n    spaceCompressor = (space)+\r\n    TagSelfClosing<tag, tagLiteralArgs, tagProgramArgs, tagBooleanArgs> = \"<\" tag TagArgument<tagLiteralArgs, tagProgramArgs, tagBooleanArgs>* \"/>\"\r\n    TagOpen<tag, tagLiteralArgs, tagProgramArgs, tagBooleanArgs> = \"<\" tag TagArgument<tagLiteralArgs, tagProgramArgs, tagBooleanArgs>* \">\"\r\n    TagArgument<tagLiteralArgs, tagProgramArgs, tagBooleanArgs> = TagLiteralArgument<tagLiteralArgs> | TagProgramArgument<tagProgramArgs> | tagBooleanArgument<tagBooleanArgs>\r\n    TagLiteralArgument<tagLiteralArgs> = tagArgumentQuoted<tagLiteralArgs>\r\n    TagProgramArgument<tagProgramArgs> = tagArgumentQuoted<tagProgramArgs> | TagArgumentBracketed<tagProgramArgs>\r\n    tagBooleanArgument<tagBooleanArgs> = tagBooleanArgs &(space | \">\" | \"/>\")\r\n    tagArgumentQuoted<tagLegalArgs> = tagLegalArgs \"=\\\"\" tagArgValueQuoted\r\n    TagArgumentBracketed<tagLegalArgs> = #(tagLegalArgs \"={\") JSExpression* \"}\"\r\n    tagArgValueQuoted = (\"\\\\\\\"\" | ~\"\\\"\" any)* \"\\\"\"\r\n    TagClose<tag> = \"</\" tag \">\"\r\n    none = ~\">\" \">\"\r\n\r\n    //\r\n    // EmbeddedJSExpression parses from the starting open bracket through to the\r\n    //   *MATCHING* close bracket, using a subset of JS syntax that concentrates\r\n    //   on all the ways that JS could let you mess up that matching (quotes,\r\n    //   nesting, and template literals figuring high on the list)\r\n    //\r\n    // While we could, technically, validate the entire ES5 JS Syntax (after all,\r\n    // Ohm publishes their schema), it wouldn't gain us any value here, and it\r\n    // has a quite noticeable resource cost:  Compiling that schema and executing\r\n    // it slows the perception Lambda function down to a crawl.  If a need for\r\n    // such pre-processing emerges, look into how to optimize compiling and executing\r\n    // very large Ohm schemata.\r\n    //\r\n    EmbeddedJSExpression = \"{\" JSExpression* \"}\"\r\n    JSExpression = EmbeddedJSExpression\r\n                    | JSDoubleQuotedString\r\n                    | JSSingleQuotedString\r\n                    | JSTemplateString\r\n                    | JSText\r\n    JSDoubleQuotedString = \"\\\"\" JSNoDoubleQuote* \"\\\"\"\r\n    JSNoDoubleQuote = \"\\\\\\\"\" | (~\"\\\"\" any)\r\n    JSSingleQuotedString = \"\\'\" JSNoSingleQuote* \"\\'\"\r\n    JSNoSingleQuote = \"\\\\\\'\" | (~\"\\'\" any)\r\n    JSTemplateString = \"`\" (JSNoBackQuote | JSTemplateEvaluation )* \"`\"\r\n    JSTemplateEvaluation = \"${\" JSExpression \"}\"\r\n    JSNoBackQuote = \"\\\\`\" | (~(\"`\" | \"${\") any)\r\n    JSText = (\"\\\\{\" | \"\\\\\\\"\" | \"\\\\'\" | \"\\\\`\" | \"\\\\}\" | (~(\"{\" | \"\\\"\" | \"\\'\" | \"`\" | \"}\") any))+\r\n\r\n    // Override Ohm's built-in definition of space.  Cribbed from es5.ohm\r\n    space := whitespace | lineTerminator | comment\r\n\r\n\tsourceCharacter = any\r\n    whitespace = \"\\t\"\r\n                | \"\\x0B\"    -- verticalTab\r\n                | \"\\x0C\"    -- formFeed\r\n                | \" \"\r\n                | \"\\u00A0\"  -- noBreakSpace\r\n                | \"\\uFEFF\"  -- byteOrderMark\r\n                | unicodeSpaceSeparator\r\n\r\n\tunicodeSpaceSeparator = \"\\u2000\"..\"\\u200B\" | \"\\u3000\"\r\n\r\n    lineTerminator = \"\\n\" | \"\\r\" | \"\\u2028\" | \"\\u2029\"\r\n    lineTerminatorSequence = \"\\n\" | \"\\r\" ~\"\\n\" | \"\\u2028\" | \"\\u2029\" | \"\\r\\n\"\r\n\r\n    comment = multiLineComment | singleLineComment\r\n\r\n    multiLineComment = \"/*\" (~\"*/\" sourceCharacter)* \"*/\"\r\n    singleLineComment = \"//\" (~lineTerminator sourceCharacter)*\r\n\r\n}"},"WorldMarkupLangage",null,"WMLFileContents",{"WMLFileContents":["define",{"sourceInterval":[114,182]},null,[],["alt",{"sourceInterval":[132,182]},["app",{"sourceInterval":[132,147]},"AssetExpression",[]],["app",{"sourceInterval":[163,182]},"CharacterExpression",[]]]],"CharacterExpression":["define",{"sourceInterval":[190,330]},null,[],["app",{"sourceInterval":[212,330]},"TagExpression",[["terminal",{"sourceInterval":[226,237]},"Character"],["alt",{"sourceInterval":[239,293]},["terminal",{"sourceInterval":[240,245]},"key"],["terminal",{"sourceInterval":[248,256]},"player"],["terminal",{"sourceInterval":[259,269]},"fileName"],["terminal",{"sourceInterval":[272,278]},"zone"],["terminal",{"sourceInterval":[281,292]},"subFolder"]],["app",{"sourceInterval":[295,299]},"none",[]],["app",{"sourceInterval":[301,305]},"none",[]],["app",{"sourceInterval":[307,329]},"CharacterLegalContents",[]]]]],"CharacterLegalContents":["define",{"sourceInterval":[336,563]},null,[],["alt",{"sourceInterval":[361,563]},["app",{"sourceInterval":[361,382]},"LiteralNameExpression",[]],["app",{"sourceInterval":[398,425]},"LiteralValueTag",[["terminal",{"sourceInterval":[414,424]},"Pronouns"]]],["app",{"sourceInterval":[441,472]},"LiteralValueTag",[["terminal",{"sourceInterval":[457,471]},"OneCoolThing"]]],["app",{"sourceInterval":[488,513]},"LiteralValueTag",[["terminal",{"sourceInterval":[504,512]},"Outfit"]]],["app",{"sourceInterval":[529,563]},"LiteralValueTag",[["terminal",{"sourceInterval":[545,562]},"FirstImpression"]]]]],"AssetExpression":["define",{"sourceInterval":[571,688]},null,[],["app",{"sourceInterval":[589,688]},"TagExpression",[["terminal",{"sourceInterval":[603,610]},"Asset"],["alt",{"sourceInterval":[612,655]},["terminal",{"sourceInterval":[613,618]},"key"],["terminal",{"sourceInterval":[621,631]},"fileName"],["terminal",{"sourceInterval":[634,640]},"zone"],["terminal",{"sourceInterval":[643,654]},"subFolder"]],["app",{"sourceInterval":[657,661]},"none",[]],["app",{"sourceInterval":[663,667]},"none",[]],["app",{"sourceInterval":[669,687]},"AssetLegalContents",[]]]]],"AssetLegalContents":["define",{"sourceInterval":[694,884]},null,[],["alt",{"sourceInterval":[715,884]},["app",{"sourceInterval":[715,730]},"LayerExpression",[]],["app",{"sourceInterval":[746,765]},"ConditionExpression",[]],["app",{"sourceInterval":[781,795]},"RoomExpression",[]],["app",{"sourceInterval":[811,825]},"ExitExpression",[]],["app",{"sourceInterval":[841,862]},"LiteralNameExpression",[]],["app",{"sourceInterval":[878,884]},"string",[]]]],"ImportExpression":["define",{"sourceInterval":[892,977]},null,[],["app",{"sourceInterval":[911,977]},"TagExpression",[["terminal",{"sourceInterval":[925,933]},"Import"],["terminal",{"sourceInterval":[935,943]},"from"],["app",{"sourceInterval":[945,949]},"none",[]],["app",{"sourceInterval":[951,955]},"none",[]],["app",{"sourceInterval":[957,976]},"ImportLegalContents",[]]]]],"ImportLegalContents":["define",{"sourceInterval":[983,1018]},null,[],["app",{"sourceInterval":[1005,1018]},"UseExpression",[]]],"UseExpression":["define",{"sourceInterval":[1026,1096]},null,[],["app",{"sourceInterval":[1042,1096]},"TagExpression",[["terminal",{"sourceInterval":[1056,1061]},"Use"],["alt",{"sourceInterval":[1063,1077]},["terminal",{"sourceInterval":[1064,1069]},"key"],["terminal",{"sourceInterval":[1072,1076]},"as"]],["app",{"sourceInterval":[1079,1083]},"none",[]],["app",{"sourceInterval":[1085,1089]},"none",[]],["app",{"sourceInterval":[1091,1095]},"none",[]]]]],"ConditionExpression":["define",{"sourceInterval":[1104,1194]},null,[],["app",{"sourceInterval":[1126,1194]},"TagExpression",[["terminal",{"sourceInterval":[1140,1151]},"Condition"],["app",{"sourceInterval":[1153,1157]},"none",[]],["terminal",{"sourceInterval":[1159,1163]},"if"],["app",{"sourceInterval":[1165,1169]},"none",[]],["app",{"sourceInterval":[1171,1193]},"ConditionLegalContents",[]]]]],"ConditionLegalContents":["define",{"sourceInterval":[1200,1363]},null,[],["alt",{"sourceInterval":[1225,1363]},["app",{"sourceInterval":[1225,1239]},"RoomExpression",[]],["app",{"sourceInterval":[1255,1274]},"ConditionExpression",[]],["app",{"sourceInterval":[1290,1302]},"TextContents",[]],["app",{"sourceInterval":[1318,1333]},"LayerExpression",[]],["app",{"sourceInterval":[1349,1363]},"ExitExpression",[]]]],"LayerExpression":["define",{"sourceInterval":[1371,1450]},null,[],["app",{"sourceInterval":[1389,1450]},"TagExpression",[["terminal",{"sourceInterval":[1403,1410]},"Layer"],["terminal",{"sourceInterval":[1412,1417]},"key"],["app",{"sourceInterval":[1419,1423]},"none",[]],["app",{"sourceInterval":[1425,1429]},"none",[]],["app",{"sourceInterval":[1431,1449]},"LayerLegalContents",[]]]]],"LayerLegalContents":["define",{"sourceInterval":[1456,1556]},null,[],["alt",{"sourceInterval":[1477,1556]},["app",{"sourceInterval":[1477,1491]},"RoomExpression",[]],["app",{"sourceInterval":[1507,1526]},"ConditionExpression",[]],["app",{"sourceInterval":[1542,1556]},"ExitExpression",[]]]],"ExitExpression":["define",{"sourceInterval":[1564,1722]},null,[],["alt",{"sourceInterval":[1581,1722]},["app",{"sourceInterval":[1581,1647]},"TagExpression",[["terminal",{"sourceInterval":[1595,1601]},"Exit"],["alt",{"sourceInterval":[1603,1626]},["terminal",{"sourceInterval":[1604,1609]},"key"],["terminal",{"sourceInterval":[1612,1616]},"to"],["terminal",{"sourceInterval":[1619,1625]},"from"]],["app",{"sourceInterval":[1628,1632]},"none",[]],["app",{"sourceInterval":[1634,1638]},"none",[]],["app",{"sourceInterval":[1640,1646]},"string",[]]]],["app",{"sourceInterval":[1663,1722]},"TagSelfClosing",[["terminal",{"sourceInterval":[1678,1684]},"Exit"],["alt",{"sourceInterval":[1686,1709]},["terminal",{"sourceInterval":[1687,1692]},"key"],["terminal",{"sourceInterval":[1695,1699]},"to"],["terminal",{"sourceInterval":[1702,1708]},"from"]],["app",{"sourceInterval":[1711,1715]},"none",[]],["app",{"sourceInterval":[1717,1721]},"none",[]]]]]],"RoomExpression":["define",{"sourceInterval":[1730,1819]},null,[],["app",{"sourceInterval":[1747,1819]},"TagExpression",[["terminal",{"sourceInterval":[1761,1767]},"Room"],["alt",{"sourceInterval":[1769,1788]},["terminal",{"sourceInterval":[1770,1775]},"key"],["terminal",{"sourceInterval":[1778,1787]},"display"]],["app",{"sourceInterval":[1790,1794]},"none",[]],["terminal",{"sourceInterval":[1796,1804]},"global"],["app",{"sourceInterval":[1806,1818]},"RoomContents",[]]]]],"RoomContents":["define",{"sourceInterval":[1825,1912]},null,[],["alt",{"sourceInterval":[1840,1912]},["app",{"sourceInterval":[1840,1852]},"TextContents",[]],["app",{"sourceInterval":[1868,1882]},"NameExpression",[]],["app",{"sourceInterval":[1898,1912]},"ExitExpression",[]]]],"LiteralNameExpression":["define",{"sourceInterval":[1920,1967]},null,[],["app",{"sourceInterval":[1944,1967]},"LiteralValueTag",[["terminal",{"sourceInterval":[1960,1966]},"Name"]]]],"NameExpression":["define",{"sourceInterval":[1973,2006]},null,[],["app",{"sourceInterval":[1990,2006]},"ValueTag",[["terminal",{"sourceInterval":[1999,2005]},"Name"]]]],"LiteralValueTag":["define",{"sourceInterval":[2014,2085]},null,["label"],["app",{"sourceInterval":[2039,2085]},"TagExpression",[["param",{"sourceInterval":[2053,2058]},0],["app",{"sourceInterval":[2060,2064]},"none",[]],["app",{"sourceInterval":[2066,2070]},"none",[]],["app",{"sourceInterval":[2072,2076]},"none",[]],["app",{"sourceInterval":[2078,2084]},"string",[]]]]],"ValueTag":["define",{"sourceInterval":[2093,2163]},null,["label"],["app",{"sourceInterval":[2111,2163]},"TagExpression",[["param",{"sourceInterval":[2125,2130]},0],["app",{"sourceInterval":[2132,2136]},"none",[]],["app",{"sourceInterval":[2138,2142]},"none",[]],["app",{"sourceInterval":[2144,2148]},"none",[]],["app",{"sourceInterval":[2150,2162]},"TextContents",[]]]]],"TextContents":["define",{"sourceInterval":[2169,2213]},null,[],["alt",{"sourceInterval":[2184,2213]},["app",{"sourceInterval":[2184,2190]},"string",[]],["app",{"sourceInterval":[2193,2213]},"EmbeddedJSExpression",[]]]],"TagExpression":["define",{"sourceInterval":[2309,2482]},null,["tag","tagLiteralArgs","tagProgramArgs","tagBooleanArgs","LegalContents"],["seq",{"sourceInterval":[2393,2482]},["app",{"sourceInterval":[2393,2453]},"TagOpen",[["param",{"sourceInterval":[2401,2404]},0],["param",{"sourceInterval":[2406,2420]},1],["param",{"sourceInterval":[2422,2436]},2],["param",{"sourceInterval":[2438,2452]},3]]],["star",{"sourceInterval":[2454,2468]},["param",{"sourceInterval":[2454,2467]},4]],["app",{"sourceInterval":[2469,2482]},"TagClose",[["param",{"sourceInterval":[2478,2481]},0]]]]],"string":["define",{"sourceInterval":[2488,2528]},null,[],["plus",{"sourceInterval":[2497,2528]},["alt",{"sourceInterval":[2498,2526]},["app",{"sourceInterval":[2498,2508]},"stringText",[]],["app",{"sourceInterval":[2511,2526]},"spaceCompressor",[]]]]],"stringText":["define",{"sourceInterval":[2534,2590]},null,[],["plus",{"sourceInterval":[2547,2590]},["alt",{"sourceInterval":[2548,2588]},["seq",{"sourceInterval":[2548,2572]},["not",{"sourceInterval":[2548,2568]},["alt",{"sourceInterval":[2550,2567]},["terminal",{"sourceInterval":[2550,2553]},"<"],["terminal",{"sourceInterval":[2556,2559]},"{"],["app",{"sourceInterval":[2562,2567]},"space",[]]]],["app",{"sourceInterval":[2569,2572]},"any",[]]],["terminal",{"sourceInterval":[2575,2580]},"\\<"],["terminal",{"sourceInterval":[2583,2588]},"\\{"]]]],"spaceCompressor":["define",{"sourceInterval":[2596,2622]},null,[],["plus",{"sourceInterval":[2614,2622]},["app",{"sourceInterval":[2615,2620]},"space",[]]]],"TagSelfClosing":["define",{"sourceInterval":[2628,2771]},null,["tag","tagLiteralArgs","tagProgramArgs","tagBooleanArgs"],["seq",{"sourceInterval":[2698,2771]},["terminal",{"sourceInterval":[2698,2701]},"<"],["param",{"sourceInterval":[2702,2705]},0],["star",{"sourceInterval":[2706,2766]},["app",{"sourceInterval":[2706,2765]},"TagArgument",[["param",{"sourceInterval":[2718,2732]},1],["param",{"sourceInterval":[2734,2748]},2],["param",{"sourceInterval":[2750,2764]},3]]]],["terminal",{"sourceInterval":[2767,2771]},"/>"]]],"TagOpen":["define",{"sourceInterval":[2777,2912]},null,["tag","tagLiteralArgs","tagProgramArgs","tagBooleanArgs"],["seq",{"sourceInterval":[2840,2912]},["terminal",{"sourceInterval":[2840,2843]},"<"],["param",{"sourceInterval":[2844,2847]},0],["star",{"sourceInterval":[2848,2908]},["app",{"sourceInterval":[2848,2907]},"TagArgument",[["param",{"sourceInterval":[2860,2874]},1],["param",{"sourceInterval":[2876,2890]},2],["param",{"sourceInterval":[2892,2906]},3]]]],["terminal",{"sourceInterval":[2909,2912]},">"]]],"TagArgument":["define",{"sourceInterval":[2918,3088]},null,["tagLiteralArgs","tagProgramArgs","tagBooleanArgs"],["alt",{"sourceInterval":[2980,3088]},["app",{"sourceInterval":[2980,3014]},"TagLiteralArgument",[["param",{"sourceInterval":[2999,3013]},0]]],["app",{"sourceInterval":[3017,3051]},"TagProgramArgument",[["param",{"sourceInterval":[3036,3050]},1]]],["app",{"sourceInterval":[3054,3088]},"tagBooleanArgument",[["param",{"sourceInterval":[3073,3087]},2]]]]],"TagLiteralArgument":["define",{"sourceInterval":[3094,3164]},null,["tagLiteralArgs"],["app",{"sourceInterval":[3131,3164]},"tagArgumentQuoted",[["param",{"sourceInterval":[3149,3163]},0]]]],"TagProgramArgument":["define",{"sourceInterval":[3170,3279]},null,["tagProgramArgs"],["alt",{"sourceInterval":[3207,3279]},["app",{"sourceInterval":[3207,3240]},"tagArgumentQuoted",[["param",{"sourceInterval":[3225,3239]},0]]],["app",{"sourceInterval":[3243,3279]},"TagArgumentBracketed",[["param",{"sourceInterval":[3264,3278]},0]]]]],"tagBooleanArgument":["define",{"sourceInterval":[3285,3358]},null,["tagBooleanArgs"],["seq",{"sourceInterval":[3322,3358]},["param",{"sourceInterval":[3322,3336]},0],["lookahead",{"sourceInterval":[3337,3358]},["alt",{"sourceInterval":[3339,3357]},["app",{"sourceInterval":[3339,3344]},"space",[]],["terminal",{"sourceInterval":[3347,3350]},">"],["terminal",{"sourceInterval":[3353,3357]},"/>"]]]]],"tagArgumentQuoted":["define",{"sourceInterval":[3364,3434]},null,["tagLegalArgs"],["seq",{"sourceInterval":[3398,3434]},["param",{"sourceInterval":[3398,3410]},0],["terminal",{"sourceInterval":[3411,3416]},"=\""],["app",{"sourceInterval":[3417,3434]},"tagArgValueQuoted",[]]]],"TagArgumentBracketed":["define",{"sourceInterval":[3440,3515]},null,["tagLegalArgs"],["seq",{"sourceInterval":[3477,3515]},["lex",{"sourceInterval":[3477,3497]},["seq",{"sourceInterval":[3479,3496]},["param",{"sourceInterval":[3479,3491]},0],["terminal",{"sourceInterval":[3492,3496]},"={"]]],["star",{"sourceInterval":[3498,3511]},["app",{"sourceInterval":[3498,3510]},"JSExpression",[]]],["terminal",{"sourceInterval":[3512,3515]},"}"]]],"tagArgValueQuoted":["define",{"sourceInterval":[3521,3567]},null,[],["seq",{"sourceInterval":[3541,3567]},["star",{"sourceInterval":[3541,3562]},["alt",{"sourceInterval":[3542,3560]},["terminal",{"sourceInterval":[3542,3548]},"\\\""],["seq",{"sourceInterval":[3551,3560]},["not",{"sourceInterval":[3551,3556]},["terminal",{"sourceInterval":[3552,3556]},"\""]],["app",{"sourceInterval":[3557,3560]},"any",[]]]]],["terminal",{"sourceInterval":[3563,3567]},"\""]]],"TagClose":["define",{"sourceInterval":[3573,3601]},null,["tag"],["seq",{"sourceInterval":[3589,3601]},["terminal",{"sourceInterval":[3589,3593]},"</"],["param",{"sourceInterval":[3594,3597]},0],["terminal",{"sourceInterval":[3598,3601]},">"]]],"none":["define",{"sourceInterval":[3607,3622]},null,[],["seq",{"sourceInterval":[3614,3622]},["not",{"sourceInterval":[3614,3618]},["terminal",{"sourceInterval":[3615,3618]},">"]],["terminal",{"sourceInterval":[3619,3622]},">"]]],"EmbeddedJSExpression":["define",{"sourceInterval":[4411,4455]},null,[],["seq",{"sourceInterval":[4434,4455]},["terminal",{"sourceInterval":[4434,4437]},"{"],["star",{"sourceInterval":[4438,4451]},["app",{"sourceInterval":[4438,4450]},"JSExpression",[]]],["terminal",{"sourceInterval":[4452,4455]},"}"]]],"JSExpression":["define",{"sourceInterval":[4461,4654]},null,[],["alt",{"sourceInterval":[4476,4654]},["app",{"sourceInterval":[4476,4496]},"EmbeddedJSExpression",[]],["app",{"sourceInterval":[4520,4540]},"JSDoubleQuotedString",[]],["app",{"sourceInterval":[4564,4584]},"JSSingleQuotedString",[]],["app",{"sourceInterval":[4608,4624]},"JSTemplateString",[]],["app",{"sourceInterval":[4648,4654]},"JSText",[]]]],"JSDoubleQuotedString":["define",{"sourceInterval":[4660,4709]},null,[],["seq",{"sourceInterval":[4683,4709]},["terminal",{"sourceInterval":[4683,4687]},"\""],["star",{"sourceInterval":[4688,4704]},["app",{"sourceInterval":[4688,4703]},"JSNoDoubleQuote",[]]],["terminal",{"sourceInterval":[4705,4709]},"\""]]],"JSNoDoubleQuote":["define",{"sourceInterval":[4715,4753]},null,[],["alt",{"sourceInterval":[4733,4753]},["terminal",{"sourceInterval":[4733,4739]},"\\\""],["seq",{"sourceInterval":[4742,4753]},["not",{"sourceInterval":[4743,4748]},["terminal",{"sourceInterval":[4744,4748]},"\""]],["app",{"sourceInterval":[4749,4752]},"any",[]]]]],"JSSingleQuotedString":["define",{"sourceInterval":[4759,4808]},null,[],["seq",{"sourceInterval":[4782,4808]},["terminal",{"sourceInterval":[4782,4786]},"'"],["star",{"sourceInterval":[4787,4803]},["app",{"sourceInterval":[4787,4802]},"JSNoSingleQuote",[]]],["terminal",{"sourceInterval":[4804,4808]},"'"]]],"JSNoSingleQuote":["define",{"sourceInterval":[4814,4852]},null,[],["alt",{"sourceInterval":[4832,4852]},["terminal",{"sourceInterval":[4832,4838]},"\\'"],["seq",{"sourceInterval":[4841,4852]},["not",{"sourceInterval":[4842,4847]},["terminal",{"sourceInterval":[4843,4847]},"'"]],["app",{"sourceInterval":[4848,4851]},"any",[]]]]],"JSTemplateString":["define",{"sourceInterval":[4858,4925]},null,[],["seq",{"sourceInterval":[4877,4925]},["terminal",{"sourceInterval":[4877,4880]},"`"],["star",{"sourceInterval":[4881,4921]},["alt",{"sourceInterval":[4882,4918]},["app",{"sourceInterval":[4882,4895]},"JSNoBackQuote",[]],["app",{"sourceInterval":[4898,4918]},"JSTemplateEvaluation",[]]]],["terminal",{"sourceInterval":[4922,4925]},"`"]]],"JSTemplateEvaluation":["define",{"sourceInterval":[4931,4975]},null,[],["seq",{"sourceInterval":[4954,4975]},["terminal",{"sourceInterval":[4954,4958]},"${"],["app",{"sourceInterval":[4959,4971]},"JSExpression",[]],["terminal",{"sourceInterval":[4972,4975]},"}"]]],"JSNoBackQuote":["define",{"sourceInterval":[4981,5024]},null,[],["alt",{"sourceInterval":[4997,5024]},["terminal",{"sourceInterval":[4997,5002]},"\\`"],["seq",{"sourceInterval":[5005,5024]},["not",{"sourceInterval":[5006,5019]},["alt",{"sourceInterval":[5008,5018]},["terminal",{"sourceInterval":[5008,5011]},"`"],["terminal",{"sourceInterval":[5014,5018]},"${"]]],["app",{"sourceInterval":[5020,5023]},"any",[]]]]],"JSText":["define",{"sourceInterval":[5030,5121]},null,[],["plus",{"sourceInterval":[5039,5121]},["alt",{"sourceInterval":[5040,5119]},["terminal",{"sourceInterval":[5040,5045]},"\\{"],["terminal",{"sourceInterval":[5048,5054]},"\\\""],["terminal",{"sourceInterval":[5057,5062]},"\\'"],["terminal",{"sourceInterval":[5065,5070]},"\\`"],["terminal",{"sourceInterval":[5073,5078]},"\\}"],["seq",{"sourceInterval":[5081,5119]},["not",{"sourceInterval":[5082,5114]},["alt",{"sourceInterval":[5084,5113]},["terminal",{"sourceInterval":[5084,5087]},"{"],["terminal",{"sourceInterval":[5090,5094]},"\""],["terminal",{"sourceInterval":[5097,5101]},"'"],["terminal",{"sourceInterval":[5104,5107]},"`"],["terminal",{"sourceInterval":[5110,5113]},"}"]]],["app",{"sourceInterval":[5115,5118]},"any",[]]]]]],"space":["override",{"sourceInterval":[5204,5250]},null,[],["alt",{"sourceInterval":[5213,5250]},["app",{"sourceInterval":[5213,5223]},"whitespace",[]],["app",{"sourceInterval":[5226,5240]},"lineTerminator",[]],["app",{"sourceInterval":[5243,5250]},"comment",[]]]],"sourceCharacter":["define",{"sourceInterval":[5255,5276]},null,[],["app",{"sourceInterval":[5273,5276]},"any",[]]],"whitespace_verticalTab":["define",{"sourceInterval":[5319,5343]},null,[],["terminal",{"sourceInterval":[5319,5325]},"\u000b"]],"whitespace_formFeed":["define",{"sourceInterval":[5363,5384]},null,[],["terminal",{"sourceInterval":[5363,5369]},"\f"]],"whitespace_noBreakSpace":["define",{"sourceInterval":[5427,5452]},null,[],["terminal",{"sourceInterval":[5427,5435]}," "]],"whitespace_byteOrderMark":["define",{"sourceInterval":[5472,5498]},null,[],["terminal",{"sourceInterval":[5472,5480]},"﻿"]],"whitespace":["define",{"sourceInterval":[5282,5539]},null,[],["alt",{"sourceInterval":[5295,5539]},["terminal",{"sourceInterval":[5295,5299]},"\t"],["app",{"sourceInterval":[5319,5325]},"whitespace_verticalTab",[]],["app",{"sourceInterval":[5363,5369]},"whitespace_formFeed",[]],["terminal",{"sourceInterval":[5404,5407]}," "],["app",{"sourceInterval":[5427,5435]},"whitespace_noBreakSpace",[]],["app",{"sourceInterval":[5472,5480]},"whitespace_byteOrderMark",[]],["app",{"sourceInterval":[5518,5539]},"unicodeSpaceSeparator",[]]]],"unicodeSpaceSeparator":["define",{"sourceInterval":[5544,5597]},null,[],["alt",{"sourceInterval":[5568,5597]},["range",{"sourceInterval":[5568,5586]}," ","​"],["terminal",{"sourceInterval":[5589,5597]},"　"]]],"lineTerminator":["define",{"sourceInterval":[5605,5655]},null,[],["alt",{"sourceInterval":[5622,5655]},["terminal",{"sourceInterval":[5622,5626]},"\n"],["terminal",{"sourceInterval":[5629,5633]},"\r"],["terminal",{"sourceInterval":[5636,5644]},"\u2028"],["terminal",{"sourceInterval":[5647,5655]},"\u2029"]]],"lineTerminatorSequence":["define",{"sourceInterval":[5661,5734]},null,[],["alt",{"sourceInterval":[5686,5734]},["terminal",{"sourceInterval":[5686,5690]},"\n"],["seq",{"sourceInterval":[5693,5703]},["terminal",{"sourceInterval":[5693,5697]},"\r"],["not",{"sourceInterval":[5698,5703]},["terminal",{"sourceInterval":[5699,5703]},"\n"]]],["terminal",{"sourceInterval":[5706,5714]},"\u2028"],["terminal",{"sourceInterval":[5717,5725]},"\u2029"],["terminal",{"sourceInterval":[5728,5734]},"\r\n"]]],"comment":["define",{"sourceInterval":[5742,5788]},null,[],["alt",{"sourceInterval":[5752,5788]},["app",{"sourceInterval":[5752,5768]},"multiLineComment",[]],["app",{"sourceInterval":[5771,5788]},"singleLineComment",[]]]],"multiLineComment":["define",{"sourceInterval":[5796,5849]},null,[],["seq",{"sourceInterval":[5815,5849]},["terminal",{"sourceInterval":[5815,5819]},"/*"],["star",{"sourceInterval":[5820,5844]},["seq",{"sourceInterval":[5821,5842]},["not",{"sourceInterval":[5821,5826]},["terminal",{"sourceInterval":[5822,5826]},"*/"]],["app",{"sourceInterval":[5827,5842]},"sourceCharacter",[]]]],["terminal",{"sourceInterval":[5845,5849]},"*/"]]],"singleLineComment":["define",{"sourceInterval":[5855,5914]},null,[],["seq",{"sourceInterval":[5875,5914]},["terminal",{"sourceInterval":[5875,5879]},"//"],["star",{"sourceInterval":[5880,5914]},["seq",{"sourceInterval":[5881,5912]},["not",{"sourceInterval":[5881,5896]},["app",{"sourceInterval":[5882,5896]},"lineTerminator",[]]],["app",{"sourceInterval":[5897,5912]},"sourceCharacter",[]]]]]]}]);