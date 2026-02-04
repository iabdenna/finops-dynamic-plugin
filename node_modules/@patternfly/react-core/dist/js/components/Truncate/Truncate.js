"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Truncate = exports.TruncatePosition = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const truncate_1 = tslib_1.__importDefault(require("@patternfly/react-styles/css/components/Truncate/truncate"));
const react_styles_1 = require("@patternfly/react-styles");
const Tooltip_1 = require("../Tooltip");
const resizeObserver_1 = require("../../helpers/resizeObserver");
var TruncatePosition;
(function (TruncatePosition) {
    TruncatePosition["start"] = "start";
    TruncatePosition["end"] = "end";
    TruncatePosition["middle"] = "middle";
})(TruncatePosition || (exports.TruncatePosition = TruncatePosition = {}));
const truncateStyles = {
    start: truncate_1.default.truncateEnd,
    end: truncate_1.default.truncateStart
};
const minWidthCharacters = 12;
const sliceContent = (str, slice) => [str.slice(0, str.length - slice), str.slice(-slice)];
const Truncate = (_a) => {
    var { className, position = 'end', tooltipPosition = 'top', trailingNumChars = 7, content, refToGetParent } = _a, props = tslib_1.__rest(_a, ["className", "position", "tooltipPosition", "trailingNumChars", "content", "refToGetParent"]);
    const [isTruncated, setIsTruncated] = (0, react_1.useState)(true);
    const [parentElement, setParentElement] = (0, react_1.useState)(null);
    const [textElement, setTextElement] = (0, react_1.useState)(null);
    const textRef = (0, react_1.useRef)(null);
    const subParentRef = (0, react_1.useRef)(null);
    const observer = (0, react_1.useRef)(null);
    const getActualWidth = (element) => {
        const computedStyle = getComputedStyle(element);
        return (parseFloat(computedStyle.width) -
            parseFloat(computedStyle.paddingLeft) -
            parseFloat(computedStyle.paddingRight) -
            parseFloat(computedStyle.borderRight) -
            parseFloat(computedStyle.borderLeft));
    };
    const calculateTotalTextWidth = (element, trailingNumChars, content) => {
        const firstTextWidth = element.scrollWidth;
        const firstTextLength = content.length;
        return (firstTextWidth / firstTextLength) * trailingNumChars + firstTextWidth;
    };
    (0, react_1.useEffect)(() => {
        if (textRef && textRef.current && !textElement) {
            setTextElement(textRef.current);
        }
        if (((refToGetParent === null || refToGetParent === void 0 ? void 0 : refToGetParent.current) || ((subParentRef === null || subParentRef === void 0 ? void 0 : subParentRef.current) && subParentRef.current.parentElement.parentElement)) &&
            !parentElement) {
            setParentElement((refToGetParent === null || refToGetParent === void 0 ? void 0 : refToGetParent.current.parentElement) || (subParentRef === null || subParentRef === void 0 ? void 0 : subParentRef.current.parentElement.parentElement));
        }
    }, [textRef, subParentRef, textElement, parentElement]);
    (0, react_1.useEffect)(() => {
        if (textElement && parentElement && !observer.current) {
            const totalTextWidth = calculateTotalTextWidth(textElement, trailingNumChars, content);
            const textWidth = position === 'middle' ? totalTextWidth : textElement.scrollWidth;
            const handleResize = () => {
                const parentWidth = getActualWidth(parentElement);
                setIsTruncated(textWidth >= parentWidth);
            };
            const observer = (0, resizeObserver_1.getResizeObserver)(parentElement, handleResize);
            return () => {
                observer();
            };
        }
    }, [textElement, parentElement, trailingNumChars, content, position]);
    const truncateBody = ((0, jsx_runtime_1.jsxs)("span", Object.assign({ ref: subParentRef, className: (0, react_styles_1.css)(truncate_1.default.truncate, className) }, props, { children: [(position === TruncatePosition.end || position === TruncatePosition.start) && ((0, jsx_runtime_1.jsxs)("span", { ref: textRef, className: truncateStyles[position], children: [content, position === TruncatePosition.start && (0, jsx_runtime_1.jsx)(react_1.Fragment, { children: "\u200E" })] })), position === TruncatePosition.middle && content.length - trailingNumChars > minWidthCharacters && ((0, jsx_runtime_1.jsxs)(react_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("span", { ref: textRef, className: truncate_1.default.truncateStart, children: sliceContent(content, trailingNumChars)[0] }), (0, jsx_runtime_1.jsx)("span", { className: truncate_1.default.truncateEnd, children: sliceContent(content, trailingNumChars)[1] })] })), position === TruncatePosition.middle && content.length - trailingNumChars <= minWidthCharacters && ((0, jsx_runtime_1.jsx)(react_1.Fragment, { children: (0, jsx_runtime_1.jsx)("span", { ref: textRef, className: truncate_1.default.truncateStart, children: content }) }))] })));
    return isTruncated ? ((0, jsx_runtime_1.jsx)(Tooltip_1.Tooltip, { hidden: !isTruncated, position: tooltipPosition, content: content, children: truncateBody })) : (truncateBody);
};
exports.Truncate = Truncate;
exports.Truncate.displayName = 'Truncate';
//# sourceMappingURL=Truncate.js.map