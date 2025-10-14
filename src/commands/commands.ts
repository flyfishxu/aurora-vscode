// Command handlers for AuroraLang

import * as vscode from 'vscode';
import * as path from 'path';
import { getCompilerPath, runCompiler } from '../utils/compiler';
import { checkDocument, diagnosticCollection } from '../diagnostics/diagnostics';
import { AuroraFormattingProvider } from '../providers/formattingProvider';

let outputChannel: vscode.OutputChannel;

export function initializeCommands(context: vscode.ExtensionContext, channel: vscode.OutputChannel): void {
    outputChannel = channel;

    const commands = [
        vscode.commands.registerCommand('auroralang.run', runAuroraFile),
        vscode.commands.registerCommand('auroralang.runFile', runCurrentFile),
        vscode.commands.registerCommand('auroralang.emitLLVM', emitLLVM),
        vscode.commands.registerCommand('auroralang.check', checkCurrentFile),
        vscode.commands.registerCommand('auroralang.format', formatCurrentFile)
    ];

    context.subscriptions.push(...commands);
}

async function runAuroraFile(uri?: vscode.Uri): Promise<void> {
    let filePath: string;

    if (uri) {
        filePath = uri.fsPath;
    } else {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        filePath = editor.document.uri.fsPath;
    }

    if (!filePath.endsWith('.aur')) {
        vscode.window.showErrorMessage('Not an AuroraLang file (.aur)');
        return;
    }

    const document = await vscode.workspace.openTextDocument(filePath);
    if (document.isDirty) {
        await document.save();
    }

    outputChannel.clear();
    outputChannel.show(true);
    outputChannel.appendLine(`Running: ${filePath}\n`);

    const compilerPath = await getCompilerPath();
    const command = `"${compilerPath}" "${filePath}"`;
    
    outputChannel.appendLine(`> ${command}\n`);
    
    const result = await runCompiler(filePath);

    if (result.stdout) {
        outputChannel.appendLine(result.stdout);
    }
    if (result.stderr) {
        outputChannel.appendLine('Errors:\n' + result.stderr);
    }
}

async function runCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }
    await runAuroraFile(editor.document.uri);
}

async function emitLLVM(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const filePath = editor.document.uri.fsPath;
    if (!filePath.endsWith('.aur')) {
        vscode.window.showErrorMessage('Not an AuroraLang file (.aur)');
        return;
    }

    if (editor.document.isDirty) {
        await editor.document.save();
    }

    const outputPath = filePath.replace('.aur', '.ll');

    outputChannel.clear();
    outputChannel.show(true);
    outputChannel.appendLine(`Emitting LLVM IR: ${filePath}\n`);

    const compilerPath = await getCompilerPath();
    const command = `"${compilerPath}" --emit-llvm -o "${outputPath}" "${filePath}"`;
    
    outputChannel.appendLine(`> ${command}\n`);
    
    const result = await runCompiler(filePath, ['--emit-llvm', '-o', outputPath]);

    if (result.stdout) {
        outputChannel.appendLine(result.stdout);
    }
    if (result.stderr) {
        outputChannel.appendLine('Errors:\n' + result.stderr);
    }
    
    outputChannel.appendLine(`\n✓ LLVM IR generated: ${outputPath}`);
    
    const doc = await vscode.workspace.openTextDocument(outputPath);
    await vscode.window.showTextDocument(doc, { preview: false });
}

async function checkCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }
    
    if (editor.document.languageId !== 'aurora') {
        vscode.window.showErrorMessage('Not an AuroraLang file');
        return;
    }
    
    if (editor.document.isDirty) {
        await editor.document.save();
    }
    
    await checkDocument(editor.document);
    vscode.window.showInformationMessage('AuroraLang: Check complete');
}

async function formatCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }
    
    if (editor.document.languageId !== 'aurora') {
        vscode.window.showErrorMessage('Not an AuroraLang file');
        return;
    }
    
    const document = editor.document;
    const formatter = new AuroraFormattingProvider();
    const edits = formatter.provideDocumentFormattingEdits(document, {
        tabSize: 4,
        insertSpaces: true
    }, new vscode.CancellationTokenSource().token);
    
    if (edits && edits.length > 0) {
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(document.uri, edits);
        await vscode.workspace.applyEdit(workspaceEdit);
        vscode.window.showInformationMessage('File formatted successfully');
    }
}

