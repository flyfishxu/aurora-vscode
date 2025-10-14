// Compiler utilities

import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function getCompilerPath(): Promise<string> {
    const config = vscode.workspace.getConfiguration('auroralang');
    let compilerPath = config.get<string>('compilerPath', 'aurora');
    
    if (compilerPath === 'aurora') {
        const buildPath = config.get<string>('buildPath', '${workspaceFolder}/build');
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const resolvedBuildPath = buildPath.replace('${workspaceFolder}', workspaceFolder);
            const localCompilerPath = path.join(resolvedBuildPath, 'aurora');
            
            try {
                await execAsync(`test -f "${localCompilerPath}"`);
                compilerPath = localCompilerPath;
            } catch {
                // Fall back to 'aurora' in PATH
            }
        }
    }
    
    return compilerPath;
}

export async function runCompiler(filePath: string, args: string[] = []): Promise<{ stdout: string; stderr: string }> {
    const compilerPath = await getCompilerPath();
    const command = `"${compilerPath}" ${args.join(' ')} "${filePath}"`;
    
    try {
        return await execAsync(command, {
            cwd: path.dirname(filePath)
        });
    } catch (error: any) {
        return {
            stdout: error.stdout || '',
            stderr: error.stderr || error.message || ''
        };
    }
}

export function parseCompilerOutput(output: string, document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    
    // Match Aurora's error format:
    // Error[E0001]: Expected parameter name (got '{')
    //   --> <source>:9:10
    const errorRegex = /(\w+)\[(\w+)\]:\s*(.+)\n\s*-->\s*[^:]+:(\d+):(\d+)/g;
    let match;
    
    while ((match = errorRegex.exec(output)) !== null) {
        const severity = match[1];
        const code = match[2];
        const message = match[3];
        const line = parseInt(match[4]) - 1;
        const column = parseInt(match[5]) - 1;
        
        if (line < 0 || line >= document.lineCount) continue;
        
        let diagnosticSeverity = vscode.DiagnosticSeverity.Error;
        if (severity.toLowerCase() === 'warning') {
            diagnosticSeverity = vscode.DiagnosticSeverity.Warning;
        } else if (severity.toLowerCase() === 'note') {
            diagnosticSeverity = vscode.DiagnosticSeverity.Information;
        }
        
        const lineText = document.lineAt(line);
        const range = new vscode.Range(
            line,
            Math.min(column, lineText.range.end.character),
            line,
            Math.min(column + 5, lineText.range.end.character)
        );
        
        const diagnostic = new vscode.Diagnostic(
            range,
            message,
            diagnosticSeverity
        );
        diagnostic.source = 'auroralang-compiler';
        diagnostic.code = code;
        diagnostics.push(diagnostic);
    }
    
    return diagnostics;
}

