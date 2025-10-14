// Semantic analyzer for AuroraLang

import * as vscode from 'vscode';
import { FunctionSignature, ClassInfo, Variable } from '../types';
import { parseParameters, parseArguments } from '../utils/parser';
import { inferType, isTypeCompatible } from '../utils/typeInference';

export class SemanticAnalyzer {
    private functions: Map<string, FunctionSignature> = new Map();
    private classes: Map<string, ClassInfo> = new Map();

    constructor() {
        // Add built-in functions
        this.functions.set('printd', {
            name: 'printd',
            params: [{ name: 'x', type: 'double' }],
            returnType: 'double',
            line: 0
        });
    }

    analyze(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        // First pass: collect function signatures and class definitions
        this.collectSymbols(lines, document, diagnostics);

        // Second pass: check function calls, types, and semantics
        this.checkSemantics(lines, document, diagnostics);

        // Third pass: check function return types
        this.checkFunctionReturns(text, document, diagnostics);

        return diagnostics;
    }

    private collectSymbols(lines: string[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum].trim();
            
            if (line.startsWith('#') || line === '') continue;

            // Parse extern functions
            const externMatch = line.match(/^extern\s+(\w+)\s*\(([^)]*)\)/);
            if (externMatch) {
                const funcName = externMatch[1];
                const paramsStr = externMatch[2];
                const params = parseParameters(paramsStr);
                
                this.functions.set(funcName, {
                    name: funcName,
                    params: params,
                    returnType: 'double',
                    line: lineNum
                });
                continue;
            }

