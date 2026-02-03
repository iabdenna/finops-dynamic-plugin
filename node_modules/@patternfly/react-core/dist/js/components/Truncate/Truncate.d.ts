/// <reference types="react" />
import { TooltipPosition } from '../Tooltip';
export declare enum TruncatePosition {
    start = "start",
    end = "end",
    middle = "middle"
}
export interface TruncateProps extends React.HTMLProps<HTMLSpanElement> {
    /** Class to add to outer span */
    className?: string;
    /** Text to truncate */
    content: string;
    /** The number of characters displayed in the second half of the truncation */
    trailingNumChars?: number;
    /** Where the text will be truncated */
    position?: 'start' | 'middle' | 'end';
    /** Tooltip position */
    tooltipPosition?: TooltipPosition | 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end';
    /** @hide The element whose parent to reference when calculating whether truncation should occur. This must be an ancestor
     * of the ClipboardCopy, and must have a valid width value. For internal use only, do not use as it is not part of the public API
     * and is subject to change.
     */
    refToGetParent?: React.RefObject<any>;
}
export declare const Truncate: React.FunctionComponent<TruncateProps>;
//# sourceMappingURL=Truncate.d.ts.map