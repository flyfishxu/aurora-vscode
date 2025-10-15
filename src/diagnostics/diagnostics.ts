// Diagnostic utilities for AuroraLang

import * as vscode from 'vscode';
import { SemanticAnalyzer } from '../semantics/analyzer';
import { parseCompilerOutput, runCompiler } from '../utils/compiler';

export let diagnosticCollection: vscode.DiagnosticCollection;

export function initializeDiagnostics(context: vscode.ExtensionContext): void {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('aurora');
    context.subscriptions.push(diagnosticCollection);
}

// Perform all checks (syntax + semantic)
export function performAllChecks(document: vscode.TextDocument): void {
    const diagnostics: vscode.Diagnostic[] = [];

    // 1. Bracket matching
    diagnostics.push(...checkBracketMatching(document));

    // 2. Semantic analysis (function calls, types, parameters)
    const analyzer = new SemanticAnalyzer();
    diagnostics.push(...analyzer.analyze(document));

    // 3. Common syntax issues
    diagnostics.push(...checkCommonSyntaxIssues(document));

    diagnosticCollection.set(document.uri, diagnostics);
}

// Check for matching brackets, braces, and parentheses
function checkBracketMatching(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');
    const stack: { char: string; pos: vscode.Position; line: string }[] = [];
    
    const pairs: { [key: string]: string } = {
        '(': ')',
        '{': '}',
        '[': ']'
    };
    const opening = Object.keys(pairs);
    const closing = Object.values(pairs);

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        let inString = false;
        let inComment = false;
        
        for (let charNum = 0; charNum < line.length; charNum++) {
            const char = line[charNum];
            const prevChar = charNum > 0 ? line[charNum - 1] : '';
            
            if (char === '"' && prevChar !== '\\') {
                inString = !inString;
                continue;
            }
            
            if (char === '#' && !inString) {
                inComment = true;
                break;
            }
            
            if (inString || inComment) continue;
            
            if (opening.includes(char)) {
                stack.push({
                    char: char,
                    pos: new vscode.Position(lineNum, charNum),
                    line: line.trim()
                });
            } else if (closing.includes(char)) {
                if (stack.length === 0) {
                    const range = new vscode.Range(lineNum, charNum, lineNum, charNum + 1);
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `Unexpected closing '${char}' - no matching opening bracket`,
                        vscode.DiagnosticSeverity.Error
                    ));
                } else {
                    const last = stack[stack.length - 1];
                    const expectedClosing = pairs[last.char];
                    
                    if (char === expectedClosing) {
                        stack.pop();
                    } else {
                        const range = new vscode.Range(lineNum, charNum, lineNum, charNum + 1);
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            `Mismatched bracket: expected '${expectedClosing}' but found '${char}' (to match '${last.char}' at line ${last.pos.line + 1})`,
                            vscode.DiagnosticSeverity.Error
                        );
                        diagnostic.relatedInformation = [
                            new vscode.DiagnosticRelatedInformation(
                                new vscode.Location(document.uri, last.pos),
                                `Opening '${last.char}' here`
                            )
                        ];
                        diagnostics.push(diagnostic);
                        stack.pop();
                    }
                }
            }
        }
    }
    
    for (const unclosed of stack) {
        const range = new vscode.Range(unclosed.pos, unclosed.pos.translate(0, 1));
        const expectedClosing = pairs[unclosed.char];
        diagnostics.push(new vscode.Diagnostic(
            range,
            `Unclosed '${unclosed.char}' - expected '${expectedClosing}' before end of file`,
            vscode.DiagnosticSeverity.Error
        ));
    }
    
    return diagnostics;
}

