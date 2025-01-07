// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('My Extension "mcfunction-commenter" is now active!');

    const disposable = vscode.commands.registerCommand('mcfunction-commenter.declare-origins', async function () {
        const editor = vscode.window.activeTextEditor;

        // Check for mcfunction
        if (!editor || !editor.document.fileName.endsWith('.mcfunction')) {
            vscode.window.showErrorMessage("File is not an mcfunction file.");
            return;
        }
		let filePath = editor.document.fileName;
        let folderPath = "";
        const folders = vscode.workspace.workspaceFolders;

        // Check for folder
        if (folders && folders.length > 0) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
            folderPath = workspaceFolder.uri.fsPath;
        } else {
            vscode.window.showErrorMessage('No folder is currently open.');
            return;
        }

        // vscode.window.showInformationMessage('DIR = ' + folderPath);
        // vscode.window.showInformationMessage('FP = ' + filePath);

        // Check for datapack
        try {
            await fs.access(`${folderPath}/data`);
            console.log('We are in a datapack.');
        } catch (err) {
            vscode.window.showErrorMessage(`Folder "data" does not exist in "${folderPath}".`);
            return;
        }

        // If the "data" folder exists
		let functionID = pathToFunctionID(filePath, folderPath);
        // 1.0.1: Removed debug message
        // vscode.window.showInformationMessage('ID = ' + functionID);

		// Functions calling this one
		let callers = await searchInDir(`function ${functionID}`, folderPath);
        console.log(`scanning for function ${functionID} in ${folderPath}`);
        // 1.0.1: Return if search failed
        // 1.0.3 check for callers instead of callers[0]
        if(!callers){
            vscode.window.showInformationMessage('No origin function were found');
            return;
        }
		let comment = "#> from: ";
		for(const caller of callers) {
			// vscode.window.showInformationMessage('Caller = ' + caller);
			if(caller == filePath) {
				// Insert "this, " right after "#> from: "
				comment = [comment.slice(0, 9), "this, ", comment.slice(9)].join('');
			}
			else {
				comment += (pathToFunctionID(caller, folderPath) + ", ");
			}
		}
		comment = comment.slice(0,comment.length-2);
        // 1.0.1: Removed debug message
        // vscode.window.showInformationMessage('COMMENT = ' + comment);
		prependComment(filePath, comment);
    });

    context.subscriptions.push(disposable);
}

/**
 * @param {string} filePath path to the mcfunction file
 * @param {string} folderPath path to the workspace folder
 */
function pathToFunctionID(filePath, folderPath) {
	// Example: namespace/function/load.mcfunction
	let relativePath = filePath.slice(folderPath.length+6)
	// Example: namespace/function/load
	relativePath = relativePath.slice(0,relativePath.length-11)
	let namespace = relativePath.substring(0,relativePath.indexOf('\\'));
	return `${namespace}:${relativePath.slice(namespace.length+10).replaceAll('\\','/')}`;
}
/**
 * @param {string} s the string
 * @param {string} dir the directory
 */
async function searchInDir(s, dir) {
	try {
        // Ensure the folder exists
        const folderUri = vscode.Uri.file(dir);

        // Search for all .mcfunction files in the folder
        const files = await vscode.workspace.findFiles(
            // @ts-ignore
            { base: folderUri.fsPath, pattern: '**/*.mcfunction' } // Match .mcfunction files
        );

        if (files.length === 0) {
            vscode.window.showInformationMessage(`No .mcfunction files found in ${dir}.`);
            return;
        }

        let matches = [];

        for (const file of files) {
            // Read file content
            const content = await fs.readFile(file.fsPath, 'utf8');

            const regex = new RegExp(`${s}(?![a-z/.])`);
            // Search for the string
            // 1.0.4 Use regex to avoid matching other functions
            // Now "function foo:bar/qux" doesn't match for "function foo:bar"
            if (regex.test(content)) {
                matches.push(file.fsPath);
            }
        }

        if (matches.length > 0) {
            console.log(
                `Found "${s}" in the following files:\n${matches.join('\n')}`
            );
			return matches;
        } else {
            vscode.window.showInformationMessage(`"${s}" not found in any files.`);
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Error: ${err.message}`);
    }
}
/**
 * @param {string} filePath path to the file
 * @param {string} comment the comment
 */
async function prependComment(filePath, comment) {
    try {
        // Read the file content
        let content = await fs.readFile(filePath, 'utf8');

        // Check if the file already contains the specific string
        if (content.includes('#> from: ')) {
            console.log(`The file "${filePath}" already contains "#> from: ". No changes made.`);
            return;
        }

        // Prepend the line to the content
        const newContent = `${comment}\n${content}`;

        // Write the updated content back to the file
        await fs.writeFile(filePath, newContent, 'utf8');
        console.log(`Successfully prepended line to "${filePath}".`);
    } catch (error) {
        console.error(`Error handling file "${filePath}":`, error.message);
    }
}
// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
