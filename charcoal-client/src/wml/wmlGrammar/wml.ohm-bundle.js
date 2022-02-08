import ohm from 'ohm-js';const result=ohm.makeRecipe(["grammar",{"source":"WorldMarkupLangage {\r\n\r\n    //\r\n    // This section defines the tags that make up the WML language\r\n    //\r\n\r\n    WMLFileContents = AssetExpression\r\n            | CharacterExpression\r\n\r\n    CharacterExpression = TagExpression<\"Character\", (\"key\" | \"player\" | \"fileName\" | \"zone\" | \"subFolder\"), none, none, CharacterLegalContents>\r\n    CharacterLegalContents = LiteralNameExpression\r\n            | LiteralValueTag<\"Pronouns\">\r\n            | LiteralValueTag<\"OneCoolThing\">\r\n            | LiteralValueTag<\"Outfit\">\r\n            | LiteralValueTag<\"FirstImpression\">\r\n\r\n    AssetExpression = TagExpression<\"Asset\", (\"key\" | \"fileName\" | \"zone\" | \"subFolder\" | \"player\"), none, none, AssetLegalContents>\r\n    AssetLegalContents = ImportExpression\r\n            | VariableExpression\r\n            | LayerExpression\r\n            | ConditionExpression\r\n            | RoomExpression\r\n            | ExitExpression\r\n            | LiteralNameExpression\r\n            | string\r\n\r\n    ImportExpression = TagExpression<\"Import\", (\"from\"), none, none, ImportLegalContents>\r\n    ImportLegalContents = UseExpression\r\n\r\n    UseExpression = TagExpression<\"Use\", (\"key\" | \"as\"), none, none, none>\r\n            | TagSelfClosing<\"Use\", (\"key\" | \"as\"), none, none>\r\n\r\n    VariableExpression = TagExpression<\"Variable\", \"key\", \"default\", none, none>\r\n            | TagSelfClosing<\"Variable\", \"key\", \"default\", none>\r\n\r\n    ConditionExpression = TagExpression<\"Condition\", none, \"if\", none, ConditionLegalContents>\r\n    ConditionLegalContents = RoomExpression\r\n            | ConditionExpression\r\n            | TextContents\r\n            | LayerExpression\r\n            | ExitExpression\r\n\r\n    LayerExpression = TagExpression<\"Layer\", \"key\", none, none, LayerLegalContents>\r\n    LayerLegalContents = RoomExpression\r\n            | ConditionExpression\r\n            | ExitExpression\r\n\r\n    ExitExpression = TagExpression<\"Exit\", (\"key\" | \"to\" | \"from\"), none, none, string>\r\n            | TagSelfClosing<\"Exit\", (\"key\" | \"to\" | \"from\"), none, none>\r\n\r\n    RoomExpression = TagExpression<\"Room\", (\"key\" | \"display\"), none, \"global\", RoomContents>\r\n    RoomContents = TextContents\r\n            | NameExpression\r\n            | ExitExpression\r\n\r\n    LiteralNameExpression = LiteralValueTag<\"Name\">\r\n    NameExpression = ValueTag<\"Name\">\r\n\r\n    LiteralValueTag<label> = TagExpression<label, none, none, none, string>\r\n\r\n    ValueTag<label> = TagExpression<label, none, none, none, TextContents>\r\n    TextContents = string | EmbeddedJSExpression\r\n\r\n    //\r\n    // The following define the ways in which tags can be structured\r\n    //\r\n\r\n    TagExpression<tag, tagLiteralArgs, tagProgramArgs, tagBooleanArgs, LegalContents> = TagOpen<tag, tagLiteralArgs, tagProgramArgs, tagBooleanArgs> LegalContents* TagClose<tag>\r\n    string = (stringText | spaceCompressor)+\r\n    stringText = (~(\"<\" | \"{\" | space) any | \"\\\\<\" | \"\\\\{\")+\r\n    spaceCompressor = (space)+\r\n    TagSelfClosing<tag, tagLiteralArgs, tagProgramArgs, tagBooleanArgs> = \"<\" tag TagArgument<tagLiteralArgs, tagProgramArgs, tagBooleanArgs>* \"/>\"\r\n    TagOpen<tag, tagLiteralArgs, tagProgramArgs, tagBooleanArgs> = \"<\" tag TagArgument<tagLiteralArgs, tagProgramArgs, tagBooleanArgs>* \">\"\r\n    TagArgument<tagLiteralArgs, tagProgramArgs, tagBooleanArgs> = TagLiteralArgument<tagLiteralArgs> | TagProgramArgument<tagProgramArgs> | tagBooleanArgument<tagBooleanArgs>\r\n    TagLiteralArgument<tagLiteralArgs> = tagArgumentQuoted<tagLiteralArgs>\r\n    TagProgramArgument<tagProgramArgs> = tagArgumentQuoted<tagProgramArgs> | TagArgumentBracketed<tagProgramArgs>\r\n    tagBooleanArgument<tagBooleanArgs> = tagBooleanArgs &(space | \">\" | \"/>\")\r\n    tagArgumentQuoted<tagLegalArgs> = tagLegalArgs \"=\\\"\" tagArgValueQuoted\r\n    TagArgumentBracketed<tagLegalArgs> = #(tagLegalArgs \"={\") JSExpression* \"}\"\r\n    tagArgValueQuoted = (\"\\\\\\\"\" | ~\"\\\"\" any)* \"\\\"\"\r\n    TagClose<tag> = \"</\" tag \">\"\r\n    none = ~\">\" \">\"\r\n\r\n    //\r\n    // EmbeddedJSExpression parses from the starting open bracket through to the\r\n    //   *MATCHING* close bracket, using a subset of JS syntax that concentrates\r\n    //   on all the ways that JS could let you mess up that matching (quotes,\r\n    //   nesting, and template literals figuring high on the list)\r\n    //\r\n    // While we could, technically, validate the entire ES5 JS Syntax (after all,\r\n    // Ohm publishes their schema), it wouldn't gain us any value here, and it\r\n    // has a quite noticeable resource cost:  Compiling that schema and executing\r\n    // it slows the perception Lambda function down to a crawl.  If a need for\r\n    // such pre-processing emerges, look into how to optimize compiling and executing\r\n    // very large Ohm schemata.\r\n    //\r\n    EmbeddedJSExpression = \"{\" JSExpression* \"}\"\r\n    JSExpression = EmbeddedJSExpression\r\n                    | JSDoubleQuotedString\r\n                    | JSSingleQuotedString\r\n                    | JSTemplateString\r\n                    | JSText\r\n    JSDoubleQuotedString = \"\\\"\" JSNoDoubleQuote* \"\\\"\"\r\n    JSNoDoubleQuote = \"\\\\\\\"\" | (~\"\\\"\" any)\r\n    JSSingleQuotedString = \"\\'\" JSNoSingleQuote* \"\\'\"\r\n    JSNoSingleQuote = \"\\\\\\'\" | (~\"\\'\" any)\r\n    JSTemplateString = \"`\" (JSNoBackQuote | JSTemplateEvaluation )* \"`\"\r\n    JSTemplateEvaluation = \"${\" JSExpression \"}\"\r\n    JSNoBackQuote = \"\\\\`\" | (~(\"`\" | \"${\") any)\r\n    JSText = (\"\\\\{\" | \"\\\\\\\"\" | \"\\\\'\" | \"\\\\`\" | \"\\\\}\" | (~(\"{\" | \"\\\"\" | \"\\'\" | \"`\" | \"}\") any))+\r\n\r\n    // Override Ohm's built-in definition of space.  Cribbed from es5.ohm\r\n    space := whitespace | lineTerminator | comment\r\n\r\n\tsourceCharacter = any\r\n    whitespace = \"\\t\"\r\n                | \"\\x0B\"    -- verticalTab\r\n                | \"\\x0C\"    -- formFeed\r\n                | \" \"\r\n                | \"\\u00A0\"  -- noBreakSpace\r\n                | \"\\uFEFF\"  -- byteOrderMark\r\n                | unicodeSpaceSeparator\r\n\r\n\tunicodeSpaceSeparator = \"\\u2000\"..\"\\u200B\" | \"\\u3000\"\r\n\r\n    lineTerminator = \"\\n\" | \"\\r\" | \"\\u2028\" | \"\\u2029\"\r\n    lineTerminatorSequence = \"\\n\" | \"\\r\" ~\"\\n\" | \"\\u2028\" | \"\\u2029\" | \"\\r\\n\"\r\n\r\n    comment = multiLineComment | singleLineComment\r\n\r\n    multiLineComment = \"/*\" (~\"*/\" sourceCharacter)* \"*/\"\r\n    singleLineComment = \"//\" (~lineTerminator sourceCharacter)*\r\n\r\n}"},"WorldMarkupLangage",null,"WMLFileContents",{"WMLFileContents":["define",{"sourceInterval":[114,182]},null,[],["alt",{"sourceInterval":[132,182]},["app",{"sourceInterval":[132,147]},"AssetExpression",[]],["app",{"sourceInterval":[163,182]},"CharacterExpression",[]]]],"CharacterExpression":["define",{"sourceInterval":[190,330]},null,[],["app",{"sourceInterval":[212,330]},"TagExpression",[["terminal",{"sourceInterval":[226,237]},"Character"],["alt",{"sourceInterval":[239,293]},["terminal",{"sourceInterval":[240,245]},"key"],["terminal",{"sourceInterval":[248,256]},"player"],["terminal",{"sourceInterval":[259,269]},"fileName"],["terminal",{"sourceInterval":[272,278]},"zone"],["terminal",{"sourceInterval":[281,292]},"subFolder"]],["app",{"sourceInterval":[295,299]},"none",[]],["app",{"sourceInterval":[301,305]},"none",[]],["app",{"sourceInterval":[307,329]},"CharacterLegalContents",[]]]]],"CharacterLegalContents":["define",{"sourceInterval":[336,563]},null,[],["alt",{"sourceInterval":[361,563]},["app",{"sourceInterval":[361,382]},"LiteralNameExpression",[]],["app",{"sourceInterval":[398,425]},"LiteralValueTag",[["terminal",{"sourceInterval":[414,424]},"Pronouns"]]],["app",{"sourceInterval":[441,472]},"LiteralValueTag",[["terminal",{"sourceInterval":[457,471]},"OneCoolThing"]]],["app",{"sourceInterval":[488,513]},"LiteralValueTag",[["terminal",{"sourceInterval":[504,512]},"Outfit"]]],["app",{"sourceInterval":[529,563]},"LiteralValueTag",[["terminal",{"sourceInterval":[545,562]},"FirstImpression"]]]]],"AssetExpression":["define",{"sourceInterval":[571,699]},null,[],["app",{"sourceInterval":[589,699]},"TagExpression",[["terminal",{"sourceInterval":[603,610]},"Asset"],["alt",{"sourceInterval":[612,666]},["terminal",{"sourceInterval":[613,618]},"key"],["terminal",{"sourceInterval":[621,631]},"fileName"],["terminal",{"sourceInterval":[634,640]},"zone"],["terminal",{"sourceInterval":[643,654]},"subFolder"],["terminal",{"sourceInterval":[657,665]},"player"]],["app",{"sourceInterval":[668,672]},"none",[]],["app",{"sourceInterval":[674,678]},"none",[]],["app",{"sourceInterval":[680,698]},"AssetLegalContents",[]]]]],"AssetLegalContents":["define",{"sourceInterval":[705,961]},null,[],["alt",{"sourceInterval":[726,961]},["app",{"sourceInterval":[726,742]},"ImportExpression",[]],["app",{"sourceInterval":[758,776]},"VariableExpression",[]],["app",{"sourceInterval":[792,807]},"LayerExpression",[]],["app",{"sourceInterval":[823,842]},"ConditionExpression",[]],["app",{"sourceInterval":[858,872]},"RoomExpression",[]],["app",{"sourceInterval":[888,902]},"ExitExpression",[]],["app",{"sourceInterval":[918,939]},"LiteralNameExpression",[]],["app",{"sourceInterval":[955,961]},"string",[]]]],"ImportExpression":["define",{"sourceInterval":[969,1054]},null,[],["app",{"sourceInterval":[988,1054]},"TagExpression",[["terminal",{"sourceInterval":[1002,1010]},"Import"],["terminal",{"sourceInterval":[1012,1020]},"from"],["app",{"sourceInterval":[1022,1026]},"none",[]],["app",{"sourceInterval":[1028,1032]},"none",[]],["app",{"sourceInterval":[1034,1053]},"ImportLegalContents",[]]]]],"ImportLegalContents":["define",{"sourceInterval":[1060,1095]},null,[],["app",{"sourceInterval":[1082,1095]},"UseExpression",[]]],"UseExpression":["define",{"sourceInterval":[1103,1238]},null,[],["alt",{"sourceInterval":[1119,1238]},["app",{"sourceInterval":[1119,1173]},"TagExpression",[["terminal",{"sourceInterval":[1133,1138]},"Use"],["alt",{"sourceInterval":[1140,1154]},["terminal",{"sourceInterval":[1141,1146]},"key"],["terminal",{"sourceInterval":[1149,1153]},"as"]],["app",{"sourceInterval":[1156,1160]},"none",[]],["app",{"sourceInterval":[1162,1166]},"none",[]],["app",{"sourceInterval":[1168,1172]},"none",[]]]],["app",{"sourceInterval":[1189,1238]},"TagSelfClosing",[["terminal",{"sourceInterval":[1204,1209]},"Use"],["alt",{"sourceInterval":[1211,1225]},["terminal",{"sourceInterval":[1212,1217]},"key"],["terminal",{"sourceInterval":[1220,1224]},"as"]],["app",{"sourceInterval":[1227,1231]},"none",[]],["app",{"sourceInterval":[1233,1237]},"none",[]]]]]],"VariableExpression":["define",{"sourceInterval":[1246,1388]},null,[],["alt",{"sourceInterval":[1267,1388]},["app",{"sourceInterval":[1267,1322]},"TagExpression",[["terminal",{"sourceInterval":[1281,1291]},"Variable"],["terminal",{"sourceInterval":[1293,1298]},"key"],["terminal",{"sourceInterval":[1300,1309]},"default"],["app",{"sourceInterval":[1311,1315]},"none",[]],["app",{"sourceInterval":[1317,1321]},"none",[]]]],["app",{"sourceInterval":[1338,1388]},"TagSelfClosing",[["terminal",{"sourceInterval":[1353,1363]},"Variable"],["terminal",{"sourceInterval":[1365,1370]},"key"],["terminal",{"sourceInterval":[1372,1381]},"default"],["app",{"sourceInterval":[1383,1387]},"none",[]]]]]],"ConditionExpression":["define",{"sourceInterval":[1396,1486]},null,[],["app",{"sourceInterval":[1418,1486]},"TagExpression",[["terminal",{"sourceInterval":[1432,1443]},"Condition"],["app",{"sourceInterval":[1445,1449]},"none",[]],["terminal",{"sourceInterval":[1451,1455]},"if"],["app",{"sourceInterval":[1457,1461]},"none",[]],["app",{"sourceInterval":[1463,1485]},"ConditionLegalContents",[]]]]],"ConditionLegalContents":["define",{"sourceInterval":[1492,1655]},null,[],["alt",{"sourceInterval":[1517,1655]},["app",{"sourceInterval":[1517,1531]},"RoomExpression",[]],["app",{"sourceInterval":[1547,1566]},"ConditionExpression",[]],["app",{"sourceInterval":[1582,1594]},"TextContents",[]],["app",{"sourceInterval":[1610,1625]},"LayerExpression",[]],["app",{"sourceInterval":[1641,1655]},"ExitExpression",[]]]],"LayerExpression":["define",{"sourceInterval":[1663,1742]},null,[],["app",{"sourceInterval":[1681,1742]},"TagExpression",[["terminal",{"sourceInterval":[1695,1702]},"Layer"],["terminal",{"sourceInterval":[1704,1709]},"key"],["app",{"sourceInterval":[1711,1715]},"none",[]],["app",{"sourceInterval":[1717,1721]},"none",[]],["app",{"sourceInterval":[1723,1741]},"LayerLegalContents",[]]]]],"LayerLegalContents":["define",{"sourceInterval":[1748,1848]},null,[],["alt",{"sourceInterval":[1769,1848]},["app",{"sourceInterval":[1769,1783]},"RoomExpression",[]],["app",{"sourceInterval":[1799,1818]},"ConditionExpression",[]],["app",{"sourceInterval":[1834,1848]},"ExitExpression",[]]]],"ExitExpression":["define",{"sourceInterval":[1856,2014]},null,[],["alt",{"sourceInterval":[1873,2014]},["app",{"sourceInterval":[1873,1939]},"TagExpression",[["terminal",{"sourceInterval":[1887,1893]},"Exit"],["alt",{"sourceInterval":[1895,1918]},["terminal",{"sourceInterval":[1896,1901]},"key"],["terminal",{"sourceInterval":[1904,1908]},"to"],["terminal",{"sourceInterval":[1911,1917]},"from"]],["app",{"sourceInterval":[1920,1924]},"none",[]],["app",{"sourceInterval":[1926,1930]},"none",[]],["app",{"sourceInterval":[1932,1938]},"string",[]]]],["app",{"sourceInterval":[1955,2014]},"TagSelfClosing",[["terminal",{"sourceInterval":[1970,1976]},"Exit"],["alt",{"sourceInterval":[1978,2001]},["terminal",{"sourceInterval":[1979,1984]},"key"],["terminal",{"sourceInterval":[1987,1991]},"to"],["terminal",{"sourceInterval":[1994,2000]},"from"]],["app",{"sourceInterval":[2003,2007]},"none",[]],["app",{"sourceInterval":[2009,2013]},"none",[]]]]]],"RoomExpression":["define",{"sourceInterval":[2022,2111]},null,[],["app",{"sourceInterval":[2039,2111]},"TagExpression",[["terminal",{"sourceInterval":[2053,2059]},"Room"],["alt",{"sourceInterval":[2061,2080]},["terminal",{"sourceInterval":[2062,2067]},"key"],["terminal",{"sourceInterval":[2070,2079]},"display"]],["app",{"sourceInterval":[2082,2086]},"none",[]],["terminal",{"sourceInterval":[2088,2096]},"global"],["app",{"sourceInterval":[2098,2110]},"RoomContents",[]]]]],"RoomContents":["define",{"sourceInterval":[2117,2204]},null,[],["alt",{"sourceInterval":[2132,2204]},["app",{"sourceInterval":[2132,2144]},"TextContents",[]],["app",{"sourceInterval":[2160,2174]},"NameExpression",[]],["app",{"sourceInterval":[2190,2204]},"ExitExpression",[]]]],"LiteralNameExpression":["define",{"sourceInterval":[2212,2259]},null,[],["app",{"sourceInterval":[2236,2259]},"LiteralValueTag",[["terminal",{"sourceInterval":[2252,2258]},"Name"]]]],"NameExpression":["define",{"sourceInterval":[2265,2298]},null,[],["app",{"sourceInterval":[2282,2298]},"ValueTag",[["terminal",{"sourceInterval":[2291,2297]},"Name"]]]],"LiteralValueTag":["define",{"sourceInterval":[2306,2377]},null,["label"],["app",{"sourceInterval":[2331,2377]},"TagExpression",[["param",{"sourceInterval":[2345,2350]},0],["app",{"sourceInterval":[2352,2356]},"none",[]],["app",{"sourceInterval":[2358,2362]},"none",[]],["app",{"sourceInterval":[2364,2368]},"none",[]],["app",{"sourceInterval":[2370,2376]},"string",[]]]]],"ValueTag":["define",{"sourceInterval":[2385,2455]},null,["label"],["app",{"sourceInterval":[2403,2455]},"TagExpression",[["param",{"sourceInterval":[2417,2422]},0],["app",{"sourceInterval":[2424,2428]},"none",[]],["app",{"sourceInterval":[2430,2434]},"none",[]],["app",{"sourceInterval":[2436,2440]},"none",[]],["app",{"sourceInterval":[2442,2454]},"TextContents",[]]]]],"TextContents":["define",{"sourceInterval":[2461,2505]},null,[],["alt",{"sourceInterval":[2476,2505]},["app",{"sourceInterval":[2476,2482]},"string",[]],["app",{"sourceInterval":[2485,2505]},"EmbeddedJSExpression",[]]]],"TagExpression":["define",{"sourceInterval":[2601,2774]},null,["tag","tagLiteralArgs","tagProgramArgs","tagBooleanArgs","LegalContents"],["seq",{"sourceInterval":[2685,2774]},["app",{"sourceInterval":[2685,2745]},"TagOpen",[["param",{"sourceInterval":[2693,2696]},0],["param",{"sourceInterval":[2698,2712]},1],["param",{"sourceInterval":[2714,2728]},2],["param",{"sourceInterval":[2730,2744]},3]]],["star",{"sourceInterval":[2746,2760]},["param",{"sourceInterval":[2746,2759]},4]],["app",{"sourceInterval":[2761,2774]},"TagClose",[["param",{"sourceInterval":[2770,2773]},0]]]]],"string":["define",{"sourceInterval":[2780,2820]},null,[],["plus",{"sourceInterval":[2789,2820]},["alt",{"sourceInterval":[2790,2818]},["app",{"sourceInterval":[2790,2800]},"stringText",[]],["app",{"sourceInterval":[2803,2818]},"spaceCompressor",[]]]]],"stringText":["define",{"sourceInterval":[2826,2882]},null,[],["plus",{"sourceInterval":[2839,2882]},["alt",{"sourceInterval":[2840,2880]},["seq",{"sourceInterval":[2840,2864]},["not",{"sourceInterval":[2840,2860]},["alt",{"sourceInterval":[2842,2859]},["terminal",{"sourceInterval":[2842,2845]},"<"],["terminal",{"sourceInterval":[2848,2851]},"{"],["app",{"sourceInterval":[2854,2859]},"space",[]]]],["app",{"sourceInterval":[2861,2864]},"any",[]]],["terminal",{"sourceInterval":[2867,2872]},"\\<"],["terminal",{"sourceInterval":[2875,2880]},"\\{"]]]],"spaceCompressor":["define",{"sourceInterval":[2888,2914]},null,[],["plus",{"sourceInterval":[2906,2914]},["app",{"sourceInterval":[2907,2912]},"space",[]]]],"TagSelfClosing":["define",{"sourceInterval":[2920,3063]},null,["tag","tagLiteralArgs","tagProgramArgs","tagBooleanArgs"],["seq",{"sourceInterval":[2990,3063]},["terminal",{"sourceInterval":[2990,2993]},"<"],["param",{"sourceInterval":[2994,2997]},0],["star",{"sourceInterval":[2998,3058]},["app",{"sourceInterval":[2998,3057]},"TagArgument",[["param",{"sourceInterval":[3010,3024]},1],["param",{"sourceInterval":[3026,3040]},2],["param",{"sourceInterval":[3042,3056]},3]]]],["terminal",{"sourceInterval":[3059,3063]},"/>"]]],"TagOpen":["define",{"sourceInterval":[3069,3204]},null,["tag","tagLiteralArgs","tagProgramArgs","tagBooleanArgs"],["seq",{"sourceInterval":[3132,3204]},["terminal",{"sourceInterval":[3132,3135]},"<"],["param",{"sourceInterval":[3136,3139]},0],["star",{"sourceInterval":[3140,3200]},["app",{"sourceInterval":[3140,3199]},"TagArgument",[["param",{"sourceInterval":[3152,3166]},1],["param",{"sourceInterval":[3168,3182]},2],["param",{"sourceInterval":[3184,3198]},3]]]],["terminal",{"sourceInterval":[3201,3204]},">"]]],"TagArgument":["define",{"sourceInterval":[3210,3380]},null,["tagLiteralArgs","tagProgramArgs","tagBooleanArgs"],["alt",{"sourceInterval":[3272,3380]},["app",{"sourceInterval":[3272,3306]},"TagLiteralArgument",[["param",{"sourceInterval":[3291,3305]},0]]],["app",{"sourceInterval":[3309,3343]},"TagProgramArgument",[["param",{"sourceInterval":[3328,3342]},1]]],["app",{"sourceInterval":[3346,3380]},"tagBooleanArgument",[["param",{"sourceInterval":[3365,3379]},2]]]]],"TagLiteralArgument":["define",{"sourceInterval":[3386,3456]},null,["tagLiteralArgs"],["app",{"sourceInterval":[3423,3456]},"tagArgumentQuoted",[["param",{"sourceInterval":[3441,3455]},0]]]],"TagProgramArgument":["define",{"sourceInterval":[3462,3571]},null,["tagProgramArgs"],["alt",{"sourceInterval":[3499,3571]},["app",{"sourceInterval":[3499,3532]},"tagArgumentQuoted",[["param",{"sourceInterval":[3517,3531]},0]]],["app",{"sourceInterval":[3535,3571]},"TagArgumentBracketed",[["param",{"sourceInterval":[3556,3570]},0]]]]],"tagBooleanArgument":["define",{"sourceInterval":[3577,3650]},null,["tagBooleanArgs"],["seq",{"sourceInterval":[3614,3650]},["param",{"sourceInterval":[3614,3628]},0],["lookahead",{"sourceInterval":[3629,3650]},["alt",{"sourceInterval":[3631,3649]},["app",{"sourceInterval":[3631,3636]},"space",[]],["terminal",{"sourceInterval":[3639,3642]},">"],["terminal",{"sourceInterval":[3645,3649]},"/>"]]]]],"tagArgumentQuoted":["define",{"sourceInterval":[3656,3726]},null,["tagLegalArgs"],["seq",{"sourceInterval":[3690,3726]},["param",{"sourceInterval":[3690,3702]},0],["terminal",{"sourceInterval":[3703,3708]},"=\""],["app",{"sourceInterval":[3709,3726]},"tagArgValueQuoted",[]]]],"TagArgumentBracketed":["define",{"sourceInterval":[3732,3807]},null,["tagLegalArgs"],["seq",{"sourceInterval":[3769,3807]},["lex",{"sourceInterval":[3769,3789]},["seq",{"sourceInterval":[3771,3788]},["param",{"sourceInterval":[3771,3783]},0],["terminal",{"sourceInterval":[3784,3788]},"={"]]],["star",{"sourceInterval":[3790,3803]},["app",{"sourceInterval":[3790,3802]},"JSExpression",[]]],["terminal",{"sourceInterval":[3804,3807]},"}"]]],"tagArgValueQuoted":["define",{"sourceInterval":[3813,3859]},null,[],["seq",{"sourceInterval":[3833,3859]},["star",{"sourceInterval":[3833,3854]},["alt",{"sourceInterval":[3834,3852]},["terminal",{"sourceInterval":[3834,3840]},"\\\""],["seq",{"sourceInterval":[3843,3852]},["not",{"sourceInterval":[3843,3848]},["terminal",{"sourceInterval":[3844,3848]},"\""]],["app",{"sourceInterval":[3849,3852]},"any",[]]]]],["terminal",{"sourceInterval":[3855,3859]},"\""]]],"TagClose":["define",{"sourceInterval":[3865,3893]},null,["tag"],["seq",{"sourceInterval":[3881,3893]},["terminal",{"sourceInterval":[3881,3885]},"</"],["param",{"sourceInterval":[3886,3889]},0],["terminal",{"sourceInterval":[3890,3893]},">"]]],"none":["define",{"sourceInterval":[3899,3914]},null,[],["seq",{"sourceInterval":[3906,3914]},["not",{"sourceInterval":[3906,3910]},["terminal",{"sourceInterval":[3907,3910]},">"]],["terminal",{"sourceInterval":[3911,3914]},">"]]],"EmbeddedJSExpression":["define",{"sourceInterval":[4703,4747]},null,[],["seq",{"sourceInterval":[4726,4747]},["terminal",{"sourceInterval":[4726,4729]},"{"],["star",{"sourceInterval":[4730,4743]},["app",{"sourceInterval":[4730,4742]},"JSExpression",[]]],["terminal",{"sourceInterval":[4744,4747]},"}"]]],"JSExpression":["define",{"sourceInterval":[4753,4946]},null,[],["alt",{"sourceInterval":[4768,4946]},["app",{"sourceInterval":[4768,4788]},"EmbeddedJSExpression",[]],["app",{"sourceInterval":[4812,4832]},"JSDoubleQuotedString",[]],["app",{"sourceInterval":[4856,4876]},"JSSingleQuotedString",[]],["app",{"sourceInterval":[4900,4916]},"JSTemplateString",[]],["app",{"sourceInterval":[4940,4946]},"JSText",[]]]],"JSDoubleQuotedString":["define",{"sourceInterval":[4952,5001]},null,[],["seq",{"sourceInterval":[4975,5001]},["terminal",{"sourceInterval":[4975,4979]},"\""],["star",{"sourceInterval":[4980,4996]},["app",{"sourceInterval":[4980,4995]},"JSNoDoubleQuote",[]]],["terminal",{"sourceInterval":[4997,5001]},"\""]]],"JSNoDoubleQuote":["define",{"sourceInterval":[5007,5045]},null,[],["alt",{"sourceInterval":[5025,5045]},["terminal",{"sourceInterval":[5025,5031]},"\\\""],["seq",{"sourceInterval":[5034,5045]},["not",{"sourceInterval":[5035,5040]},["terminal",{"sourceInterval":[5036,5040]},"\""]],["app",{"sourceInterval":[5041,5044]},"any",[]]]]],"JSSingleQuotedString":["define",{"sourceInterval":[5051,5100]},null,[],["seq",{"sourceInterval":[5074,5100]},["terminal",{"sourceInterval":[5074,5078]},"'"],["star",{"sourceInterval":[5079,5095]},["app",{"sourceInterval":[5079,5094]},"JSNoSingleQuote",[]]],["terminal",{"sourceInterval":[5096,5100]},"'"]]],"JSNoSingleQuote":["define",{"sourceInterval":[5106,5144]},null,[],["alt",{"sourceInterval":[5124,5144]},["terminal",{"sourceInterval":[5124,5130]},"\\'"],["seq",{"sourceInterval":[5133,5144]},["not",{"sourceInterval":[5134,5139]},["terminal",{"sourceInterval":[5135,5139]},"'"]],["app",{"sourceInterval":[5140,5143]},"any",[]]]]],"JSTemplateString":["define",{"sourceInterval":[5150,5217]},null,[],["seq",{"sourceInterval":[5169,5217]},["terminal",{"sourceInterval":[5169,5172]},"`"],["star",{"sourceInterval":[5173,5213]},["alt",{"sourceInterval":[5174,5210]},["app",{"sourceInterval":[5174,5187]},"JSNoBackQuote",[]],["app",{"sourceInterval":[5190,5210]},"JSTemplateEvaluation",[]]]],["terminal",{"sourceInterval":[5214,5217]},"`"]]],"JSTemplateEvaluation":["define",{"sourceInterval":[5223,5267]},null,[],["seq",{"sourceInterval":[5246,5267]},["terminal",{"sourceInterval":[5246,5250]},"${"],["app",{"sourceInterval":[5251,5263]},"JSExpression",[]],["terminal",{"sourceInterval":[5264,5267]},"}"]]],"JSNoBackQuote":["define",{"sourceInterval":[5273,5316]},null,[],["alt",{"sourceInterval":[5289,5316]},["terminal",{"sourceInterval":[5289,5294]},"\\`"],["seq",{"sourceInterval":[5297,5316]},["not",{"sourceInterval":[5298,5311]},["alt",{"sourceInterval":[5300,5310]},["terminal",{"sourceInterval":[5300,5303]},"`"],["terminal",{"sourceInterval":[5306,5310]},"${"]]],["app",{"sourceInterval":[5312,5315]},"any",[]]]]],"JSText":["define",{"sourceInterval":[5322,5413]},null,[],["plus",{"sourceInterval":[5331,5413]},["alt",{"sourceInterval":[5332,5411]},["terminal",{"sourceInterval":[5332,5337]},"\\{"],["terminal",{"sourceInterval":[5340,5346]},"\\\""],["terminal",{"sourceInterval":[5349,5354]},"\\'"],["terminal",{"sourceInterval":[5357,5362]},"\\`"],["terminal",{"sourceInterval":[5365,5370]},"\\}"],["seq",{"sourceInterval":[5373,5411]},["not",{"sourceInterval":[5374,5406]},["alt",{"sourceInterval":[5376,5405]},["terminal",{"sourceInterval":[5376,5379]},"{"],["terminal",{"sourceInterval":[5382,5386]},"\""],["terminal",{"sourceInterval":[5389,5393]},"'"],["terminal",{"sourceInterval":[5396,5399]},"`"],["terminal",{"sourceInterval":[5402,5405]},"}"]]],["app",{"sourceInterval":[5407,5410]},"any",[]]]]]],"space":["override",{"sourceInterval":[5496,5542]},null,[],["alt",{"sourceInterval":[5505,5542]},["app",{"sourceInterval":[5505,5515]},"whitespace",[]],["app",{"sourceInterval":[5518,5532]},"lineTerminator",[]],["app",{"sourceInterval":[5535,5542]},"comment",[]]]],"sourceCharacter":["define",{"sourceInterval":[5547,5568]},null,[],["app",{"sourceInterval":[5565,5568]},"any",[]]],"whitespace_verticalTab":["define",{"sourceInterval":[5611,5635]},null,[],["terminal",{"sourceInterval":[5611,5617]},"\u000b"]],"whitespace_formFeed":["define",{"sourceInterval":[5655,5676]},null,[],["terminal",{"sourceInterval":[5655,5661]},"\f"]],"whitespace_noBreakSpace":["define",{"sourceInterval":[5719,5744]},null,[],["terminal",{"sourceInterval":[5719,5727]}," "]],"whitespace_byteOrderMark":["define",{"sourceInterval":[5764,5790]},null,[],["terminal",{"sourceInterval":[5764,5772]},"﻿"]],"whitespace":["define",{"sourceInterval":[5574,5831]},null,[],["alt",{"sourceInterval":[5587,5831]},["terminal",{"sourceInterval":[5587,5591]},"\t"],["app",{"sourceInterval":[5611,5617]},"whitespace_verticalTab",[]],["app",{"sourceInterval":[5655,5661]},"whitespace_formFeed",[]],["terminal",{"sourceInterval":[5696,5699]}," "],["app",{"sourceInterval":[5719,5727]},"whitespace_noBreakSpace",[]],["app",{"sourceInterval":[5764,5772]},"whitespace_byteOrderMark",[]],["app",{"sourceInterval":[5810,5831]},"unicodeSpaceSeparator",[]]]],"unicodeSpaceSeparator":["define",{"sourceInterval":[5836,5889]},null,[],["alt",{"sourceInterval":[5860,5889]},["range",{"sourceInterval":[5860,5878]}," ","​"],["terminal",{"sourceInterval":[5881,5889]},"　"]]],"lineTerminator":["define",{"sourceInterval":[5897,5947]},null,[],["alt",{"sourceInterval":[5914,5947]},["terminal",{"sourceInterval":[5914,5918]},"\n"],["terminal",{"sourceInterval":[5921,5925]},"\r"],["terminal",{"sourceInterval":[5928,5936]},"\u2028"],["terminal",{"sourceInterval":[5939,5947]},"\u2029"]]],"lineTerminatorSequence":["define",{"sourceInterval":[5953,6026]},null,[],["alt",{"sourceInterval":[5978,6026]},["terminal",{"sourceInterval":[5978,5982]},"\n"],["seq",{"sourceInterval":[5985,5995]},["terminal",{"sourceInterval":[5985,5989]},"\r"],["not",{"sourceInterval":[5990,5995]},["terminal",{"sourceInterval":[5991,5995]},"\n"]]],["terminal",{"sourceInterval":[5998,6006]},"\u2028"],["terminal",{"sourceInterval":[6009,6017]},"\u2029"],["terminal",{"sourceInterval":[6020,6026]},"\r\n"]]],"comment":["define",{"sourceInterval":[6034,6080]},null,[],["alt",{"sourceInterval":[6044,6080]},["app",{"sourceInterval":[6044,6060]},"multiLineComment",[]],["app",{"sourceInterval":[6063,6080]},"singleLineComment",[]]]],"multiLineComment":["define",{"sourceInterval":[6088,6141]},null,[],["seq",{"sourceInterval":[6107,6141]},["terminal",{"sourceInterval":[6107,6111]},"/*"],["star",{"sourceInterval":[6112,6136]},["seq",{"sourceInterval":[6113,6134]},["not",{"sourceInterval":[6113,6118]},["terminal",{"sourceInterval":[6114,6118]},"*/"]],["app",{"sourceInterval":[6119,6134]},"sourceCharacter",[]]]],["terminal",{"sourceInterval":[6137,6141]},"*/"]]],"singleLineComment":["define",{"sourceInterval":[6147,6206]},null,[],["seq",{"sourceInterval":[6167,6206]},["terminal",{"sourceInterval":[6167,6171]},"//"],["star",{"sourceInterval":[6172,6206]},["seq",{"sourceInterval":[6173,6204]},["not",{"sourceInterval":[6173,6188]},["app",{"sourceInterval":[6174,6188]},"lineTerminator",[]]],["app",{"sourceInterval":[6189,6204]},"sourceCharacter",[]]]]]]}]);export default result;