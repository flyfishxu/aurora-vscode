// Signature help provider for AuroraLang

import * as vscode from 'vscode';

export class AuroraSignatureHelpProvider implements vscode.SignatureHelpProvider {
    provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.SignatureHelpContext
    ): vscode.SignatureHelp | null {
        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.substring(0, position.character);
        
        // Find function name before cursor
        const match = textBeforeCursor.match(/(\w+)\s*\([^)]*$/);
        if (!match) {
            return null;
        }
        
        const functionName = match[1];
        const text = document.getText();
        
        // Find function signature
        const fnRegex = new RegExp(`fn\\s+${functionName}\\s*\\(([^)]*)\\)(?:\\s*->\\s*(\\w+\\??))`, 'g');
        const fnMatch = fnRegex.exec(text);
        
        if (fnMatch) {
            const params = fnMatch[1];
            const returnType = fnMatch[2] || 'void';
            
            const signatureHelp = new vscode.SignatureHelp();
            const signature = new vscode.SignatureInformation(
                `${functionName}(${params}) -> ${returnType}`,
                new vscode.MarkdownString(`Function: **${functionName}**`)
            );
            
            const paramList = params.split(',').map(p => p.trim()).filter(p => p);
            paramList.forEach(param => {
                signature.parameters.push(new vscode.ParameterInformation(param));
            });
            
            signatureHelp.signatures = [signature];
            signatureHelp.activeSignature = 0;
            
            const openParen = textBeforeCursor.lastIndexOf('(');
            const commaCount = textBeforeCursor.substring(openParen).split(',').length - 1;
            signatureHelp.activeParameter = commaCount;
            
            return signatureHelp;
        }
        
        // Check for extern functions
        const externRegex = new RegExp(`extern\\s+${functionName}\\s*\\(([^)]*)\\)`, 'g');
        const externMatch = externRegex.exec(text);
        
        if (externMatch) {
            const params = externMatch[1];
            
            const signatureHelp = new vscode.SignatureHelp();
            const signature = new vscode.SignatureInformation(
                `extern ${functionName}(${params})`,
                new vscode.MarkdownString(`External function: **${functionName}**`)
            );
            
            const paramList = params.split(',').map(p => p.trim()).filter(p => p);
            paramList.forEach(param => {
                signature.parameters.push(new vscode.ParameterInformation(param));
            });
            
            signatureHelp.signatures = [signature];
            signatureHelp.activeSignature = 0;
            
            const openParen = textBeforeCursor.lastIndexOf('(');
            const commaCount = textBeforeCursor.substring(openParen).split(',').length - 1;
            signatureHelp.activeParameter = commaCount;
            
            return signatureHelp;
        }
        
        return null;
    }
}

