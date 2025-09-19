"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorGroups = exports.SelectorGroupType = exports.Selectors = exports.SelectorType = void 0;
exports.createSelector = createSelector;
exports.getSelectorValue = getSelectorValue;
exports.createSelectorGroup = createSelectorGroup;
exports.getSelectorsFromGroup = getSelectorsFromGroup;
var token_1 = require("../lexer/token");
var keywords_1 = require("./keywords");
var operators_1 = require("./operators");
var SelectorType;
(function (SelectorType) {
    SelectorType["EndOfLine"] = "EndOfLine";
    SelectorType["EndOfFile"] = "EndOfFile";
    SelectorType["LParenthesis"] = "LParenthesis";
    SelectorType["RParenthesis"] = "RParenthesis";
    SelectorType["CLBracket"] = "CLBracket";
    SelectorType["CRBracket"] = "CRBracket";
    SelectorType["SLBracket"] = "SLBracket";
    SelectorType["SRBracket"] = "SRBracket";
    SelectorType["Assign"] = "Assign";
    SelectorType["AddShorthand"] = "AddShorthand";
    SelectorType["SubtractShorthand"] = "SubtractShorthand";
    SelectorType["MultiplyShorthand"] = "MultiplyShorthand";
    SelectorType["DivideShorthand"] = "DivideShorthand";
    SelectorType["PowerShorthand"] = "PowerShorthand";
    SelectorType["ModuloShorthand"] = "ModuloShorthand";
    SelectorType["Separator"] = "Separator";
    SelectorType["Function"] = "Function";
    SelectorType["EndFunction"] = "EndFunction";
    SelectorType["EndWhile"] = "EndWhile";
    SelectorType["EndFor"] = "EndFor";
    SelectorType["EndIf"] = "EndIf";
    SelectorType["SliceSeparator"] = "SliceSeparator";
    SelectorType["MapKeyValueSeparator"] = "MapKeyValueSeparator";
    SelectorType["MapSeparator"] = "MapSeparator";
    SelectorType["ListSeparator"] = "ListSeparator";
    SelectorType["CallSeparator"] = "CallSeparator";
    SelectorType["ArgumentSeparator"] = "ArgumentSeparator";
    SelectorType["ImportCodeSeparator"] = "ImportCodeSeparator";
    SelectorType["ElseIf"] = "ElseIf";
    SelectorType["Then"] = "Then";
    SelectorType["Else"] = "Else";
    SelectorType["In"] = "In";
    SelectorType["MemberSeparator"] = "MemberSeparator";
    SelectorType["NumberSeparator"] = "NumberSeparator";
    SelectorType["Reference"] = "Reference";
    SelectorType["Isa"] = "Isa";
    SelectorType["Or"] = "Or";
    SelectorType["And"] = "And";
    SelectorType["Minus"] = "Minus";
    SelectorType["Plus"] = "Plus";
    SelectorType["Times"] = "Times";
    SelectorType["Divide"] = "Divide";
    SelectorType["Power"] = "Power";
    SelectorType["Mod"] = "Mod";
    SelectorType["Equal"] = "Equal";
    SelectorType["NotEqual"] = "NotEqual";
    SelectorType["Greater"] = "Greater";
    SelectorType["GreaterEqual"] = "GreaterEqual";
    SelectorType["Lesser"] = "Lesser";
    SelectorType["LessEqual"] = "LessEqual";
    SelectorType["New"] = "New";
    SelectorType["Not"] = "Not";
    SelectorType["Comment"] = "Comment";
})(SelectorType || (exports.SelectorType = SelectorType = {}));
function createSelector(options) {
    var selector;
    if (options.value === undefined) {
        selector = new Function('token', "if (token == null) return false;return token.type === '".concat(options.type, "';"));
        Object.defineProperty(selector, 'name', {
            value: "selector_".concat(options.type),
            writable: false,
        });
    }
    else {
        selector = new Function('token', "if (token == null) return false;return token.value === '".concat(options.value, "' && token.type === '").concat(options.type, "';"));
        Object.defineProperty(selector, 'name', {
            value: "selector_".concat(options.type, "_").concat(options.value),
            writable: false,
        });
    }
    selector.data = options;
    return selector;
}
function getSelectorValue(value) {
    return value.data.value;
}
exports.Selectors = {
    EndOfLine: createSelector({
        type: token_1.TokenType.EOL,
        value: operators_1.Operator.EndOfLine,
    }),
    EndOfFile: createSelector({
        type: token_1.TokenType.EOF,
        value: operators_1.Operator.EndOfFile,
    }),
    LParenthesis: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.LParenthesis,
    }),
    RParenthesis: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.RParenthesis,
    }),
    CLBracket: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.CLBracket,
    }),
    CRBracket: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.CRBracket,
    }),
    SLBracket: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.SLBracket,
    }),
    SRBracket: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.SRBracket,
    }),
    Assign: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Assign,
    }),
    AddShorthand: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.AddShorthand,
    }),
    SubtractShorthand: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.SubtractShorthand,
    }),
    MultiplyShorthand: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.MultiplyShorthand,
    }),
    DivideShorthand: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.DivideShorthand,
    }),
    PowerShorthand: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.PowerShorthand,
    }),
    ModuloShorthand: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.ModuloShorthand,
    }),
    Separator: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Comma,
    }),
    Function: createSelector({
        type: token_1.TokenType.Keyword,
        value: keywords_1.Keyword.Function,
    }),
    EndFunction: createSelector({
        type: token_1.TokenType.Keyword,
        value: keywords_1.Keyword.EndFunction,
    }),
    EndWhile: createSelector({
        type: token_1.TokenType.Keyword,
        value: keywords_1.Keyword.EndWhile,
    }),
    EndFor: createSelector({
        type: token_1.TokenType.Keyword,
        value: keywords_1.Keyword.EndFor,
    }),
    EndIf: createSelector({
        type: token_1.TokenType.Keyword,
        value: keywords_1.Keyword.EndIf,
    }),
    SliceSeparator: createSelector({
        type: token_1.TokenType.SliceOperator,
        value: operators_1.Operator.SliceSeparator,
    }),
    MapKeyValueSeparator: createSelector({
        type: token_1.TokenType.SliceOperator,
        value: operators_1.Operator.SliceSeparator,
    }),
    MapSeparator: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Comma,
    }),
    ListSeparator: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Comma,
    }),
    CallSeparator: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Comma,
    }),
    ArgumentSeparator: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Comma,
    }),
    ImportCodeSeparator: createSelector({
        type: token_1.TokenType.SliceOperator,
        value: operators_1.Operator.SliceSeparator,
    }),
    ElseIf: createSelector({
        type: token_1.TokenType.Keyword,
        value: keywords_1.Keyword.ElseIf,
    }),
    Then: createSelector({
        type: token_1.TokenType.Keyword,
        value: keywords_1.Keyword.Then,
    }),
    Else: createSelector({
        type: token_1.TokenType.Keyword,
        value: keywords_1.Keyword.Else,
    }),
    In: createSelector({
        type: token_1.TokenType.Keyword,
        value: keywords_1.Keyword.In,
    }),
    MemberSeparator: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Member,
    }),
    NumberSeparator: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Member,
    }),
    Reference: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Reference,
    }),
    Isa: createSelector({
        type: token_1.TokenType.Keyword,
        value: operators_1.Operator.Isa,
    }),
    Or: createSelector({
        type: token_1.TokenType.Keyword,
        value: operators_1.Operator.Or,
    }),
    And: createSelector({
        type: token_1.TokenType.Keyword,
        value: operators_1.Operator.And,
    }),
    Minus: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Minus,
    }),
    Plus: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Plus,
    }),
    Times: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Asterisk,
    }),
    Power: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Power,
    }),
    Divide: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Slash,
    }),
    Mod: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Modulo,
    }),
    Equal: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.Equal,
    }),
    NotEqual: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.NotEqual,
    }),
    Greater: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.GreaterThan,
    }),
    GreaterEqual: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.GreaterThanOrEqual,
    }),
    Lesser: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.LessThan,
    }),
    LessEqual: createSelector({
        type: token_1.TokenType.Punctuator,
        value: operators_1.Operator.LessThanOrEqual,
    }),
    New: createSelector({
        type: token_1.TokenType.Keyword,
        value: keywords_1.Keyword.New,
    }),
    Not: createSelector({
        type: token_1.TokenType.Keyword,
        value: keywords_1.Keyword.Not,
    }),
    Comment: createSelector({
        type: token_1.TokenType.Comment,
    }),
};
function createSelectorGroup(name, selectors) {
    var selectorsWithValue = selectors.filter(function (item) { return item.data.value !== undefined; });
    var casesWithValue = selectorsWithValue
        .map(function (selector) {
        return "case '".concat(selector.data.value, "': return token.type === '").concat(selector.data.type, "';");
    })
        .join('\n');
    var selectorsWithoutValue = selectors.filter(function (item) { return item.data.value === undefined; });
    var casesWithoutValue = selectorsWithoutValue
        .map(function (selector) {
        return "case '".concat(selector.data.type, "':");
    })
        .join('\n');
    var groupf = new Function('token', "\n\t".concat(casesWithoutValue.length > 0
        ? "switch(token.type) {\n\t\t".concat(casesWithoutValue, "\n\t\t\treturn true;\n\t}")
        : '', "\n\t").concat(casesWithValue.length > 0
        ? "switch(token.value) {\n\t\t".concat(casesWithValue, "\n\t}")
        : '', "\n\treturn false;"));
    Object.defineProperty(groupf, 'name', {
        value: "selector_group_".concat(name),
        writable: false,
    });
    groupf.selectors = selectors;
    return groupf;
}
function getSelectorsFromGroup(group) {
    return group.selectors;
}
var SelectorGroupType;
(function (SelectorGroupType) {
    SelectorGroupType["BlockEndOfLine"] = "BlockEndOfLine";
    SelectorGroupType["AssignmentEndOfExpr"] = "AssignmentEndOfExpr";
    SelectorGroupType["AssignmentShorthand"] = "AssignmentShorthand";
    SelectorGroupType["AssignmentCommandArgs"] = "AssignmentCommandArgs";
    SelectorGroupType["ReturnStatementEnd"] = "ReturnStatementEnd";
    SelectorGroupType["FunctionDeclarationArgEnd"] = "FunctionDeclarationArgEnd";
    SelectorGroupType["ComparisonOperators"] = "ComparisonOperators";
    SelectorGroupType["MultiDivOperators"] = "MultiDivOperators";
    SelectorGroupType["CallArgsEnd"] = "CallArgsEnd";
})(SelectorGroupType || (exports.SelectorGroupType = SelectorGroupType = {}));
exports.SelectorGroups = {
    BlockEndOfLine: createSelectorGroup(SelectorGroupType.AssignmentEndOfExpr, [
        exports.Selectors.EndOfLine,
        exports.Selectors.Comment,
    ]),
    AssignmentEndOfExpr: createSelectorGroup(SelectorGroupType.AssignmentEndOfExpr, [
        exports.Selectors.EndOfFile,
        exports.Selectors.EndOfLine,
        exports.Selectors.Else,
        exports.Selectors.Comment,
    ]),
    AssignmentShorthand: createSelectorGroup(SelectorGroupType.AssignmentShorthand, [
        exports.Selectors.AddShorthand,
        exports.Selectors.SubtractShorthand,
        exports.Selectors.MultiplyShorthand,
        exports.Selectors.DivideShorthand,
        exports.Selectors.PowerShorthand,
        exports.Selectors.ModuloShorthand,
    ]),
    AssignmentCommandArgs: createSelectorGroup(SelectorGroupType.AssignmentCommandArgs, [
        exports.Selectors.ArgumentSeparator,
        exports.Selectors.EndOfLine,
        exports.Selectors.EndOfFile,
    ]),
    ReturnStatementEnd: createSelectorGroup(SelectorGroupType.ReturnStatementEnd, [
        exports.Selectors.EndOfLine,
        exports.Selectors.Else,
        exports.Selectors.Comment,
    ]),
    FunctionDeclarationArgEnd: createSelectorGroup(SelectorGroupType.FunctionDeclarationArgEnd, [
        exports.Selectors.RParenthesis,
        exports.Selectors.EndOfFile,
        exports.Selectors.EndOfLine,
    ]),
    ComparisonOperators: createSelectorGroup(SelectorGroupType.ComparisonOperators, [
        exports.Selectors.Equal,
        exports.Selectors.NotEqual,
        exports.Selectors.Greater,
        exports.Selectors.GreaterEqual,
        exports.Selectors.Lesser,
        exports.Selectors.LessEqual,
    ]),
    MultiDivOperators: createSelectorGroup(SelectorGroupType.MultiDivOperators, [
        exports.Selectors.Times,
        exports.Selectors.Divide,
        exports.Selectors.Mod,
    ]),
    CallArgsEnd: createSelectorGroup(SelectorGroupType.CallArgsEnd, [
        exports.Selectors.ArgumentSeparator,
        exports.Selectors.RParenthesis,
    ]),
};
