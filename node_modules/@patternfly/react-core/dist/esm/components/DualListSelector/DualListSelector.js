import { __rest } from "tslib";
import { jsx as _jsx } from "react/jsx-runtime";
import { Component } from 'react';
import styles from '@patternfly/react-styles/css/components/DualListSelector/dual-list-selector.mjs';
import { css } from '@patternfly/react-styles';
import { GenerateId } from '../../helpers';
import { DualListSelectorContext } from './DualListSelectorContext';
class DualListSelector extends Component {
    constructor(props) {
        super(props);
    }
    render() {
        const _a = this.props, { className, children, id, isTree } = _a, props = __rest(_a, ["className", "children", "id", "isTree"]);
        return (_jsx(DualListSelectorContext.Provider, { value: { isTree }, children: _jsx(GenerateId, { children: (randomId) => (_jsx("div", Object.assign({ className: css(styles.dualListSelector, className), id: id || randomId }, props, { children: children }))) }) }));
    }
}
DualListSelector.displayName = 'DualListSelector';
DualListSelector.defaultProps = {
    children: '',
    isTree: false
};
export { DualListSelector };
//# sourceMappingURL=DualListSelector.js.map