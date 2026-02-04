import { __rest } from "tslib";
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef } from 'react';
import styles from '@patternfly/react-styles/css/components/Button/button.mjs';
import { css } from '@patternfly/react-styles';
import { Spinner, spinnerSize } from '../Spinner';
import { useOUIAProps } from '../../helpers/OUIA/ouia';
import { Badge } from '../Badge';
export var ButtonVariant;
(function (ButtonVariant) {
    ButtonVariant["primary"] = "primary";
    ButtonVariant["secondary"] = "secondary";
    ButtonVariant["tertiary"] = "tertiary";
    ButtonVariant["danger"] = "danger";
    ButtonVariant["warning"] = "warning";
    ButtonVariant["link"] = "link";
    ButtonVariant["plain"] = "plain";
    ButtonVariant["control"] = "control";
    ButtonVariant["stateful"] = "stateful";
})(ButtonVariant || (ButtonVariant = {}));
export var ButtonType;
(function (ButtonType) {
    ButtonType["button"] = "button";
    ButtonType["submit"] = "submit";
    ButtonType["reset"] = "reset";
})(ButtonType || (ButtonType = {}));
export var ButtonSize;
(function (ButtonSize) {
    ButtonSize["default"] = "default";
    ButtonSize["sm"] = "sm";
    ButtonSize["lg"] = "lg";
})(ButtonSize || (ButtonSize = {}));
export var ButtonState;
(function (ButtonState) {
    ButtonState["read"] = "read";
    ButtonState["unread"] = "unread";
    ButtonState["attention"] = "attention";
})(ButtonState || (ButtonState = {}));
const ButtonBase = (_a) => {
    var { children = null, className = '', component = 'button', isClicked = false, isBlock = false, isDisabled = false, isAriaDisabled = false, isLoading = null, isDanger = false, spinnerAriaValueText, spinnerAriaLabelledBy, spinnerAriaLabel, size = ButtonSize.default, inoperableEvents = ['onClick', 'onKeyPress'], isInline = false, type = ButtonType.button, variant = ButtonVariant.primary, state = ButtonState.unread, hasNoPadding = false, iconPosition = 'start', 'aria-label': ariaLabel = null, icon = null, role, ouiaId, ouiaSafe = true, tabIndex = null, innerRef, countOptions } = _a, props = __rest(_a, ["children", "className", "component", "isClicked", "isBlock", "isDisabled", "isAriaDisabled", "isLoading", "isDanger", "spinnerAriaValueText", "spinnerAriaLabelledBy", "spinnerAriaLabel", "size", "inoperableEvents", "isInline", "type", "variant", "state", "hasNoPadding", "iconPosition", 'aria-label', "icon", "role", "ouiaId", "ouiaSafe", "tabIndex", "innerRef", "countOptions"]);
    const ouiaProps = useOUIAProps(Button.displayName, ouiaId, ouiaSafe, variant);
    const Component = component;
    const isButtonElement = Component === 'button';
    const isInlineSpan = isInline && Component === 'span';
    const isIconAlignedAtEnd = iconPosition === 'end' || iconPosition === 'right';
    const preventedEvents = inoperableEvents.reduce((handlers, eventToPrevent) => (Object.assign(Object.assign({}, handlers), { [eventToPrevent]: (event) => {
            event.preventDefault();
        } })), {});
    const getDefaultTabIdx = () => {
        if (isDisabled) {
            return isButtonElement ? null : -1;
        }
        else if (isAriaDisabled) {
            return null;
        }
        else if (isInlineSpan) {
            return 0;
        }
    };
    const _icon = icon && (_jsx("span", { className: css(styles.buttonIcon, children && styles.modifiers[isIconAlignedAtEnd ? 'end' : 'start']), children: icon }));
    const _children = children && _jsx("span", { className: css('pf-v6-c-button__text'), children: children });
    // We only want to render the aria-disabled attribute when true, similar to the disabled attribute natively.
    const shouldRenderAriaDisabled = isAriaDisabled || (!isButtonElement && isDisabled);
    return (_jsxs(Component, Object.assign({}, props, (isAriaDisabled ? preventedEvents : null), (shouldRenderAriaDisabled && { 'aria-disabled': true }), { "aria-label": ariaLabel, className: css(styles.button, styles.modifiers[variant], isBlock && styles.modifiers.block, isDisabled && !isButtonElement && styles.modifiers.disabled, isAriaDisabled && styles.modifiers.ariaDisabled, isClicked && styles.modifiers.clicked, isInline && variant === ButtonVariant.link && styles.modifiers.inline, isDanger && (variant === ButtonVariant.secondary || variant === ButtonVariant.link) && styles.modifiers.danger, isLoading !== null && variant !== ButtonVariant.plain && styles.modifiers.progress, isLoading && styles.modifiers.inProgress, hasNoPadding && variant === ButtonVariant.plain && styles.modifiers.noPadding, variant === ButtonVariant.stateful && styles.modifiers[state], size === ButtonSize.sm && styles.modifiers.small, size === ButtonSize.lg && styles.modifiers.displayLg, className), disabled: isButtonElement ? isDisabled : null, tabIndex: tabIndex !== null ? tabIndex : getDefaultTabIdx(), type: isButtonElement || isInlineSpan ? type : null, role: isInlineSpan ? 'button' : role, ref: innerRef }, ouiaProps, { children: [isLoading && (_jsx("span", { className: css(styles.buttonProgress), children: _jsx(Spinner, { size: spinnerSize.md, isInline: isInline, "aria-valuetext": spinnerAriaValueText, "aria-label": spinnerAriaLabel, "aria-labelledby": spinnerAriaLabelledBy }) })), isIconAlignedAtEnd ? (_jsxs(_Fragment, { children: [_children, _icon] })) : (_jsxs(_Fragment, { children: [_icon, _children] })), countOptions && (_jsx("span", { className: css(styles.buttonCount, countOptions.className), children: _jsx(Badge, { isRead: countOptions.isRead, isDisabled: isDisabled, children: countOptions.count }) }))] })));
};
export const Button = forwardRef((props, ref) => _jsx(ButtonBase, Object.assign({ innerRef: ref }, props)));
Button.displayName = 'Button';
//# sourceMappingURL=Button.js.map