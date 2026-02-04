import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useState } from 'react';
import progressStyle from '@patternfly/react-styles/css/components/Progress/progress.mjs';
import { css } from '@patternfly/react-styles';
import { Tooltip } from '../Tooltip';
import CheckCircleIcon from '@patternfly/react-icons/dist/esm/icons/check-circle-icon';
import TimesCircleIcon from '@patternfly/react-icons/dist/esm/icons/times-circle-icon';
import ExclamationTriangleIcon from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { ProgressBar } from './ProgressBar';
import { ProgressHelperText } from './ProgressHelperText';
export var ProgressMeasureLocation;
(function (ProgressMeasureLocation) {
    ProgressMeasureLocation["outside"] = "outside";
    ProgressMeasureLocation["inside"] = "inside";
    ProgressMeasureLocation["top"] = "top";
    ProgressMeasureLocation["none"] = "none";
})(ProgressMeasureLocation || (ProgressMeasureLocation = {}));
export var ProgressVariant;
(function (ProgressVariant) {
    ProgressVariant["danger"] = "danger";
    ProgressVariant["success"] = "success";
    ProgressVariant["warning"] = "warning";
})(ProgressVariant || (ProgressVariant = {}));
const variantToIcon = {
    danger: TimesCircleIcon,
    success: CheckCircleIcon,
    warning: ExclamationTriangleIcon
};
export const ProgressContainer = ({ progressBarAriaProps, value, title = '', parentId, label = null, variant = null, measureLocation = ProgressMeasureLocation.top, isTitleTruncated = false, tooltipPosition, helperText }) => {
    const StatusIcon = variantToIcon.hasOwnProperty(variant) && variantToIcon[variant];
    const [tooltip, setTooltip] = useState('');
    const onMouseEnter = (event) => {
        if (event.target.offsetWidth < event.target.scrollWidth) {
            setTooltip(title || event.target.innerHTML);
        }
        else {
            setTooltip('');
        }
    };
    const Title = (_jsx("div", { className: css(progressStyle.progressDescription, isTitleTruncated && typeof title === 'string' && progressStyle.modifiers.truncate), id: `${parentId}-description`, "aria-hidden": "true", onMouseEnter: isTitleTruncated && typeof title === 'string' ? onMouseEnter : null, children: title }));
    return (_jsxs(Fragment, { children: [title &&
                (tooltip ? (_jsx(Tooltip, { position: tooltipPosition, content: tooltip, isVisible: true, children: Title })) : (Title)), (measureLocation !== ProgressMeasureLocation.none || StatusIcon) && (_jsxs("div", { className: css(progressStyle.progressStatus), "aria-hidden": "true", children: [(measureLocation === ProgressMeasureLocation.top || measureLocation === ProgressMeasureLocation.outside) && (_jsx("span", { className: css(progressStyle.progressMeasure), children: label || `${value}%` })), StatusIcon && (_jsx("span", { className: css(progressStyle.progressStatusIcon), children: _jsx(StatusIcon, {}) }))] })), _jsx(ProgressBar, { role: "progressbar", progressBarAriaProps: progressBarAriaProps, value: value, children: measureLocation === ProgressMeasureLocation.inside && `${value}%` }), helperText && _jsx(ProgressHelperText, { children: helperText })] }));
};
ProgressContainer.displayName = 'ProgressContainer';
//# sourceMappingURL=ProgressContainer.js.map