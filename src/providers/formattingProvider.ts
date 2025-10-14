// Formatting provider for AuroraLang

import * as vscode from 'vscode';

export class AuroraFormattingProvider implements vscode.DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        let indentLevel = 0;
        const indentString = options.insertSpaces 
            ? ' '.repeat(options.tabSize) 
            : '\t';
        
        const formattedLines: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (line === '' || line.startsWith('#')) {
                formattedLines.push(line);
                continue;
            }
            
            if (line.startsWith('}')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            if (line.endsWith(';') && !line.startsWith('extern')) {
                line = line.slice(0, -1);
            }
            
            const indentedLine = indentString.repeat(indentLevel) + line;
            formattedLines.push(indentedLine);
            
            if (line.endsWith('{')) {
                indentLevel++;
            }
        }
        
        const formattedText = formattedLines.join('\n');
        
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
        );
        
        edits.push(vscode.TextEdit.replace(fullRange, formattedText));
        
        return edits;
    }
}

