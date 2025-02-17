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
    // console.log('My Extension "mcfunction-commenter" is now active!');

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
            await fs.access(`${folderPath}/${getDataPath()}`);
            // console.log('We are in a datapack.');
        } catch (err) {
            vscode.window.showErrorMessage(`Folder "${getDataPath()}" does not exist in "${folderPath}".`);
            return;
        }
        // Init flags & comment
		let comment = "#> from: ";
        // If the "data" folder exists
		let functionID = pathToFunctionID(filePath, folderPath);
        // Parts of the comment
        let parts = [];
		// Functions calling this one
		let callers = await searchInDir(`function ${functionID}`, folderPath);
        // Function tag calling this one
        let tagCallers = await searchInDir(functionID, folderPath, '**/tags/function/**.json');
        if(tagCallers) {
            for(const tagCaller of tagCallers) {
                parts.push(pathToFunctionTagID(tagCaller, folderPath));
            }
        }
        else{
            vscode.window.showInformationMessage('No origin function tag were found');
        }
        if(callers) {
            for(const caller of callers) {
                parts.push(pathToFunctionID(caller, folderPath));
            }
        }
        else{
            vscode.window.showInformationMessage('No origin function were found');
        }
        for(const part of parts) {
            // check if it's called recursively
            if(part == pathToFunctionID(filePath, folderPath)) {
                // Insert "this, " right after "#> from: "
                comment = [comment.slice(0, 9), "this"+getSeparator(), comment.slice(9)].join('');
            }
            else {
                // 1.1.0: configure separator
                comment += (part + getSeparator());
            }
        }
		// Remove last separator
		comment = comment.slice(0,comment.length-getSeparator().length);
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
	let relativePath = filePath.slice(folderPath.length+getDataPath().length+2)
	// Example: namespace/function/load
	relativePath = relativePath.slice(0,relativePath.length-11)
	let namespace = relativePath.substring(0,relativePath.indexOf('\\'));
	return `${namespace}:${relativePath.slice(namespace.length+10).replaceAll('\\','/')}`;
}
/**
 * @param {string} filePath path to the function tag file
 * @param {string} folderPath path to the workspace folder
 */
function pathToFunctionTagID(filePath, folderPath) {
	// Example: namespace/tags/function/load.json
	let relativePath = filePath.slice(folderPath.length+6)
	// Example: namespace/tags/function/load
	relativePath = relativePath.slice(0,relativePath.length-5)
    // Example: namespace
	let namespace = relativePath.substring(0,relativePath.indexOf('\\'));
    // Example: #namespace:load
    // console.log(`[pathToFunctionTagID] returned '#${namespace}:${relativePath.slice(namespace.length+15).replaceAll('\\','/')}'`);
	return `#${namespace}:${relativePath.slice(namespace.length+15).replaceAll('\\','/')}`;
}
/**
 * @returns {String} Separator setting with proper escape characters
 */
function getSeparator() {
    return vscode.workspace.getConfiguration().get("mcfunction-commenter.from.separator").replaceAll('\\n','\n');
}
/**
 * @returns {String} Data path setting with all \ replaced by /
 */
function getDataPath() {
    return vscode.workspace.getConfiguration().get("mcfunction-commenter.global.data_path").replaceAll('\\','/');
}
/**
 * @param {string} s the string
 * @param {string} dir the directory
 * @param {string} pat the pattern the file path should match
 */
async function searchInDir(s, dir, pat = '**/*.mcfunction') {
	try {
        // Ensure the folder exists
        const folderUri = vscode.Uri.file(dir);

        // Search for all .mcfunction files in the folder
        const files = await vscode.workspace.findFiles(
            // @ts-ignore
            { base: folderUri.fsPath, pattern: pat } // Match .mcfunction files
        );

        if (files.length === 0) {
            vscode.window.showInformationMessage(`No .mcfunction files found in ${dir}.`);
            return;
        }

        let matches = [];

        for (const file of files) {
            // Read file content
            const content = await fs.readFile(file.fsPath, 'utf8');

            const regex = new RegExp(`(?<!#)${s}(?![a-z/._])`);
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
            // console.log(`"${s}" not found in any files.`);
            return [];
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
            // console.log(`The file "${filePath}" already contains "#> from: ". No changes made.`);
            return;
        }

        // Prepend the line to the content
        const newContent = `${comment}\n${content}`;

        // Write the updated content back to the file
        await fs.writeFile(filePath, newContent, 'utf8');
        // console.log(`Successfully prepended line to "${filePath}".`);
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