            // Parse function definitions
            const funcMatch = line.match(/^fn\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\w+\??))?\s*\{?/);
            if (funcMatch) {
                const funcName = funcMatch[1];
                const paramsStr = funcMatch[2];
                const returnType = funcMatch[3] || 'void';
                const params = parseParameters(paramsStr);
                
                if (this.functions.has(funcName) && this.functions.get(funcName)!.line > 0) {
                    const range = new vscode.Range(lineNum, 0, lineNum, line.length);
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `Function '${funcName}' is already defined at line ${this.functions.get(funcName)!.line + 1}`,
                        vscode.DiagnosticSeverity.Error
                    ));
                } else {
                    this.functions.set(funcName, {
                        name: funcName,
                        params: params,
                        returnType: returnType,
                        line: lineNum
                    });
                }
            }

            // Parse class definitions
            this.collectClassDefinition(lines, lineNum, diagnostics);
        }
    }

    private collectClassDefinition(lines: string[], startLine: number, diagnostics: vscode.Diagnostic[]): void {
        const line = lines[startLine].trim();
        const classMatch = line.match(/^class\s+(\w+)/);
        if (!classMatch) return;

        const className = classMatch[1];
        const classInfo: ClassInfo = {
            name: className,
            fields: new Map(),
            methods: new Map(),
            line: startLine
        };
        
        let braceDepth = 0;
        let inClass = false;
        
        for (let i = startLine; i < lines.length; i++) {
            const classLine = lines[i].trim();
            
            for (const char of classLine) {
                if (char === '{') {
                    braceDepth++;
                    inClass = true;
                } else if (char === '}') {
                    braceDepth--;
                    if (braceDepth === 0) {
                        inClass = false;
                        break;
                    }
                }
            }
            
            if (!inClass && braceDepth === 0 && i > startLine) break;
            if (!inClass) continue;
            
            const fieldMatch = classLine.match(/^let\s+(\w+)\s*:\s*(\w+\??)/);
            if (fieldMatch) {
                classInfo.fields.set(fieldMatch[1], fieldMatch[2]);
            }
            
            const methodMatch = classLine.match(/^fn\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\w+\??))?/);
            if (methodMatch) {
                const methodName = methodMatch[1];
                const params = parseParameters(methodMatch[2]);
                const returnType = methodMatch[3] || 'double';
                classInfo.methods.set(methodName, {
                    name: methodName,
                    params: params,
                    returnType: returnType,
                    line: i
                });
            }
            
            const constructorMatch = classLine.match(/^constructor\s*\(([^)]*)\)/);
            if (constructorMatch) {
                const params = parseParameters(constructorMatch[1]);
                classInfo.methods.set('constructor', {
                    name: 'constructor',
                    params: params,
                    returnType: className,
                    line: i
                });
            }
        }
        
        this.classes.set(className, classInfo);
    }

    private checkSemantics(lines: string[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        const scopeStack: Map<string, Variable>[] = [new Map()];
        let braceDepth = 0;
        const functionDepths: Set<number> = new Set();

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            const trimmed = line.trim();
            
            if (trimmed.startsWith('#') || trimmed === '') continue;

            const funcMatch = trimmed.match(/^fn\s+\w+\s*\([^)]*\)(?:\s*->\s*\w+\??)?\s*\{/);
            if (funcMatch) {
                scopeStack.push(new Map());
                functionDepths.add(braceDepth + 1);
            }

            // Track braces for scope management
            this.trackScopes(line, scopeStack, funcMatch, braceDepth, functionDepths);
            
            // Update brace depth after tracking
            for (const char of line) {
                if (char === '{') braceDepth++;
                else if (char === '}') braceDepth--;
            }

            this.checkFunctionCalls(line, lineNum, document, diagnostics);
            this.checkVariableDeclarations(line, lineNum, scopeStack, document, diagnostics);
            this.checkVariableAssignments(line, lineNum, scopeStack, document, diagnostics);
            this.checkTypeMismatches(line, lineNum, document, diagnostics);
        }
    }

    private trackScopes(line: string, scopeStack: Map<string, Variable>[], funcMatch: RegExpMatchArray | null, braceDepth: number, functionDepths: Set<number>): void {
        let inString = false;
        let inComment = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const prevChar = i > 0 ? line[i - 1] : '';
            
            if (char === '"' && prevChar !== '\\') {
                inString = !inString;
                continue;
            }
            
            if (char === '#' && !inString) {
                inComment = true;
                break;
            }
            
            if (inString || inComment) continue;
            
            if (char === '{' && !funcMatch) {
                scopeStack.push(new Map());
            } else if (char === '}') {
                if (scopeStack.length > 1) {
                    scopeStack.pop();
                }
                functionDepths.delete(braceDepth);
            }
        }
    }

    private checkFunctionCalls(line: string, lineNum: number, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        const funcCallRegex = /(\w+)\s*\(([^)]*)\)/g;
        let match;

        while ((match = funcCallRegex.exec(line)) !== null) {
            const funcName = match[1];
            const argsStr = match[2];
            const startCol = match.index;

            const beforeMatch = line.substring(0, startCol).trimEnd();
            if (beforeMatch.endsWith('new')) {
                this.checkConstructorCall(funcName, argsStr, lineNum, startCol, match, diagnostics);
                continue;
            }

            if (funcName === 'constructor') continue;

            if (!this.functions.has(funcName)) {
                const keywords = ['if', 'while', 'for', 'loop', 'match'];
                if (keywords.includes(funcName)) continue;

                const methodCallMatch = line.substring(Math.max(0, startCol - 10), startCol).match(/(\w+|this)\s*\.\s*$/);
                if (methodCallMatch) continue;

                const range = new vscode.Range(lineNum, startCol, lineNum, startCol + funcName.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Undefined function '${funcName}'`,
                    vscode.DiagnosticSeverity.Error
                ));
                continue;
            }

            const funcSig = this.functions.get(funcName)!;
            const args = parseArguments(argsStr);
            
            if (args.length !== funcSig.params.length) {
                const range = new vscode.Range(lineNum, startCol, lineNum, match.index + match[0].length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Function '${funcName}' expects ${funcSig.params.length} argument(s), but got ${args.length}`,
                    vscode.DiagnosticSeverity.Error
                ));
            }

            this.checkArgumentTypes(funcName, args, argsStr, funcSig, lineNum, startCol, diagnostics);
        }
    }

    private checkConstructorCall(funcName: string, argsStr: string, lineNum: number, startCol: number, match: RegExpExecArray, diagnostics: vscode.Diagnostic[]): void {
        if (!this.classes.has(funcName)) {
            const range = new vscode.Range(lineNum, startCol, lineNum, startCol + funcName.length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Undefined class '${funcName}'`,
                vscode.DiagnosticSeverity.Error
            ));
            return;
        }
        
        const classInfo = this.classes.get(funcName)!;
        const constructor = classInfo.methods.get('constructor');
        
        if (constructor) {
            const args = parseArguments(argsStr);
            if (args.length !== constructor.params.length) {
                const range = new vscode.Range(lineNum, startCol, lineNum, match.index + match[0].length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Constructor of class '${funcName}' expects ${constructor.params.length} argument(s), but got ${args.length}`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
            
            this.checkArgumentTypes(funcName, args, argsStr, constructor, lineNum, startCol, diagnostics);
        }
    }

    private checkArgumentTypes(funcName: string, args: string[], argsStr: string, funcSig: FunctionSignature, lineNum: number, startCol: number, diagnostics: vscode.Diagnostic[]): void {
        for (let i = 0; i < Math.min(args.length, funcSig.params.length); i++) {
            const argType = inferType(args[i]);
            const paramType = funcSig.params[i].type;
            
            if (!isTypeCompatible(argType, paramType)) {
                const argStart = argsStr.indexOf(args[i]);
                const range = new vscode.Range(
                    lineNum,
                    startCol + 1 + argStart,
                    lineNum,
                    startCol + 1 + argStart + args[i].length
                );
                
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Type mismatch: expected '${paramType}', got '${argType}'`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }
    }

    private checkVariableDeclarations(line: string, lineNum: number, scopeStack: Map<string, Variable>[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        const declMatch = line.match(/(let|var)\s+(\w+)(?:\s*:\s*(\w+\??))?(?:\s*=\s*(.+))?/);
        if (!declMatch) return;

        const isMutable = declMatch[1] === 'var';
        const varName = declMatch[2];
        const declaredType = declMatch[3];
        const initializer = declMatch[4];

        const currentScope = scopeStack[scopeStack.length - 1];
        
        if (currentScope.has(varName)) {
            const existingVar = currentScope.get(varName)!;
            const col = line.indexOf(varName);
            const range = new vscode.Range(lineNum, col, lineNum, col + varName.length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Variable '${varName}' is already declared at line ${existingVar.line + 1}`,
                vscode.DiagnosticSeverity.Error
            ));
            return;
        }

        let varType = declaredType || 'double';
        if (!declaredType && initializer) {
            varType = inferType(initializer);
        }

        if (declaredType && initializer) {
            const initType = inferType(initializer);
            if (!isTypeCompatible(initType, declaredType)) {
                const col = line.indexOf(varName);
                const range = new vscode.Range(lineNum, col, lineNum, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Type mismatch: cannot assign '${initType}' to '${declaredType}'`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }

        currentScope.set(varName, {
            name: varName,
            type: varType,
            isMutable: isMutable,
            line: lineNum
        });
    }

    private checkVariableAssignments(line: string, lineNum: number, scopeStack: Map<string, Variable>[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        const assignMatch = line.match(/^(\w+)\s*=\s*(.+)/);
        if (!assignMatch) return;

        const varName = assignMatch[1];
        
        let variable: Variable | undefined = undefined;
        for (let i = scopeStack.length - 1; i >= 0; i--) {
            if (scopeStack[i].has(varName)) {
                variable = scopeStack[i].get(varName);
                break;
            }
        }
        
        if (!variable) {
            const col = line.indexOf(varName);
            const range = new vscode.Range(lineNum, col, lineNum, col + varName.length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Undefined variable '${varName}'`,
                vscode.DiagnosticSeverity.Error
            ));
            return;
        }
        
        if (!variable.isMutable) {
            const col = line.indexOf(varName);
            const range = new vscode.Range(lineNum, col, lineNum, col + varName.length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Cannot assign to immutable variable '${varName}'. Declared with 'let' at line ${variable.line + 1}. Use 'var' for mutable variables.`,
                vscode.DiagnosticSeverity.Error
            ));
        }
    }

    private checkTypeMismatches(line: string, lineNum: number, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        const stringOpMatch = line.match(/"[^"]*"\s*([+\-*\/])\s*(\d+|true|false)/);
        if (stringOpMatch) {
            const col = line.indexOf(stringOpMatch[0]);
            const range = new vscode.Range(lineNum, col, lineNum, col + stringOpMatch[0].length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Cannot perform arithmetic operation '${stringOpMatch[1]}' on string and number`,
                vscode.DiagnosticSeverity.Error
            ));
        }
    }

    private checkFunctionReturns(text: string, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        const functionRegex = /fn\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\w+\??))?\s*\{/g;
        let match;

        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1];
            const returnType = match[3] || 'void';
            const functionStartIndex = match.index;
            const functionStartPos = document.positionAt(functionStartIndex);

            const functionBody = this.extractFunctionBody(text, match.index + match[0].length - 1);
            const returnRegex = /\breturn\b/g;
            const returnMatches = [];
            let returnMatch;

            while ((returnMatch = returnRegex.exec(functionBody)) !== null) {
                const returnIndex = match.index + match[0].length - 1 + returnMatch.index;
                const returnPos = document.positionAt(returnIndex);
                const lineText = document.lineAt(returnPos.line).text;
                const returnStatement = lineText.trim();

                const hasReturnValue = /\breturn\s+[^;\s}]+/.test(returnStatement);

                if (returnType === 'void') {
                    if (hasReturnValue) {
                        const range = new vscode.Range(returnPos.line, lineText.indexOf('return'), returnPos.line, lineText.length);
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `Cannot return a value from a void function '${functionName}'`,
                            vscode.DiagnosticSeverity.Error
                        ));
                    }
                } else {
                    if (!hasReturnValue && returnStatement.startsWith('return')) {
                        const range = new vscode.Range(returnPos.line, lineText.indexOf('return'), returnPos.line, lineText.indexOf('return') + 6);
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `Cannot use empty return in non-void function '${functionName}'. Expected return type: '${returnType}'`,
                            vscode.DiagnosticSeverity.Error
                        ));
                    }
                }

                returnMatches.push(returnPos);
            }

            if (returnType !== 'void' && returnMatches.length === 0) {
                const range = new vscode.Range(functionStartPos.line, 0, functionStartPos.line, match[0].length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Function '${functionName}' with return type '${returnType}' should have at least one return statement`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }
    }

    private extractFunctionBody(text: string, bodyStartIndex: number): string {
        let braceDepth = 0;
        let bodyEndIndex = bodyStartIndex;
        let inString = false;
        let inComment = false;

        for (let i = bodyStartIndex; i < text.length; i++) {
            const char = text[i];
            const prevChar = i > 0 ? text[i - 1] : '';

            if (char === '"' && prevChar !== '\\') {
                inString = !inString;
                continue;
            }

            if (char === '#' && !inString) {
                inComment = true;
            }
            if (char === '\n' && inComment) {
                inComment = false;
                continue;
            }

            if (inString || inComment) continue;

            if (char === '{') {
                braceDepth++;
            } else if (char === '}') {
                braceDepth--;
                if (braceDepth === 0) {
                    bodyEndIndex = i;
                    break;
                }
            }
        }

        return text.substring(bodyStartIndex, bodyEndIndex + 1);
    }
}

