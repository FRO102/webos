let catalog = [];
let opener = () => {};

export const registerApps = apps => { catalog = apps.map(app => ({ ...app })); };
export const registerOpener = fn => { opener = fn; };
export const listApps = () => catalog.map(app => ({ ...app }));
export const openApp = appId => opener(appId);