// Check for common syntax issues
function checkCommonSyntaxIssues(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const lines = document.getText().split('\n');
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        const trimmed = line.trim();
        
        if (trimmed.startsWith('#') || trimmed === '') continue;
        
        // Function definition missing opening brace
        if (trimmed.match(/^fn\s+\w+\s*\([^)]*\)(?:\s*->\s*\w+\??)?\s*$/) && !trimmed.endsWith('{')) {
            const range = new vscode.Range(lineNum, 0, lineNum, line.length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                "Function definition missing opening '{' brace",
                vscode.DiagnosticSeverity.Error
            ));
        }
        
        // Constructor definition missing opening brace
        if (trimmed.match(/^constructor\s*\([^)]*\)\s*$/) && !trimmed.endsWith('{')) {
            const range = new vscode.Range(lineNum, 0, lineNum, line.length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                "Constructor definition missing opening '{' brace",
                vscode.DiagnosticSeverity.Error
            ));
        }
        
        // Class definition missing opening brace
        if (trimmed.match(/^class\s+\w+\s*(?:\([^)]*\))?\s*$/) && !trimmed.endsWith('{')) {
            const range = new vscode.Range(lineNum, 0, lineNum, line.length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                "Class definition missing opening '{' brace",
                vscode.DiagnosticSeverity.Error
            ));
        }
        
        // Check for camelCase naming convention
        const camelCaseRegex = /\b[a-z][a-zA-Z0-9]*\b/g;
        const snakeCaseRegex = /\b[a-z]+(_[a-z]+)+\b/g;
        let match;
        
        // Warn about snake_case in favor of camelCase
        while ((match = snakeCaseRegex.exec(line)) !== null) {
            const range = new vscode.Range(lineNum, match.index, lineNum, match.index + match[0].length);
            const diagnostic = new vscode.Diagnostic(
                range,
                "Consider using camelCase instead of snake_case for better AuroraLang style",
                vscode.DiagnosticSeverity.Hint
            );
            diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
            diagnostics.push(diagnostic);
        }
        
        // Optional semicolons (informational)
        if (trimmed.endsWith(';') && !trimmed.startsWith('extern')) {
            const semiPos = line.lastIndexOf(';');
            const range = new vscode.Range(lineNum, semiPos, lineNum, semiPos + 1);
            const diagnostic = new vscode.Diagnostic(
                range,
                'Semicolons are optional in AuroraLang',
                vscode.DiagnosticSeverity.Hint
            );
            diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
            diagnostics.push(diagnostic);
        }
    }
    
    // Check for unnecessary 'pub' modifiers in class members
    diagnostics.push(...checkUnnecessaryAccessModifiers(lines));
    
    return diagnostics;
}

// Check for unnecessary access modifiers (class members are public by default)
function checkUnnecessaryAccessModifiers(lines: string[]): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    let inClass = false;
    let braceDepth = 0;
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        const trimmed = line.trim();
        
        if (trimmed.startsWith('#') || trimmed === '') continue;
        
        // Track class scope
        if (trimmed.match(/^class\s+\w+/)) {
            inClass = true;
        }
        
        // Track braces
        for (const char of line) {
            if (char === '{') braceDepth++;
            else if (char === '}') {
                braceDepth--;
                if (braceDepth === 0 && inClass) {
                    inClass = false;
                }
            }
        }
        
        // Check for pub modifier in class members
        if (inClass && trimmed.match(/^pub\s+(let|var|fn|constructor|static)/)) {
            const pubIndex = line.indexOf('pub');
            const range = new vscode.Range(lineNum, pubIndex, lineNum, pubIndex + 3);
            const diagnostic = new vscode.Diagnostic(
                range,
                "Class members are public by default. The 'pub' modifier is unnecessary.",
                vscode.DiagnosticSeverity.Hint
            );
            diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
            diagnostics.push(diagnostic);
        }
    }
    
    return diagnostics;
}

// Check document for errors (using compiler)
export async function checkDocument(document: vscode.TextDocument): Promise<void> {
    const filePath = document.uri.fsPath;
    
    // Start with all checks
    performAllChecks(document);
    
    // Then run compiler for more detailed errors
    const result = await runCompiler(filePath);
    const output = result.stderr || result.stdout;
    const compilerDiagnostics = parseCompilerOutput(output, document);
    
    // Merge with existing checks
    const existingDiagnostics = diagnosticCollection.get(document.uri) || [];
    const allDiagnostics = [...existingDiagnostics, ...compilerDiagnostics];
    diagnosticCollection.set(document.uri, allDiagnostics);
}

