import ohm from 'ohm-js';const result=ohm.makeRecipe(["grammar",{"source":"WorldMarkupLangage {\r\n\r\n    //\r\n    // This section defines the tags that make up the WML language\r\n    //\r\n\r\n    WMLFileContents = AssetExpression\r\n            | StoryExpression\r\n            | CharacterExpression\r\n\r\n    CharacterExpression = TagExpression<\"Character\", \"key\", (\"player\" | \"fileName\" | \"zone\" | \"subFolder\"), none, none, CharacterLegalContents>\r\n    CharacterLegalContents = LiteralNameExpression\r\n            | LiteralValueTag<\"Pronouns\">\r\n            | LiteralValueTag<\"OneCoolThing\">\r\n            | LiteralValueTag<\"Outfit\">\r\n            | LiteralValueTag<\"FirstImpression\">\r\n\r\n    StoryExpression = TagExpression<\"Story\", \"key\", (\"fileName\" | \"zone\" | \"subFolder\" | \"player\"), none, none, AssetLegalContents>\r\n\r\n    AssetExpression = TagExpression<\"Asset\", \"key\", (\"fileName\" | \"zone\" | \"subFolder\" | \"player\"), none, none, AssetLegalContents>\r\n    AssetLegalContents = ImportExpression\r\n            | VariableExpression\r\n            | ComputedExpression\r\n            | ActionExpression\r\n            | LayerExpression\r\n            | ConditionExpression\r\n            | RoomExpression\r\n            | ExitExpression\r\n            | LiteralNameExpression\r\n            | string\r\n\r\n    ImportExpression = TagExpression<\"Import\", \"from\", none, none, none, ImportLegalContents>\r\n    ImportLegalContents = UseExpression\r\n\r\n    UseExpression = TagExpression<\"Use\", (\"key\" | \"as\"), none, none, none, none>\r\n            | TagSelfClosing<\"Use\", (\"key\" | \"as\"), none, none, none>\r\n\r\n    DependencyExpression = TagExpression<\"Depend\", \"on\", none, none, none, none>\r\n            | TagSelfClosing<\"Depend\", \"on\", none, none, none>\r\n\r\n    VariableExpression = TagExpression<\"Variable\", \"key\", none, \"default\", none, none>\r\n            | TagSelfClosing<\"Variable\", \"key\", none, \"default\", none>\r\n\r\n    ComputedExpression = TagExpression<\"Computed\", \"key\", none, \"src\", none, DependencyExpression>\r\n            | TagSelfClosing<\"Computed\", \"key\", none, \"src\", none>\r\n\r\n    ActionExpression = TagExpression<\"Action\", \"key\", none, \"src\", none, none>\r\n            | TagSelfClosing<\"Action\", \"key\", none, \"src\", none>\r\n\r\n    ConditionExpression = TagExpression<\"Condition\", none, none, \"if\", none, ConditionLegalContents>\r\n    ConditionLegalContents = RoomExpression\r\n            | ConditionExpression\r\n            | TextContents\r\n            | LayerExpression\r\n            | ExitExpression\r\n            | DependencyExpression\r\n\r\n    LayerExpression = TagExpression<\"Layer\", \"key\", none, none, none, LayerLegalContents>\r\n    LayerLegalContents = RoomExpression\r\n            | ConditionExpression\r\n            | ExitExpression\r\n\r\n    ExitExpression = TagExpression<\"Exit\", (\"key\" | \"to\" | \"from\"), none, none, none, string>\r\n            | TagSelfClosing<\"Exit\", (\"key\" | \"to\" | \"from\"), none, none, none>\r\n\r\n    LinkExpression = TagExpression<\"Link\", (\"key\" | \"to\"), none, none, none, string>\r\n\r\n    RoomExpression = TagExpression<\"Room\", \"key\", \"display\", none, \"global\", RoomContents>\r\n    RoomContents = TextContents\r\n            | NameExpression\r\n            | ExitExpression\r\n            | LinkExpression\r\n\r\n    LiteralNameExpression = LiteralValueTag<\"Name\">\r\n    NameExpression = ValueTag<\"Name\">\r\n\r\n    LiteralValueTag<label> = TagExpression<label, none, none, none, none, string>\r\n\r\n    ValueTag<label> = TagExpression<label, none, none, none, none, TextContents>\r\n    TextContents = string | EmbeddedJSExpression\r\n\r\n    //\r\n    // The following define the ways in which tags can be structured\r\n    //\r\n\r\n    TagExpression<tag, tagKeyArgs, tagLiteralArgs, tagProgramArgs, tagBooleanArgs, LegalContents> = TagOpen<tag, tagKeyArgs, tagLiteralArgs, tagProgramArgs, tagBooleanArgs> LegalContents* TagClose<tag>\r\n    string = (stringText | spaceCompressor)+\r\n    stringText = (~(\"<\" | \"{\" | space) any | \"\\\\<\" | \"\\\\{\")+\r\n    legalKey = (letter | digit | \"-\" | \"_\")*\r\n    spaceCompressor = (space)+\r\n    TagSelfClosing<tag, tagKeyArgs, tagLiteralArgs, tagProgramArgs, tagBooleanArgs> = \"<\" tag TagArgument<tagKeyArgs, tagLiteralArgs, tagProgramArgs, tagBooleanArgs>* \"/>\"\r\n    TagOpen<tag, tagKeyArgs, tagLiteralArgs, tagProgramArgs, tagBooleanArgs> = \"<\" tag TagArgument<tagKeyArgs, tagLiteralArgs, tagProgramArgs, tagBooleanArgs>* \">\"\r\n    TagArgument<tagKeyArgs, tagLiteralArgs, tagProgramArgs, tagBooleanArgs> = TagArgumentKey<tagKeyArgs> | TagLiteralArgument<tagLiteralArgs> | TagProgramArgument<tagProgramArgs> | tagBooleanArgument<tagBooleanArgs>\r\n    TagLiteralArgument<tagLiteralArgs> = tagArgumentQuoted<tagLiteralArgs>\r\n    TagProgramArgument<tagProgramArgs> = tagArgumentQuoted<tagProgramArgs> | TagArgumentBracketed<tagProgramArgs>\r\n    tagBooleanArgument<tagBooleanArgs> = tagBooleanArgs &(space | \">\" | \"/>\")\r\n    tagArgumentQuoted<tagLegalArgs> = tagLegalArgs \"=\\\"\" tagArgValueQuoted\r\n    TagArgumentKey<tagLegalArgs> = #(tagLegalArgs \"=(\") legalKey \")\"\r\n    TagArgumentBracketed<tagLegalArgs> = #(tagLegalArgs \"={\") JSExpression* \"}\"\r\n    tagArgValueQuoted = (\"\\\\\\\"\" | ~\"\\\"\" any)* \"\\\"\"\r\n    TagClose<tag> = \"</\" tag \">\"\r\n    none = ~\">\" \">\"\r\n\r\n    //\r\n    // EmbeddedJSExpression parses from the starting open bracket through to the\r\n    //   *MATCHING* close bracket, using a subset of JS syntax that concentrates\r\n    //   on all the ways that JS could let you mess up that matching (quotes,\r\n    //   nesting, and template literals figuring high on the list)\r\n    //\r\n    // While we could, technically, validate the entire ES5 JS Syntax (after all,\r\n    // Ohm publishes their schema), it wouldn't gain us any value here, and it\r\n    // has a quite noticeable resource cost:  Compiling that schema and executing\r\n    // it slows the perception Lambda function down to a crawl.  If a need for\r\n    // such pre-processing emerges, look into how to optimize compiling and executing\r\n    // very large Ohm schemata.\r\n    //\r\n    EmbeddedJSExpression = \"{\" JSExpression* \"}\"\r\n    JSExpression = EmbeddedJSExpression\r\n                    | JSDoubleQuotedString\r\n                    | JSSingleQuotedString\r\n                    | JSTemplateString\r\n                    | JSText\r\n    JSDoubleQuotedString = \"\\\"\" JSNoDoubleQuote* \"\\\"\"\r\n    JSNoDoubleQuote = \"\\\\\\\"\" | (~\"\\\"\" any)\r\n    JSSingleQuotedString = \"\\'\" JSNoSingleQuote* \"\\'\"\r\n    JSNoSingleQuote = \"\\\\\\'\" | (~\"\\'\" any)\r\n    JSTemplateString = \"`\" (JSNoBackQuote | JSTemplateEvaluation )* \"`\"\r\n    JSTemplateEvaluation = \"${\" JSExpression \"}\"\r\n    JSNoBackQuote = \"\\\\`\" | (~(\"`\" | \"${\") any)\r\n    JSText = (\"\\\\{\" | \"\\\\\\\"\" | \"\\\\'\" | \"\\\\`\" | \"\\\\}\" | (~(\"{\" | \"\\\"\" | \"\\'\" | \"`\" | \"}\") any))+\r\n\r\n    // Override Ohm's built-in definition of space.  Cribbed from es5.ohm\r\n    space := whitespace | lineTerminator | comment\r\n\r\n\tsourceCharacter = any\r\n    whitespace = \"\\t\"\r\n                | \"\\x0B\"    -- verticalTab\r\n                | \"\\x0C\"    -- formFeed\r\n                | \" \"\r\n                | \"\\u00A0\"  -- noBreakSpace\r\n                | \"\\uFEFF\"  -- byteOrderMark\r\n                | unicodeSpaceSeparator\r\n\r\n\tunicodeSpaceSeparator = \"\\u2000\"..\"\\u200B\" | \"\\u3000\"\r\n\r\n    lineTerminator = \"\\n\" | \"\\r\" | \"\\u2028\" | \"\\u2029\"\r\n    lineTerminatorSequence = \"\\n\" | \"\\r\" ~\"\\n\" | \"\\u2028\" | \"\\u2029\" | \"\\r\\n\"\r\n\r\n    comment = multiLineComment | singleLineComment\r\n\r\n    multiLineComment = \"/*\" (~\"*/\" sourceCharacter)* \"*/\"\r\n    singleLineComment = \"//\" (~lineTerminator sourceCharacter)*\r\n\r\n}"},"WorldMarkupLangage",null,"WMLFileContents",{"WMLFileContents":["define",{"sourceInterval":[114,213]},null,[],["alt",{"sourceInterval":[132,213]},["app",{"sourceInterval":[132,147]},"AssetExpression",[]],["app",{"sourceInterval":[163,178]},"StoryExpression",[]],["app",{"sourceInterval":[194,213]},"CharacterExpression",[]]]],"CharacterExpression":["define",{"sourceInterval":[221,360]},null,[],["app",{"sourceInterval":[243,360]},"TagExpression",[["terminal",{"sourceInterval":[257,268]},"Character"],["terminal",{"sourceInterval":[270,275]},"key"],["alt",{"sourceInterval":[277,323]},["terminal",{"sourceInterval":[278,286]},"player"],["terminal",{"sourceInterval":[289,299]},"fileName"],["terminal",{"sourceInterval":[302,308]},"zone"],["terminal",{"sourceInterval":[311,322]},"subFolder"]],["app",{"sourceInterval":[325,329]},"none",[]],["app",{"sourceInterval":[331,335]},"none",[]],["app",{"sourceInterval":[337,359]},"CharacterLegalContents",[]]]]],"CharacterLegalContents":["define",{"sourceInterval":[366,593]},null,[],["alt",{"sourceInterval":[391,593]},["app",{"sourceInterval":[391,412]},"LiteralNameExpression",[]],["app",{"sourceInterval":[428,455]},"LiteralValueTag",[["terminal",{"sourceInterval":[444,454]},"Pronouns"]]],["app",{"sourceInterval":[471,502]},"LiteralValueTag",[["terminal",{"sourceInterval":[487,501]},"OneCoolThing"]]],["app",{"sourceInterval":[518,543]},"LiteralValueTag",[["terminal",{"sourceInterval":[534,542]},"Outfit"]]],["app",{"sourceInterval":[559,593]},"LiteralValueTag",[["terminal",{"sourceInterval":[575,592]},"FirstImpression"]]]]],"StoryExpression":["define",{"sourceInterval":[601,728]},null,[],["app",{"sourceInterval":[619,728]},"TagExpression",[["terminal",{"sourceInterval":[633,640]},"Story"],["terminal",{"sourceInterval":[642,647]},"key"],["alt",{"sourceInterval":[649,695]},["terminal",{"sourceInterval":[650,660]},"fileName"],["terminal",{"sourceInterval":[663,669]},"zone"],["terminal",{"sourceInterval":[672,683]},"subFolder"],["terminal",{"sourceInterval":[686,694]},"player"]],["app",{"sourceInterval":[697,701]},"none",[]],["app",{"sourceInterval":[703,707]},"none",[]],["app",{"sourceInterval":[709,727]},"AssetLegalContents",[]]]]],"AssetExpression":["define",{"sourceInterval":[736,863]},null,[],["app",{"sourceInterval":[754,863]},"TagExpression",[["terminal",{"sourceInterval":[768,775]},"Asset"],["terminal",{"sourceInterval":[777,782]},"key"],["alt",{"sourceInterval":[784,830]},["terminal",{"sourceInterval":[785,795]},"fileName"],["terminal",{"sourceInterval":[798,804]},"zone"],["terminal",{"sourceInterval":[807,818]},"subFolder"],["terminal",{"sourceInterval":[821,829]},"player"]],["app",{"sourceInterval":[832,836]},"none",[]],["app",{"sourceInterval":[838,842]},"none",[]],["app",{"sourceInterval":[844,862]},"AssetLegalContents",[]]]]],"AssetLegalContents":["define",{"sourceInterval":[869,1191]},null,[],["alt",{"sourceInterval":[890,1191]},["app",{"sourceInterval":[890,906]},"ImportExpression",[]],["app",{"sourceInterval":[922,940]},"VariableExpression",[]],["app",{"sourceInterval":[956,974]},"ComputedExpression",[]],["app",{"sourceInterval":[990,1006]},"ActionExpression",[]],["app",{"sourceInterval":[1022,1037]},"LayerExpression",[]],["app",{"sourceInterval":[1053,1072]},"ConditionExpression",[]],["app",{"sourceInterval":[1088,1102]},"RoomExpression",[]],["app",{"sourceInterval":[1118,1132]},"ExitExpression",[]],["app",{"sourceInterval":[1148,1169]},"LiteralNameExpression",[]],["app",{"sourceInterval":[1185,1191]},"string",[]]]],"ImportExpression":["define",{"sourceInterval":[1199,1288]},null,[],["app",{"sourceInterval":[1218,1288]},"TagExpression",[["terminal",{"sourceInterval":[1232,1240]},"Import"],["terminal",{"sourceInterval":[1242,1248]},"from"],["app",{"sourceInterval":[1250,1254]},"none",[]],["app",{"sourceInterval":[1256,1260]},"none",[]],["app",{"sourceInterval":[1262,1266]},"none",[]],["app",{"sourceInterval":[1268,1287]},"ImportLegalContents",[]]]]],"ImportLegalContents":["define",{"sourceInterval":[1294,1329]},null,[],["app",{"sourceInterval":[1316,1329]},"UseExpression",[]]],"UseExpression":["define",{"sourceInterval":[1337,1484]},null,[],["alt",{"sourceInterval":[1353,1484]},["app",{"sourceInterval":[1353,1413]},"TagExpression",[["terminal",{"sourceInterval":[1367,1372]},"Use"],["alt",{"sourceInterval":[1374,1388]},["terminal",{"sourceInterval":[1375,1380]},"key"],["terminal",{"sourceInterval":[1383,1387]},"as"]],["app",{"sourceInterval":[1390,1394]},"none",[]],["app",{"sourceInterval":[1396,1400]},"none",[]],["app",{"sourceInterval":[1402,1406]},"none",[]],["app",{"sourceInterval":[1408,1412]},"none",[]]]],["app",{"sourceInterval":[1429,1484]},"TagSelfClosing",[["terminal",{"sourceInterval":[1444,1449]},"Use"],["alt",{"sourceInterval":[1451,1465]},["terminal",{"sourceInterval":[1452,1457]},"key"],["terminal",{"sourceInterval":[1460,1464]},"as"]],["app",{"sourceInterval":[1467,1471]},"none",[]],["app",{"sourceInterval":[1473,1477]},"none",[]],["app",{"sourceInterval":[1479,1483]},"none",[]]]]]],"DependencyExpression":["define",{"sourceInterval":[1492,1632]},null,[],["alt",{"sourceInterval":[1515,1632]},["app",{"sourceInterval":[1515,1568]},"TagExpression",[["terminal",{"sourceInterval":[1529,1537]},"Depend"],["terminal",{"sourceInterval":[1539,1543]},"on"],["app",{"sourceInterval":[1545,1549]},"none",[]],["app",{"sourceInterval":[1551,1555]},"none",[]],["app",{"sourceInterval":[1557,1561]},"none",[]],["app",{"sourceInterval":[1563,1567]},"none",[]]]],["app",{"sourceInterval":[1584,1632]},"TagSelfClosing",[["terminal",{"sourceInterval":[1599,1607]},"Depend"],["terminal",{"sourceInterval":[1609,1613]},"on"],["app",{"sourceInterval":[1615,1619]},"none",[]],["app",{"sourceInterval":[1621,1625]},"none",[]],["app",{"sourceInterval":[1627,1631]},"none",[]]]]]],"VariableExpression":["define",{"sourceInterval":[1640,1794]},null,[],["alt",{"sourceInterval":[1661,1794]},["app",{"sourceInterval":[1661,1722]},"TagExpression",[["terminal",{"sourceInterval":[1675,1685]},"Variable"],["terminal",{"sourceInterval":[1687,1692]},"key"],["app",{"sourceInterval":[1694,1698]},"none",[]],["terminal",{"sourceInterval":[1700,1709]},"default"],["app",{"sourceInterval":[1711,1715]},"none",[]],["app",{"sourceInterval":[1717,1721]},"none",[]]]],["app",{"sourceInterval":[1738,1794]},"TagSelfClosing",[["terminal",{"sourceInterval":[1753,1763]},"Variable"],["terminal",{"sourceInterval":[1765,1770]},"key"],["app",{"sourceInterval":[1772,1776]},"none",[]],["terminal",{"sourceInterval":[1778,1787]},"default"],["app",{"sourceInterval":[1789,1793]},"none",[]]]]]],"ComputedExpression":["define",{"sourceInterval":[1802,1964]},null,[],["alt",{"sourceInterval":[1823,1964]},["app",{"sourceInterval":[1823,1896]},"TagExpression",[["terminal",{"sourceInterval":[1837,1847]},"Computed"],["terminal",{"sourceInterval":[1849,1854]},"key"],["app",{"sourceInterval":[1856,1860]},"none",[]],["terminal",{"sourceInterval":[1862,1867]},"src"],["app",{"sourceInterval":[1869,1873]},"none",[]],["app",{"sourceInterval":[1875,1895]},"DependencyExpression",[]]]],["app",{"sourceInterval":[1912,1964]},"TagSelfClosing",[["terminal",{"sourceInterval":[1927,1937]},"Computed"],["terminal",{"sourceInterval":[1939,1944]},"key"],["app",{"sourceInterval":[1946,1950]},"none",[]],["terminal",{"sourceInterval":[1952,1957]},"src"],["app",{"sourceInterval":[1959,1963]},"none",[]]]]]],"ActionExpression":["define",{"sourceInterval":[1972,2112]},null,[],["alt",{"sourceInterval":[1991,2112]},["app",{"sourceInterval":[1991,2046]},"TagExpression",[["terminal",{"sourceInterval":[2005,2013]},"Action"],["terminal",{"sourceInterval":[2015,2020]},"key"],["app",{"sourceInterval":[2022,2026]},"none",[]],["terminal",{"sourceInterval":[2028,2033]},"src"],["app",{"sourceInterval":[2035,2039]},"none",[]],["app",{"sourceInterval":[2041,2045]},"none",[]]]],["app",{"sourceInterval":[2062,2112]},"TagSelfClosing",[["terminal",{"sourceInterval":[2077,2085]},"Action"],["terminal",{"sourceInterval":[2087,2092]},"key"],["app",{"sourceInterval":[2094,2098]},"none",[]],["terminal",{"sourceInterval":[2100,2105]},"src"],["app",{"sourceInterval":[2107,2111]},"none",[]]]]]],"ConditionExpression":["define",{"sourceInterval":[2120,2216]},null,[],["app",{"sourceInterval":[2142,2216]},"TagExpression",[["terminal",{"sourceInterval":[2156,2167]},"Condition"],["app",{"sourceInterval":[2169,2173]},"none",[]],["app",{"sourceInterval":[2175,2179]},"none",[]],["terminal",{"sourceInterval":[2181,2185]},"if"],["app",{"sourceInterval":[2187,2191]},"none",[]],["app",{"sourceInterval":[2193,2215]},"ConditionLegalContents",[]]]]],"ConditionLegalContents":["define",{"sourceInterval":[2222,2421]},null,[],["alt",{"sourceInterval":[2247,2421]},["app",{"sourceInterval":[2247,2261]},"RoomExpression",[]],["app",{"sourceInterval":[2277,2296]},"ConditionExpression",[]],["app",{"sourceInterval":[2312,2324]},"TextContents",[]],["app",{"sourceInterval":[2340,2355]},"LayerExpression",[]],["app",{"sourceInterval":[2371,2385]},"ExitExpression",[]],["app",{"sourceInterval":[2401,2421]},"DependencyExpression",[]]]],"LayerExpression":["define",{"sourceInterval":[2429,2514]},null,[],["app",{"sourceInterval":[2447,2514]},"TagExpression",[["terminal",{"sourceInterval":[2461,2468]},"Layer"],["terminal",{"sourceInterval":[2470,2475]},"key"],["app",{"sourceInterval":[2477,2481]},"none",[]],["app",{"sourceInterval":[2483,2487]},"none",[]],["app",{"sourceInterval":[2489,2493]},"none",[]],["app",{"sourceInterval":[2495,2513]},"LayerLegalContents",[]]]]],"LayerLegalContents":["define",{"sourceInterval":[2520,2620]},null,[],["alt",{"sourceInterval":[2541,2620]},["app",{"sourceInterval":[2541,2555]},"RoomExpression",[]],["app",{"sourceInterval":[2571,2590]},"ConditionExpression",[]],["app",{"sourceInterval":[2606,2620]},"ExitExpression",[]]]],"ExitExpression":["define",{"sourceInterval":[2628,2798]},null,[],["alt",{"sourceInterval":[2645,2798]},["app",{"sourceInterval":[2645,2717]},"TagExpression",[["terminal",{"sourceInterval":[2659,2665]},"Exit"],["alt",{"sourceInterval":[2667,2690]},["terminal",{"sourceInterval":[2668,2673]},"key"],["terminal",{"sourceInterval":[2676,2680]},"to"],["terminal",{"sourceInterval":[2683,2689]},"from"]],["app",{"sourceInterval":[2692,2696]},"none",[]],["app",{"sourceInterval":[2698,2702]},"none",[]],["app",{"sourceInterval":[2704,2708]},"none",[]],["app",{"sourceInterval":[2710,2716]},"string",[]]]],["app",{"sourceInterval":[2733,2798]},"TagSelfClosing",[["terminal",{"sourceInterval":[2748,2754]},"Exit"],["alt",{"sourceInterval":[2756,2779]},["terminal",{"sourceInterval":[2757,2762]},"key"],["terminal",{"sourceInterval":[2765,2769]},"to"],["terminal",{"sourceInterval":[2772,2778]},"from"]],["app",{"sourceInterval":[2781,2785]},"none",[]],["app",{"sourceInterval":[2787,2791]},"none",[]],["app",{"sourceInterval":[2793,2797]},"none",[]]]]]],"LinkExpression":["define",{"sourceInterval":[2806,2886]},null,[],["app",{"sourceInterval":[2823,2886]},"TagExpression",[["terminal",{"sourceInterval":[2837,2843]},"Link"],["alt",{"sourceInterval":[2845,2859]},["terminal",{"sourceInterval":[2846,2851]},"key"],["terminal",{"sourceInterval":[2854,2858]},"to"]],["app",{"sourceInterval":[2861,2865]},"none",[]],["app",{"sourceInterval":[2867,2871]},"none",[]],["app",{"sourceInterval":[2873,2877]},"none",[]],["app",{"sourceInterval":[2879,2885]},"string",[]]]]],"RoomExpression":["define",{"sourceInterval":[2894,2980]},null,[],["app",{"sourceInterval":[2911,2980]},"TagExpression",[["terminal",{"sourceInterval":[2925,2931]},"Room"],["terminal",{"sourceInterval":[2933,2938]},"key"],["terminal",{"sourceInterval":[2940,2949]},"display"],["app",{"sourceInterval":[2951,2955]},"none",[]],["terminal",{"sourceInterval":[2957,2965]},"global"],["app",{"sourceInterval":[2967,2979]},"RoomContents",[]]]]],"RoomContents":["define",{"sourceInterval":[2986,3103]},null,[],["alt",{"sourceInterval":[3001,3103]},["app",{"sourceInterval":[3001,3013]},"TextContents",[]],["app",{"sourceInterval":[3029,3043]},"NameExpression",[]],["app",{"sourceInterval":[3059,3073]},"ExitExpression",[]],["app",{"sourceInterval":[3089,3103]},"LinkExpression",[]]]],"LiteralNameExpression":["define",{"sourceInterval":[3111,3158]},null,[],["app",{"sourceInterval":[3135,3158]},"LiteralValueTag",[["terminal",{"sourceInterval":[3151,3157]},"Name"]]]],"NameExpression":["define",{"sourceInterval":[3164,3197]},null,[],["app",{"sourceInterval":[3181,3197]},"ValueTag",[["terminal",{"sourceInterval":[3190,3196]},"Name"]]]],"LiteralValueTag":["define",{"sourceInterval":[3205,3282]},null,["label"],["app",{"sourceInterval":[3230,3282]},"TagExpression",[["param",{"sourceInterval":[3244,3249]},0],["app",{"sourceInterval":[3251,3255]},"none",[]],["app",{"sourceInterval":[3257,3261]},"none",[]],["app",{"sourceInterval":[3263,3267]},"none",[]],["app",{"sourceInterval":[3269,3273]},"none",[]],["app",{"sourceInterval":[3275,3281]},"string",[]]]]],"ValueTag":["define",{"sourceInterval":[3290,3366]},null,["label"],["app",{"sourceInterval":[3308,3366]},"TagExpression",[["param",{"sourceInterval":[3322,3327]},0],["app",{"sourceInterval":[3329,3333]},"none",[]],["app",{"sourceInterval":[3335,3339]},"none",[]],["app",{"sourceInterval":[3341,3345]},"none",[]],["app",{"sourceInterval":[3347,3351]},"none",[]],["app",{"sourceInterval":[3353,3365]},"TextContents",[]]]]],"TextContents":["define",{"sourceInterval":[3372,3416]},null,[],["alt",{"sourceInterval":[3387,3416]},["app",{"sourceInterval":[3387,3393]},"string",[]],["app",{"sourceInterval":[3396,3416]},"EmbeddedJSExpression",[]]]],"TagExpression":["define",{"sourceInterval":[3512,3709]},null,["tag","tagKeyArgs","tagLiteralArgs","tagProgramArgs","tagBooleanArgs","LegalContents"],["seq",{"sourceInterval":[3608,3709]},["app",{"sourceInterval":[3608,3680]},"TagOpen",[["param",{"sourceInterval":[3616,3619]},0],["param",{"sourceInterval":[3621,3631]},1],["param",{"sourceInterval":[3633,3647]},2],["param",{"sourceInterval":[3649,3663]},3],["param",{"sourceInterval":[3665,3679]},4]]],["star",{"sourceInterval":[3681,3695]},["param",{"sourceInterval":[3681,3694]},5]],["app",{"sourceInterval":[3696,3709]},"TagClose",[["param",{"sourceInterval":[3705,3708]},0]]]]],"string":["define",{"sourceInterval":[3715,3755]},null,[],["plus",{"sourceInterval":[3724,3755]},["alt",{"sourceInterval":[3725,3753]},["app",{"sourceInterval":[3725,3735]},"stringText",[]],["app",{"sourceInterval":[3738,3753]},"spaceCompressor",[]]]]],"stringText":["define",{"sourceInterval":[3761,3817]},null,[],["plus",{"sourceInterval":[3774,3817]},["alt",{"sourceInterval":[3775,3815]},["seq",{"sourceInterval":[3775,3799]},["not",{"sourceInterval":[3775,3795]},["alt",{"sourceInterval":[3777,3794]},["terminal",{"sourceInterval":[3777,3780]},"<"],["terminal",{"sourceInterval":[3783,3786]},"{"],["app",{"sourceInterval":[3789,3794]},"space",[]]]],["app",{"sourceInterval":[3796,3799]},"any",[]]],["terminal",{"sourceInterval":[3802,3807]},"\\<"],["terminal",{"sourceInterval":[3810,3815]},"\\{"]]]],"legalKey":["define",{"sourceInterval":[3823,3863]},null,[],["star",{"sourceInterval":[3834,3863]},["alt",{"sourceInterval":[3835,3861]},["app",{"sourceInterval":[3835,3841]},"letter",[]],["app",{"sourceInterval":[3844,3849]},"digit",[]],["terminal",{"sourceInterval":[3852,3855]},"-"],["terminal",{"sourceInterval":[3858,3861]},"_"]]]],"spaceCompressor":["define",{"sourceInterval":[3869,3895]},null,[],["plus",{"sourceInterval":[3887,3895]},["app",{"sourceInterval":[3888,3893]},"space",[]]]],"TagSelfClosing":["define",{"sourceInterval":[3901,4068]},null,["tag","tagKeyArgs","tagLiteralArgs","tagProgramArgs","tagBooleanArgs"],["seq",{"sourceInterval":[3983,4068]},["terminal",{"sourceInterval":[3983,3986]},"<"],["param",{"sourceInterval":[3987,3990]},0],["star",{"sourceInterval":[3991,4063]},["app",{"sourceInterval":[3991,4062]},"TagArgument",[["param",{"sourceInterval":[4003,4013]},1],["param",{"sourceInterval":[4015,4029]},2],["param",{"sourceInterval":[4031,4045]},3],["param",{"sourceInterval":[4047,4061]},4]]]],["terminal",{"sourceInterval":[4064,4068]},"/>"]]],"TagOpen":["define",{"sourceInterval":[4074,4233]},null,["tag","tagKeyArgs","tagLiteralArgs","tagProgramArgs","tagBooleanArgs"],["seq",{"sourceInterval":[4149,4233]},["terminal",{"sourceInterval":[4149,4152]},"<"],["param",{"sourceInterval":[4153,4156]},0],["star",{"sourceInterval":[4157,4229]},["app",{"sourceInterval":[4157,4228]},"TagArgument",[["param",{"sourceInterval":[4169,4179]},1],["param",{"sourceInterval":[4181,4195]},2],["param",{"sourceInterval":[4197,4211]},3],["param",{"sourceInterval":[4213,4227]},4]]]],["terminal",{"sourceInterval":[4230,4233]},">"]]],"TagArgument":["define",{"sourceInterval":[4239,4450]},null,["tagKeyArgs","tagLiteralArgs","tagProgramArgs","tagBooleanArgs"],["alt",{"sourceInterval":[4313,4450]},["app",{"sourceInterval":[4313,4339]},"TagArgumentKey",[["param",{"sourceInterval":[4328,4338]},0]]],["app",{"sourceInterval":[4342,4376]},"TagLiteralArgument",[["param",{"sourceInterval":[4361,4375]},1]]],["app",{"sourceInterval":[4379,4413]},"TagProgramArgument",[["param",{"sourceInterval":[4398,4412]},2]]],["app",{"sourceInterval":[4416,4450]},"tagBooleanArgument",[["param",{"sourceInterval":[4435,4449]},3]]]]],"TagLiteralArgument":["define",{"sourceInterval":[4456,4526]},null,["tagLiteralArgs"],["app",{"sourceInterval":[4493,4526]},"tagArgumentQuoted",[["param",{"sourceInterval":[4511,4525]},0]]]],"TagProgramArgument":["define",{"sourceInterval":[4532,4641]},null,["tagProgramArgs"],["alt",{"sourceInterval":[4569,4641]},["app",{"sourceInterval":[4569,4602]},"tagArgumentQuoted",[["param",{"sourceInterval":[4587,4601]},0]]],["app",{"sourceInterval":[4605,4641]},"TagArgumentBracketed",[["param",{"sourceInterval":[4626,4640]},0]]]]],"tagBooleanArgument":["define",{"sourceInterval":[4647,4720]},null,["tagBooleanArgs"],["seq",{"sourceInterval":[4684,4720]},["param",{"sourceInterval":[4684,4698]},0],["lookahead",{"sourceInterval":[4699,4720]},["alt",{"sourceInterval":[4701,4719]},["app",{"sourceInterval":[4701,4706]},"space",[]],["terminal",{"sourceInterval":[4709,4712]},">"],["terminal",{"sourceInterval":[4715,4719]},"/>"]]]]],"tagArgumentQuoted":["define",{"sourceInterval":[4726,4796]},null,["tagLegalArgs"],["seq",{"sourceInterval":[4760,4796]},["param",{"sourceInterval":[4760,4772]},0],["terminal",{"sourceInterval":[4773,4778]},"=\""],["app",{"sourceInterval":[4779,4796]},"tagArgValueQuoted",[]]]],"TagArgumentKey":["define",{"sourceInterval":[4802,4866]},null,["tagLegalArgs"],["seq",{"sourceInterval":[4833,4866]},["lex",{"sourceInterval":[4833,4853]},["seq",{"sourceInterval":[4835,4852]},["param",{"sourceInterval":[4835,4847]},0],["terminal",{"sourceInterval":[4848,4852]},"=("]]],["app",{"sourceInterval":[4854,4862]},"legalKey",[]],["terminal",{"sourceInterval":[4863,4866]},")"]]],"TagArgumentBracketed":["define",{"sourceInterval":[4872,4947]},null,["tagLegalArgs"],["seq",{"sourceInterval":[4909,4947]},["lex",{"sourceInterval":[4909,4929]},["seq",{"sourceInterval":[4911,4928]},["param",{"sourceInterval":[4911,4923]},0],["terminal",{"sourceInterval":[4924,4928]},"={"]]],["star",{"sourceInterval":[4930,4943]},["app",{"sourceInterval":[4930,4942]},"JSExpression",[]]],["terminal",{"sourceInterval":[4944,4947]},"}"]]],"tagArgValueQuoted":["define",{"sourceInterval":[4953,4999]},null,[],["seq",{"sourceInterval":[4973,4999]},["star",{"sourceInterval":[4973,4994]},["alt",{"sourceInterval":[4974,4992]},["terminal",{"sourceInterval":[4974,4980]},"\\\""],["seq",{"sourceInterval":[4983,4992]},["not",{"sourceInterval":[4983,4988]},["terminal",{"sourceInterval":[4984,4988]},"\""]],["app",{"sourceInterval":[4989,4992]},"any",[]]]]],["terminal",{"sourceInterval":[4995,4999]},"\""]]],"TagClose":["define",{"sourceInterval":[5005,5033]},null,["tag"],["seq",{"sourceInterval":[5021,5033]},["terminal",{"sourceInterval":[5021,5025]},"</"],["param",{"sourceInterval":[5026,5029]},0],["terminal",{"sourceInterval":[5030,5033]},">"]]],"none":["define",{"sourceInterval":[5039,5054]},null,[],["seq",{"sourceInterval":[5046,5054]},["not",{"sourceInterval":[5046,5050]},["terminal",{"sourceInterval":[5047,5050]},">"]],["terminal",{"sourceInterval":[5051,5054]},">"]]],"EmbeddedJSExpression":["define",{"sourceInterval":[5843,5887]},null,[],["seq",{"sourceInterval":[5866,5887]},["terminal",{"sourceInterval":[5866,5869]},"{"],["star",{"sourceInterval":[5870,5883]},["app",{"sourceInterval":[5870,5882]},"JSExpression",[]]],["terminal",{"sourceInterval":[5884,5887]},"}"]]],"JSExpression":["define",{"sourceInterval":[5893,6086]},null,[],["alt",{"sourceInterval":[5908,6086]},["app",{"sourceInterval":[5908,5928]},"EmbeddedJSExpression",[]],["app",{"sourceInterval":[5952,5972]},"JSDoubleQuotedString",[]],["app",{"sourceInterval":[5996,6016]},"JSSingleQuotedString",[]],["app",{"sourceInterval":[6040,6056]},"JSTemplateString",[]],["app",{"sourceInterval":[6080,6086]},"JSText",[]]]],"JSDoubleQuotedString":["define",{"sourceInterval":[6092,6141]},null,[],["seq",{"sourceInterval":[6115,6141]},["terminal",{"sourceInterval":[6115,6119]},"\""],["star",{"sourceInterval":[6120,6136]},["app",{"sourceInterval":[6120,6135]},"JSNoDoubleQuote",[]]],["terminal",{"sourceInterval":[6137,6141]},"\""]]],"JSNoDoubleQuote":["define",{"sourceInterval":[6147,6185]},null,[],["alt",{"sourceInterval":[6165,6185]},["terminal",{"sourceInterval":[6165,6171]},"\\\""],["seq",{"sourceInterval":[6174,6185]},["not",{"sourceInterval":[6175,6180]},["terminal",{"sourceInterval":[6176,6180]},"\""]],["app",{"sourceInterval":[6181,6184]},"any",[]]]]],"JSSingleQuotedString":["define",{"sourceInterval":[6191,6240]},null,[],["seq",{"sourceInterval":[6214,6240]},["terminal",{"sourceInterval":[6214,6218]},"'"],["star",{"sourceInterval":[6219,6235]},["app",{"sourceInterval":[6219,6234]},"JSNoSingleQuote",[]]],["terminal",{"sourceInterval":[6236,6240]},"'"]]],"JSNoSingleQuote":["define",{"sourceInterval":[6246,6284]},null,[],["alt",{"sourceInterval":[6264,6284]},["terminal",{"sourceInterval":[6264,6270]},"\\'"],["seq",{"sourceInterval":[6273,6284]},["not",{"sourceInterval":[6274,6279]},["terminal",{"sourceInterval":[6275,6279]},"'"]],["app",{"sourceInterval":[6280,6283]},"any",[]]]]],"JSTemplateString":["define",{"sourceInterval":[6290,6357]},null,[],["seq",{"sourceInterval":[6309,6357]},["terminal",{"sourceInterval":[6309,6312]},"`"],["star",{"sourceInterval":[6313,6353]},["alt",{"sourceInterval":[6314,6350]},["app",{"sourceInterval":[6314,6327]},"JSNoBackQuote",[]],["app",{"sourceInterval":[6330,6350]},"JSTemplateEvaluation",[]]]],["terminal",{"sourceInterval":[6354,6357]},"`"]]],"JSTemplateEvaluation":["define",{"sourceInterval":[6363,6407]},null,[],["seq",{"sourceInterval":[6386,6407]},["terminal",{"sourceInterval":[6386,6390]},"${"],["app",{"sourceInterval":[6391,6403]},"JSExpression",[]],["terminal",{"sourceInterval":[6404,6407]},"}"]]],"JSNoBackQuote":["define",{"sourceInterval":[6413,6456]},null,[],["alt",{"sourceInterval":[6429,6456]},["terminal",{"sourceInterval":[6429,6434]},"\\`"],["seq",{"sourceInterval":[6437,6456]},["not",{"sourceInterval":[6438,6451]},["alt",{"sourceInterval":[6440,6450]},["terminal",{"sourceInterval":[6440,6443]},"`"],["terminal",{"sourceInterval":[6446,6450]},"${"]]],["app",{"sourceInterval":[6452,6455]},"any",[]]]]],"JSText":["define",{"sourceInterval":[6462,6553]},null,[],["plus",{"sourceInterval":[6471,6553]},["alt",{"sourceInterval":[6472,6551]},["terminal",{"sourceInterval":[6472,6477]},"\\{"],["terminal",{"sourceInterval":[6480,6486]},"\\\""],["terminal",{"sourceInterval":[6489,6494]},"\\'"],["terminal",{"sourceInterval":[6497,6502]},"\\`"],["terminal",{"sourceInterval":[6505,6510]},"\\}"],["seq",{"sourceInterval":[6513,6551]},["not",{"sourceInterval":[6514,6546]},["alt",{"sourceInterval":[6516,6545]},["terminal",{"sourceInterval":[6516,6519]},"{"],["terminal",{"sourceInterval":[6522,6526]},"\""],["terminal",{"sourceInterval":[6529,6533]},"'"],["terminal",{"sourceInterval":[6536,6539]},"`"],["terminal",{"sourceInterval":[6542,6545]},"}"]]],["app",{"sourceInterval":[6547,6550]},"any",[]]]]]],"space":["override",{"sourceInterval":[6636,6682]},null,[],["alt",{"sourceInterval":[6645,6682]},["app",{"sourceInterval":[6645,6655]},"whitespace",[]],["app",{"sourceInterval":[6658,6672]},"lineTerminator",[]],["app",{"sourceInterval":[6675,6682]},"comment",[]]]],"sourceCharacter":["define",{"sourceInterval":[6687,6708]},null,[],["app",{"sourceInterval":[6705,6708]},"any",[]]],"whitespace_verticalTab":["define",{"sourceInterval":[6751,6775]},null,[],["terminal",{"sourceInterval":[6751,6757]},"\u000b"]],"whitespace_formFeed":["define",{"sourceInterval":[6795,6816]},null,[],["terminal",{"sourceInterval":[6795,6801]},"\f"]],"whitespace_noBreakSpace":["define",{"sourceInterval":[6859,6884]},null,[],["terminal",{"sourceInterval":[6859,6867]}," "]],"whitespace_byteOrderMark":["define",{"sourceInterval":[6904,6930]},null,[],["terminal",{"sourceInterval":[6904,6912]},"﻿"]],"whitespace":["define",{"sourceInterval":[6714,6971]},null,[],["alt",{"sourceInterval":[6727,6971]},["terminal",{"sourceInterval":[6727,6731]},"\t"],["app",{"sourceInterval":[6751,6757]},"whitespace_verticalTab",[]],["app",{"sourceInterval":[6795,6801]},"whitespace_formFeed",[]],["terminal",{"sourceInterval":[6836,6839]}," "],["app",{"sourceInterval":[6859,6867]},"whitespace_noBreakSpace",[]],["app",{"sourceInterval":[6904,6912]},"whitespace_byteOrderMark",[]],["app",{"sourceInterval":[6950,6971]},"unicodeSpaceSeparator",[]]]],"unicodeSpaceSeparator":["define",{"sourceInterval":[6976,7029]},null,[],["alt",{"sourceInterval":[7000,7029]},["range",{"sourceInterval":[7000,7018]}," ","​"],["terminal",{"sourceInterval":[7021,7029]},"　"]]],"lineTerminator":["define",{"sourceInterval":[7037,7087]},null,[],["alt",{"sourceInterval":[7054,7087]},["terminal",{"sourceInterval":[7054,7058]},"\n"],["terminal",{"sourceInterval":[7061,7065]},"\r"],["terminal",{"sourceInterval":[7068,7076]},"\u2028"],["terminal",{"sourceInterval":[7079,7087]},"\u2029"]]],"lineTerminatorSequence":["define",{"sourceInterval":[7093,7166]},null,[],["alt",{"sourceInterval":[7118,7166]},["terminal",{"sourceInterval":[7118,7122]},"\n"],["seq",{"sourceInterval":[7125,7135]},["terminal",{"sourceInterval":[7125,7129]},"\r"],["not",{"sourceInterval":[7130,7135]},["terminal",{"sourceInterval":[7131,7135]},"\n"]]],["terminal",{"sourceInterval":[7138,7146]},"\u2028"],["terminal",{"sourceInterval":[7149,7157]},"\u2029"],["terminal",{"sourceInterval":[7160,7166]},"\r\n"]]],"comment":["define",{"sourceInterval":[7174,7220]},null,[],["alt",{"sourceInterval":[7184,7220]},["app",{"sourceInterval":[7184,7200]},"multiLineComment",[]],["app",{"sourceInterval":[7203,7220]},"singleLineComment",[]]]],"multiLineComment":["define",{"sourceInterval":[7228,7281]},null,[],["seq",{"sourceInterval":[7247,7281]},["terminal",{"sourceInterval":[7247,7251]},"/*"],["star",{"sourceInterval":[7252,7276]},["seq",{"sourceInterval":[7253,7274]},["not",{"sourceInterval":[7253,7258]},["terminal",{"sourceInterval":[7254,7258]},"*/"]],["app",{"sourceInterval":[7259,7274]},"sourceCharacter",[]]]],["terminal",{"sourceInterval":[7277,7281]},"*/"]]],"singleLineComment":["define",{"sourceInterval":[7287,7346]},null,[],["seq",{"sourceInterval":[7307,7346]},["terminal",{"sourceInterval":[7307,7311]},"//"],["star",{"sourceInterval":[7312,7346]},["seq",{"sourceInterval":[7313,7344]},["not",{"sourceInterval":[7313,7328]},["app",{"sourceInterval":[7314,7328]},"lineTerminator",[]]],["app",{"sourceInterval":[7329,7344]},"sourceCharacter",[]]]]]]}]);export default result;