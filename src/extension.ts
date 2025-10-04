// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// This method is called when your extension is deactivated
export function deactivate() {
	stopTimer();
	statusBarItem.dispose();
}


let timerInterval: NodeJS.Timeout | null = null;
let statusBarItem: vscode.StatusBarItem;
const STORAGE_FILE = '.cpp-timer.json';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

export function activate(context: vscode.ExtensionContext) {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.tooltip = 'Code Timer (click to stop)';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
			statusBarItem.text += ' (stopped)';
		}
	}

	// Register the click command
	const stopTimerCommand = vscode.commands.registerCommand('cppTimer.stopTimer', () => {
		stopTimer();
		vscode.window.showInformationMessage('Timer manually stopped.');
	});
	context.subscriptions.push(stopTimerCommand);

	// Assign command to status bar item
	statusBarItem.command = 'cppTimer.stopTimer';


	// Track file creation
	vscode.workspace.onDidCreateFiles(event => {
		const data = loadMetadata();
		for (const file of event.files) {
			if (file.fsPath.endsWith('.cpp') && !data[file.fsPath]) {
				data[file.fsPath] = { createdAt: Date.now(), compiledAt: null };
			}
		}
		saveMetadata(data);
	});

	// Detect compilation success (simple terminal watcher)
	vscode.tasks.onDidEndTaskProcess(event => {
		if (event.exitCode === 0 && event.execution.task.name.toLowerCase().includes("build")) {
			// handle successful compile
		}
	});


	// Update timer when editor changes
	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor && editor.document.fileName.endsWith('.cpp')) {
			startTimer(editor.document.fileName);
		} else {
			stopTimer();
			statusBarItem.text = '';
		}
	});

	// Start if a C++ file is already active
	const editor = vscode.window.activeTextEditor;
	if (editor && editor.document.fileName.endsWith('.cpp')) {
		startTimer(editor.document.fileName);
	}


	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "codetimer" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('codetimer.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from codetimer!');
	});


}

/** --- Helpers --- **/

function loadMetadata(): Record<string, { createdAt: number; compiledAt: number | null }> {
	const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!folder) return {};
	const filePath = path.join(folder, STORAGE_FILE);
	if (!fs.existsSync(filePath)) return {};
	return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveMetadata(data: any) {
	const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!folder) return;
	const filePath = path.join(folder, STORAGE_FILE);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function formatDuration(ms: number) {
	const s = Math.floor(ms / 1000);
	const m = Math.floor(s / 60);
	const h = Math.floor(m / 60);
	const sec = s % 60;
	const min = m % 60;
	if (h > 0) return `${h}h ${min}m ${sec}s`;
	if (m > 0) return `${m}m ${sec}s`;
	return `${sec}s`;
}

function startTimer(filePath: string) {
	const data = loadMetadata();
	if (!data[filePath]) {
		data[filePath] = { createdAt: Date.now(), compiledAt: null };
		saveMetadata(data);
	}
	stopTimer();
	updateStatus(filePath);
	timerInterval = setInterval(() => updateStatus(filePath), 1000);
}

function stopTimer() {
	if (timerInterval) {
		clearInterval(timerInterval);
		timerInterval = null;
	}
}

function updateStatus(filePath: string) {
	const data = loadMetadata();
	const entry = data[filePath];
	if (!entry) {
		statusBarItem.text = '';
		return;
	}

	const now = Date.now();
	const duration = (entry.compiledAt ?? now) - entry.createdAt;

	if (entry.compiledAt) {
		statusBarItem.text = `⏱ ${path.basename(filePath)}: ${formatDuration(duration)} (done)`;
		stopTimer();
	} else {
		statusBarItem.text = `⏱ ${path.basename(filePath)}: ${formatDuration(duration)}`;
	}
}

function markCompiled(filePath: string) {
	const data = loadMetadata();
	if (data[filePath] && !data[filePath].compiledAt) {
		data[filePath].compiledAt = Date.now();
		saveMetadata(data);
		vscode.window.showInformationMessage(
			`First successful compilation of ${path.basename(filePath)} after ${formatDuration(
				data[filePath].compiledAt - data[filePath].createdAt
			)}`
		);
		updateStatus(filePath);
	}
}

function extractFileNameFromCommand(cmd: string): string | null {
	const match = cmd.match(/g\+\+\s+([^\s]+\.cpp)/);
	if (!match) return null;
	const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	return folder ? path.join(folder, match[1]) : null;
}
