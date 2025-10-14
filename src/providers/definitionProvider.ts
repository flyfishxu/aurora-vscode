// Definition provider for AuroraLang

import * as vscode from 'vscode';

export class AuroraDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.Location | null {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return null;
        }

        const word = document.getText(range);
        const text = document.getText();

        // Search for function definition
        const fnRegex = new RegExp(`fn\\s+${word}\\s*\\(`, 'g');
        const fnMatch = fnRegex.exec(text);
        if (fnMatch) {
            const pos = document.positionAt(fnMatch.index);
            return new vscode.Location(document.uri, pos);
        }

        // Search for extern declaration
        const externRegex = new RegExp(`extern\\s+${word}\\s*\\(`, 'g');
        const externMatch = externRegex.exec(text);
        if (externMatch) {
            const pos = document.positionAt(externMatch.index);
            return new vscode.Location(document.uri, pos);
        }

        // Search for class definition
        const classRegex = new RegExp(`class\\s+${word}\\s*\\{`, 'g');
        const classMatch = classRegex.exec(text);
        if (classMatch) {
            const pos = document.positionAt(classMatch.index);
            return new vscode.Location(document.uri, pos);
        }

        return null;
    }
}

