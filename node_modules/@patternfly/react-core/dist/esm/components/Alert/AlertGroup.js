import { __rest } from "tslib";
import { jsx as _jsx } from "react/jsx-runtime";
import { Component } from 'react';
import * as ReactDOM from 'react-dom';
import { canUseDOM } from '../../helpers';
import { AlertGroupInline } from './AlertGroupInline';
class AlertGroup extends Component {
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
        props = __rest(_a, ["className", "children", "hasAnimations", "isToast", "isLiveRegion", "onOverflowClick", "overflowMessage", 'aria-label', "appendTo"]);
        const alertGroup = (_jsx(AlertGroupInline, Object.assign({ onOverflowClick: onOverflowClick, className: className, isToast: isToast, isLiveRegion: isLiveRegion, overflowMessage: overflowMessage, "aria-label": ariaLabel, hasAnimations: hasAnimations }, props, { children: children })));
        if (!this.props.isToast) {
            return alertGroup;
        }
        const container = this.state.container;
        if (!canUseDOM || !container) {
            return null;
        }
        return ReactDOM.createPortal(alertGroup, container);
    }
}
AlertGroup.displayName = 'AlertGroup';
export { AlertGroup };
//# sourceMappingURL=AlertGroup.js.map