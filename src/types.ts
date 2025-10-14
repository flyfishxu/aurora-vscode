// Type definitions for AuroraLang extension

export interface FunctionSignature {
    name: string;
    params: Parameter[];
    returnType: string;
    line: number;
}

export interface Parameter {
    name: string;
    type: string;
}

export interface Variable {
    name: string;
    type: string;
    isMutable: boolean;
    line: number;
}

export interface ClassInfo {
    name: string;
    fields: Map<string, string>;
    methods: Map<string, FunctionSignature>;
    line: number;
}

