"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DualListSelector = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const dual_list_selector_1 = tslib_1.__importDefault(require("@patternfly/react-styles/css/components/DualListSelector/dual-list-selector"));
const react_styles_1 = require("@patternfly/react-styles");
const helpers_1 = require("../../helpers");
const DualListSelectorContext_1 = require("./DualListSelectorContext");
class DualListSelector extends react_1.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const _a = this.props, { className, children, id, isTree } = _a, props = tslib_1.__rest(_a, ["className", "children", "id", "isTree"]);
        return ((0, jsx_runtime_1.jsx)(DualListSelectorContext_1.DualListSelectorContext.Provider, { value: { isTree }, children: (0, jsx_runtime_1.jsx)(helpers_1.GenerateId, { children: (randomId) => ((0, jsx_runtime_1.jsx)("div", Object.assign({ className: (0, react_styles_1.css)(dual_list_selector_1.default.dualListSelector, className), id: id || randomId }, props, { children: children }))) }) }));
    }
}
exports.DualListSelector = DualListSelector;
DualListSelector.displayName = 'DualListSelector';
DualListSelector.defaultProps = {
    children: '',
    isTree: false
};
//# sourceMappingURL=DualListSelector.js.map