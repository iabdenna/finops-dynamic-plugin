import { __rest } from "tslib";
import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { InternalFormFieldGroup } from './InternalFormFieldGroup';
export const FormFieldGroupExpandable = (_a) => {
    var { children, className, header, isExpanded = false, toggleAriaLabel } = _a, props = __rest(_a, ["children", "className", "header", "isExpanded", "toggleAriaLabel"]);
    const [localIsExpanded, setIsExpanded] = useState(isExpanded);
    return (_jsx(InternalFormFieldGroup, Object.assign({ className: className, header: header, isExpandable: true, isExpanded: localIsExpanded, toggleAriaLabel: toggleAriaLabel, onToggle: () => setIsExpanded(!localIsExpanded) }, props, { children: children })));
};
FormFieldGroupExpandable.displayName = 'FormFieldGroupExpandable';
//# sourceMappingURL=FormFieldGroupExpandable.js.map