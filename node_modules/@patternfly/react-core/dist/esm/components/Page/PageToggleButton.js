import { __rest } from "tslib";
import { jsx as _jsx } from "react/jsx-runtime";
import { Button, ButtonVariant } from '../../components/Button';
import { PageContextConsumer } from './PageContext';
export const PageToggleButton = (_a) => {
    var { children, isSidebarOpen = true, onSidebarToggle = () => undefined, id = 'nav-toggle' } = _a, props = __rest(_a, ["children", "isSidebarOpen", "onSidebarToggle", "id"]);
    return (_jsx(PageContextConsumer, { children: ({ isManagedSidebar, onSidebarToggle: managedOnSidebarToggle, isSidebarOpen: managedIsSidebarOpen }) => {
            const sidebarToggle = isManagedSidebar ? managedOnSidebarToggle : onSidebarToggle;
            const sidebarOpen = isManagedSidebar ? managedIsSidebarOpen : isSidebarOpen;
            return (_jsx(Button, Object.assign({ id: id, onClick: sidebarToggle, "aria-label": "Side navigation toggle", "aria-expanded": sidebarOpen ? 'true' : 'false', variant: ButtonVariant.plain }, props, { children: children })));
        } }));
};
PageToggleButton.displayName = 'PageToggleButton';
//# sourceMappingURL=PageToggleButton.js.map