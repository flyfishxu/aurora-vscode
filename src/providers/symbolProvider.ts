// Document symbol provider for AuroraLang

import * as vscode from 'vscode';

export class AuroraDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.DocumentSymbol[] {
        const symbols: vscode.DocumentSymbol[] = [];
        const text = document.getText();

        // Find all function definitions
        const functionRegex = /fn\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\w+\??))?\s*\{/g;
        let match;
        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1];
            const params = match[2];
            const returnType = match[3] || 'void';
            
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            
            const range = new vscode.Range(startPos, endPos);
            const selectionRange = new vscode.Range(startPos, document.positionAt(match.index + match[0].length));
            
            const symbol = new vscode.DocumentSymbol(
                functionName,
                `(${params}) -> ${returnType}`,
                vscode.SymbolKind.Function,
                range,
                selectionRange
            );
            
            symbols.push(symbol);
        }

        // Find all extern declarations
        const externRegex = /extern\s+(\w+)\s*\(([^)]*)\)/g;
        while ((match = externRegex.exec(text)) !== null) {
            const functionName = match[1];
            const params = match[2];
            
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            
            const range = new vscode.Range(startPos, endPos);
            const selectionRange = range;
            
            const symbol = new vscode.DocumentSymbol(
                functionName,
                `extern (${params})`,
                vscode.SymbolKind.Interface,
                range,
                selectionRange
            );
            
            symbols.push(symbol);
        }

        // Find all class definitions
        const classRegex = /class\s+(\w+)\s*\{/g;
        while ((match = classRegex.exec(text)) !== null) {
            const className = match[1];
            
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            
            const range = new vscode.Range(startPos, endPos);
            const selectionRange = range;
            
            const symbol = new vscode.DocumentSymbol(
                className,
                'class',
                vscode.SymbolKind.Class,
                range,
                selectionRange
            );
            
            symbols.push(symbol);
        }

        // Find all variables
        const varRegex = /(?:let|var)\s+(\w+)(?:\s*:\s*(\w+\??))?/g;
        while ((match = varRegex.exec(text)) !== null) {
            const varName = match[1];
            const varType = match[2] || 'inferred';
            
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            
            const range = new vscode.Range(startPos, endPos);
            const selectionRange = range;
            
            const symbol = new vscode.DocumentSymbol(
                varName,
                varType,
                vscode.SymbolKind.Variable,
                range,
                selectionRange
            );
            
            symbols.push(symbol);
        }

        return symbols;
    }
}

