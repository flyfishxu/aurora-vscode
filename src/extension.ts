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
import { activateLSP, deactivateLSP, isLSPActive } from './lspClient';

let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
    console.log('AuroraLang extension is now active!');

    // Initialize output channel
    outputChannel = vscode.window.createOutputChannel('AuroraLang');
    context.subscriptions.push(outputChannel);

    // Try to activate LSP first
    await activateLSP(context);

    // If LSP is not active, use simplified fallback providers
    if (!isLSPActive()) {
        outputChannel.appendLine('LSP not available, using fallback providers');
        outputChannel.appendLine('Note: Fallback mode provides basic syntax highlighting only');
        outputChannel.appendLine('For full features, build and configure aurora-lsp server');
        
        // Only basic diagnostics in fallback mode
        initializeDiagnostics(context);
        
        // Simplified fallback providers (basic completion only)
        registerFallbackProviders(context);
        
        // Basic document listeners
        setupDocumentListeners(context);
    }

    // Register commands (always needed)
    initializeCommands(context, outputChannel);

    outputChannel.appendLine('AuroraLang extension activated successfully!');
    outputChannel.appendLine('Features: Syntax highlighting, IntelliSense, Real-time Diagnostics, Formatting');
    if (isLSPActive()) {
        outputChannel.appendLine('LSP Mode: Using Aurora Language Server for enhanced language features');
    } else {
        outputChannel.appendLine('Fallback Mode: Using built-in providers');
    }
}

export async function deactivate() {
    await deactivateLSP();
    
    if (outputChannel) {
        outputChannel.dispose();
    }
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}

// Simplified fallback providers (only basic features when LSP unavailable)
function registerFallbackProviders(context: vscode.ExtensionContext): void {
    const providers = [
        // Basic keyword completion only
        vscode.languages.registerCompletionItemProvider(
            'aurora',
            new AuroraCompletionProvider(),
            '.'
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
