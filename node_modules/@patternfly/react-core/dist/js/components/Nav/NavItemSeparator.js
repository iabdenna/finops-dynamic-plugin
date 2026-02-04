"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NavItemSeparator = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const Divider_1 = require("../Divider");
const NavItemSeparator = (_a) => {
    var { component = 'li' } = _a, props = tslib_1.__rest(_a, ["component"]);
    return (0, jsx_runtime_1.jsx)(Divider_1.Divider, Object.assign({ component: component }, props));
};
exports.NavItemSeparator = NavItemSeparator;
exports.NavItemSeparator.displayName = 'NavItemSeparator';
//# sourceMappingURL=NavItemSeparator.js.map