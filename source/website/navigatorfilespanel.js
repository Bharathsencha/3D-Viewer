import { AddDiv, SetDomElementHeight, GetDomElementOuterHeight } from '../engine/viewer/domutils.js';
import { NavigatorPanel } from './navigatorpanel.js';
import { TreeViewButton, TreeViewButtonItem, TreeViewGroupItem, TreeViewSingleItem } from './treeview.js';
import { Loc } from '../engine/core/localization.js';
import { AddSvgIconElement } from './utils.js';

export class NavigatorFilesPanel extends NavigatorPanel
{
    constructor (parentDiv)
    {
        super (parentDiv);
        this.titleDiv.classList.add ('withbuttons');
        this.titleButtonsDiv = AddDiv (this.titleDiv, 'ov_navigator_tree_title_buttons');
        let openButton = AddDiv (this.titleButtonsDiv, 'ov_navigator_button');
        openButton.setAttribute ('alt', Loc ('Open file from your device'));
        openButton.setAttribute ('title', Loc ('Open file from your device'));
        openButton.classList.add ('right');
        AddSvgIconElement (openButton, 'open');
        openButton.addEventListener ('click', () => {
            if (this.callbacks && this.callbacks.onFileBrowseButtonClicked) {
                this.callbacks.onFileBrowseButtonClicked ();
            }
        });
    }

    GetName ()
    {
        return Loc ('Files');
    }

    GetIcon ()
    {
        return 'files';
    }

    Resize ()
    {
        let titleHeight = GetDomElementOuterHeight (this.titleDiv);
        let height = this.parentDiv.offsetHeight;
        SetDomElementHeight (this.treeDiv, height - titleHeight);
    }

    Clear ()
    {
        super.Clear ();
    }

    Fill (importResult)
    {
        super.Fill (importResult);
        const usedFiles = importResult.usedFiles;
        const missingFiles = importResult.missingFiles;

        if (missingFiles.length > 0) {
            let missingFilesItem = new TreeViewGroupItem (Loc ('Missing Files'), null);
            missingFilesItem.ShowChildren (true);
            this.treeView.AddChild (missingFilesItem);
            for (let i = 0; i < missingFiles.length; i++) {
                let file = missingFiles[i];
                let item = new TreeViewButtonItem (file);
                let browseButton = new TreeViewButton ('open');
                browseButton.OnClick (() => {
                    this.callbacks.onFileBrowseButtonClicked ();
                });
                item.AppendButton (browseButton);
                missingFilesItem.AddChild (item);
            }
            let filesItem = new TreeViewGroupItem (Loc ('Available Files'), null);
            filesItem.ShowChildren (true);
            this.treeView.AddChild (filesItem);
            for (let i = 0; i < usedFiles.length; i++) {
                let file = usedFiles[i];
                let item = new TreeViewSingleItem (file);
                filesItem.AddChild (item);
            }
        } else {
            for (let i = 0; i < usedFiles.length; i++) {
                let file = usedFiles[i];
                let item = new TreeViewSingleItem (file);
                this.treeView.AddChild (item);
            }
        }
    }
}
