import { __rest } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useEffect, useRef, useState } from 'react';
import styles from '@patternfly/react-styles/css/components/Truncate/truncate.mjs';
import { css } from '@patternfly/react-styles';
import { Tooltip } from '../Tooltip';
import { getResizeObserver } from '../../helpers/resizeObserver';
export var TruncatePosition;
(function (TruncatePosition) {
    TruncatePosition["start"] = "start";
    TruncatePosition["end"] = "end";
    TruncatePosition["middle"] = "middle";
})(TruncatePosition || (TruncatePosition = {}));
const truncateStyles = {
    start: styles.truncateEnd,
    end: styles.truncateStart
};
const minWidthCharacters = 12;
const sliceContent = (str, slice) => [str.slice(0, str.length - slice), str.slice(-slice)];
export const Truncate = (_a) => {
    var { className, position = 'end', tooltipPosition = 'top', trailingNumChars = 7, content, refToGetParent } = _a, props = __rest(_a, ["className", "position", "tooltipPosition", "trailingNumChars", "content", "refToGetParent"]);
    const [isTruncated, setIsTruncated] = useState(true);
    const [parentElement, setParentElement] = useState(null);
    const [textElement, setTextElement] = useState(null);
    const textRef = useRef(null);
    const subParentRef = useRef(null);
    const observer = useRef(null);
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
    useEffect(() => {
        if (textRef && textRef.current && !textElement) {
            setTextElement(textRef.current);
        }
        if (((refToGetParent === null || refToGetParent === void 0 ? void 0 : refToGetParent.current) || ((subParentRef === null || subParentRef === void 0 ? void 0 : subParentRef.current) && subParentRef.current.parentElement.parentElement)) &&
            !parentElement) {
            setParentElement((refToGetParent === null || refToGetParent === void 0 ? void 0 : refToGetParent.current.parentElement) || (subParentRef === null || subParentRef === void 0 ? void 0 : subParentRef.current.parentElement.parentElement));
        }
    }, [textRef, subParentRef, textElement, parentElement]);
    useEffect(() => {
        if (textElement && parentElement && !observer.current) {
            const totalTextWidth = calculateTotalTextWidth(textElement, trailingNumChars, content);
            const textWidth = position === 'middle' ? totalTextWidth : textElement.scrollWidth;
            const handleResize = () => {
                const parentWidth = getActualWidth(parentElement);
                setIsTruncated(textWidth >= parentWidth);
            };
            const observer = getResizeObserver(parentElement, handleResize);
            return () => {
                observer();
            };
        }
    }, [textElement, parentElement, trailingNumChars, content, position]);
    const truncateBody = (_jsxs("span", Object.assign({ ref: subParentRef, className: css(styles.truncate, className) }, props, { children: [(position === TruncatePosition.end || position === TruncatePosition.start) && (_jsxs("span", { ref: textRef, className: truncateStyles[position], children: [content, position === TruncatePosition.start && _jsx(Fragment, { children: "\u200E" })] })), position === TruncatePosition.middle && content.length - trailingNumChars > minWidthCharacters && (_jsxs(Fragment, { children: [_jsx("span", { ref: textRef, className: styles.truncateStart, children: sliceContent(content, trailingNumChars)[0] }), _jsx("span", { className: styles.truncateEnd, children: sliceContent(content, trailingNumChars)[1] })] })), position === TruncatePosition.middle && content.length - trailingNumChars <= minWidthCharacters && (_jsx(Fragment, { children: _jsx("span", { ref: textRef, className: styles.truncateStart, children: content }) }))] })));
    return isTruncated ? (_jsx(Tooltip, { hidden: !isTruncated, position: tooltipPosition, content: content, children: truncateBody })) : (truncateBody);
};
Truncate.displayName = 'Truncate';
//# sourceMappingURL=Truncate.js.map