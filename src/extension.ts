// AuroraLang VSCode Extension - Main Entry Point

import * as vscode from 'vscode';
import { initializeCommands } from './commands/commands';
import { initializeDiagnostics, performAllChecks, checkDocument, diagnosticCollection } from './diagnostics/diagnostics';
import { AuroraCompletionProvider } from './providers/completionProvider';
import { AuroraHoverProvider } from './providers/hoverProvider';
import { AuroraDefinitionProvider } from './providers/definitionProvider';
import { AuroraDocumentSymbolProvider } from './providers/symbolProvider';
import { AuroraSignatureHelpProvider } from './providers/signatureHelpProvider';
import { AuroraFormattingProvider } from './providers/formattingProvider';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('AuroraLang extension is now active!');

    // Initialize output channel
    outputChannel = vscode.window.createOutputChannel('AuroraLang');
    context.subscriptions.push(outputChannel);

    // Initialize diagnostics
    initializeDiagnostics(context);

    // Register commands
    initializeCommands(context, outputChannel);

    // Register language providers
    registerLanguageProviders(context);

    // Setup document listeners
    setupDocumentListeners(context);

    // Check currently open documents
    vscode.workspace.textDocuments.forEach(document => {
        if (document.languageId === 'aurora') {
            performAllChecks(document);
        }
    });

    outputChannel.appendLine('AuroraLang extension activated successfully!');
    outputChannel.appendLine('Features: Syntax highlighting, IntelliSense, Real-time Diagnostics, Formatting');
    outputChannel.appendLine('Semantic analysis: Function calls, type checking, parameter validation');
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}

function registerLanguageProviders(context: vscode.ExtensionContext): void {
    const providers = [
        // Completion provider
        vscode.languages.registerCompletionItemProvider(
            'aurora',
            new AuroraCompletionProvider(),
            '.', ':', '>'
        ),

        // Hover provider
        vscode.languages.registerHoverProvider('aurora', new AuroraHoverProvider()),

        // Definition provider
        vscode.languages.registerDefinitionProvider('aurora', new AuroraDefinitionProvider()),

        // Document symbol provider
        vscode.languages.registerDocumentSymbolProvider('aurora', new AuroraDocumentSymbolProvider()),

        // Signature help provider
        vscode.languages.registerSignatureHelpProvider(
            'aurora',
            new AuroraSignatureHelpProvider(),
            '(', ','
        ),

        // Document formatter
        vscode.languages.registerDocumentFormattingEditProvider(
            'aurora',
            new AuroraFormattingProvider()
        )
    ];

    context.subscriptions.push(...providers);
}

function setupDocumentListeners(context: vscode.ExtensionContext): void {
    // Real-time diagnostics on change (with debounce)
    let timeout: NodeJS.Timeout | undefined = undefined;
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'aurora') {
                if (timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(() => {
                    performAllChecks(event.document);
                }, 300);
            }
        })
    );

    // Diagnostics on save (includes compiler check)
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            if (document.languageId === 'aurora') {
                checkDocument(document);
            }
        })
    );

    // Clear diagnostics on close
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(document => {
            if (document.languageId === 'aurora') {
                diagnosticCollection.delete(document.uri);
            }
        })
    );
}
