// LSP Client for AuroraLang

import * as path from 'path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    Executable
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export async function activateLSP(context: vscode.ExtensionContext): Promise<void> {
    // Check if LSP is enabled
    const config = vscode.workspace.getConfiguration('auroralang');
    const enableLSP = config.get<boolean>('enableLSP', true);
    
    if (!enableLSP) {
        return;
    }
    
    const outputChannel = vscode.window.createOutputChannel('AuroraLang LSP');
    
    try {
        // Get LSP server path
        const serverPath = await getServerPath();
        
        if (!serverPath) {
            vscode.window.showWarningMessage(
                'Aurora LSP server not found. Language features will be limited.'
            );
            outputChannel.appendLine('LSP server not found. Using fallback providers.');
            return;
        }
        
        // Server executable options
        const serverExecutable: Executable = {
            command: serverPath,
            args: ['--stdio'],
            transport: TransportKind.stdio
        };
        
        const serverOptions: ServerOptions = serverExecutable;
        
        // Client options
        const clientOptions: LanguageClientOptions = {
            documentSelector: [{ scheme: 'file', language: 'aurora' }],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/*.aur')
            },
            outputChannel: outputChannel
        };
        
        // Create and start client
        client = new LanguageClient(
            'auroraLSP',
            'Aurora Language Server',
            serverOptions,
            clientOptions
        );
        
        await client.start();
        
        outputChannel.appendLine('Aurora LSP server started successfully');
        
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine('Failed to start LSP server: ' + message);
        vscode.window.showErrorMessage('Failed to start Aurora LSP server: ' + message);
    }
}

export async function deactivateLSP(): Promise<void> {
    if (client) {
        await client.stop();
        client = undefined;
    }
}

async function getServerPath(): Promise<string | undefined> {
    // Check if user configured a custom path
    const config = vscode.workspace.getConfiguration('auroralang');
    const customPath = config.get<string>('lspServerPath');
    
    if (customPath && await fileExists(customPath)) {
        return customPath;
    }
    
    // Try multiple locations
    const possiblePaths = [
        // From workspace build directory
        path.join(vscode.workspace.rootPath || '', 'build', 'tools', 'aurora-lsp', 'aurora-lsp'),
        path.join(vscode.workspace.rootPath || '', 'build', 'aurora-lsp'),
        // System installation
        'aurora-lsp',
        // macOS specific
        '/usr/local/bin/aurora-lsp',
        '/opt/homebrew/bin/aurora-lsp'
    ];
    
    for (const serverPath of possiblePaths) {
        if (await fileExists(serverPath)) {
            return serverPath;
        }
    }
    
    // Try to find in PATH
    try {
        const { execSync } = require('child_process');
        const result = execSync('which aurora-lsp', { encoding: 'utf-8' }).trim();
        if (result && await fileExists(result)) {
            return result;
        }
    } catch (e) {
        // Ignore
    }
    
    return undefined;
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
        return true;
    } catch {
        return false;
    }
}

export function isLSPActive(): boolean {
    return client !== undefined && client.isRunning();
}

