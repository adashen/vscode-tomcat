'use strcit';

import * as nls from 'vscode-nls';

export const localize: nls.LocalizeFunc = nls.config(process.env.VSCODE_NLS_CONFIG)();
