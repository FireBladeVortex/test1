https://firebladevortex.github.io/test1/

https://firebladevortex.github.io/test1/index-t.html

https://firebladevortex.github.io/test1/video.html

https://firebladevortex.github.io/test1/vid-t.html


ctrl shift p
open user setting(json)
{
    "security.workspace.trust.untrustedFiles": "open",
    "files.associations": {
        "*.gs": "javascript"
    },
    "chat.disableAIFeatures": true,
    "editor.lightbulb.enabled": "off",
}

// Place your key bindings in this file to override the defaults
[
    {
        "key": "ctrl+tab",
        "command": "-workbench.action.quickOpenPreviousRecentlyUsedEditorInGroup",
        "when": "!activeEditorGroupEmpty"
    },
    {
        "key": "ctrl+shift+tab",
        "command": "-workbench.action.quickOpenLeastRecentlyUsedEditorInGroup",
        "when": "!activeEditorGroupEmpty"
    },
    {
        "key": "ctrl+tab",
        "command": "-workbench.action.quickOpenNavigateNextInEditorPicker",
        "when": "inEditorsPicker && inQuickOpen"
    },
    {
        "key": "ctrl+shift+tab",
        "command": "-workbench.action.quickOpenNavigatePreviousInEditorPicker",
        "when": "inEditorsPicker && inQuickOpen"
    },
    {
        "key": "ctrl+tab",
        "command": "workbench.action.nextEditor"
    },
    {
        "key": "ctrl+pagedown",
        "command": "-workbench.action.nextEditor"
    },
    {
        "key": "ctrl+shift+tab",
        "command": "workbench.action.previousEditor"
    },
    {
        "key": "ctrl+pageup",
        "command": "-workbench.action.previousEditor"
    }
]
