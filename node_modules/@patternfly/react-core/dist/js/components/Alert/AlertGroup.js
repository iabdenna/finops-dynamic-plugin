"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertGroup = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const ReactDOM = tslib_1.__importStar(require("react-dom"));
const helpers_1 = require("../../helpers");
const AlertGroupInline_1 = require("./AlertGroupInline");
class AlertGroup extends react_1.Component {
    constructor() {
        super(...arguments);
        this.state = {
            container: undefined
        };
    }
    componentDidMount() {
        const container = document.createElement('div');
        const target = this.getTargetElement();
        this.setState({ container });
        target.appendChild(container);
    }
    componentWillUnmount() {
        const target = this.getTargetElement();
        if (this.state.container) {
            target.removeChild(this.state.container);
        }
    }
    getTargetElement() {
        const appendTo = this.props.appendTo;
        if (typeof appendTo === 'function') {
            return appendTo();
        }
        return appendTo || document.body;
    }
    render() {
        const _a = this.props, { className, children, hasAnimations = false, isToast, isLiveRegion, onOverflowClick, overflowMessage, 'aria-label': ariaLabel, 
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        appendTo } = _a, // do not pass down to ul
        props = tslib_1.__rest(_a, ["className", "children", "hasAnimations", "isToast", "isLiveRegion", "onOverflowClick", "overflowMessage", 'aria-label', "appendTo"]);
        const alertGroup = ((0, jsx_runtime_1.jsx)(AlertGroupInline_1.AlertGroupInline, Object.assign({ onOverflowClick: onOverflowClick, className: className, isToast: isToast, isLiveRegion: isLiveRegion, overflowMessage: overflowMessage, "aria-label": ariaLabel, hasAnimations: hasAnimations }, props, { children: children })));
        if (!this.props.isToast) {
            return alertGroup;
        }
        const container = this.state.container;
        if (!helpers_1.canUseDOM || !container) {
            return null;
        }
        return ReactDOM.createPortal(alertGroup, container);
    }
}
exports.AlertGroup = AlertGroup;
AlertGroup.displayName = 'AlertGroup';
//# sourceMappingURL=AlertGroup.js.map