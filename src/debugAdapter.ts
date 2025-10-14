import {
    LoggingDebugSession,
    InitializedEvent,
    TerminatedEvent,
    StoppedEvent,
    BreakpointEvent,
    OutputEvent,
    Thread,
    StackFrame,
    Scope,
    Source,
    Handles,
    Breakpoint
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    program: string;
    auroraPath?: string;
    stopOnEntry?: boolean;
    trace?: boolean;
}

interface AuroraBreakpoint {
    id: number;
    line: number;
    verified: boolean;
}

export class AuroraDebugSession extends LoggingDebugSession {
    private static THREAD_ID = 1;
    
    private _variableHandles = new Handles<string>();
    private _program!: string;
    private _auroraProcess: ChildProcess | null = null;
    private _breakpoints = new Map<string, AuroraBreakpoint[]>();
    private _sourceFile!: string;
    private _currentLine = 0;
    private _isRunning = false;

    public constructor() {
        super("aurora-debug.txt");
        this.setDebuggerLinesStartAt1(true);
        this.setDebuggerColumnsStartAt1(true);
    }

    protected initializeRequest(
        response: DebugProtocol.InitializeResponse,
        args: DebugProtocol.InitializeRequestArguments
    ): void {
        response.body = response.body || {};

        // Capabilities
        response.body.supportsConfigurationDoneRequest = true;
        response.body.supportsEvaluateForHovers = false;
        response.body.supportsStepBack = false;
        response.body.supportsSetVariable = false;
        response.body.supportsRestartFrame = false;
        response.body.supportsGotoTargetsRequest = false;
        response.body.supportsCompletionsRequest = false;

        this.sendResponse(response);
        this.sendEvent(new InitializedEvent());
    }

    protected configurationDoneRequest(
        response: DebugProtocol.ConfigurationDoneResponse,
        args: DebugProtocol.ConfigurationDoneArguments
    ): void {
        super.configurationDoneRequest(response, args);
        // Start execution
        this._isRunning = true;
    }

    protected async launchRequest(
        response: DebugProtocol.LaunchResponse,
        args: LaunchRequestArguments
    ) {
        this._program = args.program;
        this._sourceFile = args.program;

        if (!fs.existsSync(this._program)) {
            this.sendErrorResponse(
                response,
                1001,
                `Program file '${this._program}' does not exist.`
            );
            return;
        }

        const auroraPath = args.auroraPath || 'aurora';
        
        this.sendEvent(new OutputEvent(`Launching AuroraLang program: ${this._program}\n`));

        try {
            // For now, we'll just run the program without actual debugging
            // A full debugger would need to integrate with LLDB or GDB
            this._auroraProcess = spawn(auroraPath, [this._program], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this._auroraProcess.stdout?.on('data', (data) => {
                this.sendEvent(new OutputEvent(data.toString(), 'stdout'));
            });

            this._auroraProcess.stderr?.on('data', (data) => {
                this.sendEvent(new OutputEvent(data.toString(), 'stderr'));
            });

            this._auroraProcess.on('exit', (code) => {
                this.sendEvent(new OutputEvent(`\nProgram exited with code ${code}\n`));
                this.sendEvent(new TerminatedEvent());
            });

            this._auroraProcess.on('error', (err) => {
                this.sendEvent(new OutputEvent(`Error: ${err.message}\n`, 'stderr'));
                this.sendEvent(new TerminatedEvent());
            });

            if (args.stopOnEntry) {
                this._currentLine = 1;
                this.sendResponse(response);
                this.sendEvent(new StoppedEvent('entry', AuroraDebugSession.THREAD_ID));
            } else {
                this._isRunning = true;
                this.sendResponse(response);
            }
        } catch (error: any) {
            this.sendErrorResponse(
                response,
                1002,
                `Failed to launch program: ${error.message}`
            );
        }
    }

    protected setBreakPointsRequest(
        response: DebugProtocol.SetBreakpointsResponse,
        args: DebugProtocol.SetBreakpointsArguments
    ): void {
        const path = args.source.path as string;
        const clientLines = args.lines || [];

        const breakpoints = clientLines.map(line => {
            const bp: AuroraBreakpoint = {
                id: this._breakpoints.size + 1,
                line: line,
                verified: true // For simplicity, we mark all breakpoints as verified
            };
            return bp;
        });

        this._breakpoints.set(path, breakpoints);

        const actualBreakpoints = breakpoints.map(bp => {
            const dbgBreakpoint = new Breakpoint(bp.verified, bp.line);
            // Set id using Object.defineProperty to avoid TypeScript error
            // The id property exists in the protocol but may not be in the type definition
            (dbgBreakpoint as any).id = bp.id;
            return dbgBreakpoint;
        });

        response.body = {
            breakpoints: actualBreakpoints
        };
        this.sendResponse(response);
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        response.body = {
            threads: [new Thread(AuroraDebugSession.THREAD_ID, "main thread")]
        };
        this.sendResponse(response);
    }

    protected stackTraceRequest(
        response: DebugProtocol.StackTraceResponse,
        args: DebugProtocol.StackTraceArguments
    ): void {
        const frames: StackFrame[] = [];
        
        const frame = new StackFrame(
            0,
            'main',
            new Source(
                path.basename(this._sourceFile),
                this._sourceFile
            ),
            this._currentLine,
            1
        );
        frames.push(frame);

        response.body = {
            stackFrames: frames,
            totalFrames: frames.length
        };
        this.sendResponse(response);
    }

    protected scopesRequest(
        response: DebugProtocol.ScopesResponse,
        args: DebugProtocol.ScopesArguments
    ): void {
        const scopes: Scope[] = [
            new Scope("Local", this._variableHandles.create("local"), false)
        ];

        response.body = {
            scopes: scopes
        };
        this.sendResponse(response);
    }

    protected variablesRequest(
        response: DebugProtocol.VariablesResponse,
        args: DebugProtocol.VariablesArguments
    ): void {
        // For now, return empty variables
        // A full implementation would track variable values during execution
        response.body = {
            variables: []
        };
        this.sendResponse(response);
    }

    protected continueRequest(
        response: DebugProtocol.ContinueResponse,
        args: DebugProtocol.ContinueArguments
    ): void {
        this._isRunning = true;
        this.sendResponse(response);
    }

    protected nextRequest(
        response: DebugProtocol.NextResponse,
        args: DebugProtocol.NextArguments
    ): void {
        this._currentLine++;
        this.sendResponse(response);
        this.sendEvent(new StoppedEvent('step', AuroraDebugSession.THREAD_ID));
    }

    protected stepInRequest(
        response: DebugProtocol.StepInResponse,
        args: DebugProtocol.StepInArguments
    ): void {
        this._currentLine++;
        this.sendResponse(response);
        this.sendEvent(new StoppedEvent('step', AuroraDebugSession.THREAD_ID));
    }

    protected stepOutRequest(
        response: DebugProtocol.StepOutResponse,
        args: DebugProtocol.StepOutArguments
    ): void {
        this._currentLine++;
        this.sendResponse(response);
        this.sendEvent(new StoppedEvent('step', AuroraDebugSession.THREAD_ID));
    }

    protected pauseRequest(
        response: DebugProtocol.PauseResponse,
        args: DebugProtocol.PauseArguments
    ): void {
        this._isRunning = false;
        this.sendResponse(response);
        this.sendEvent(new StoppedEvent('pause', AuroraDebugSession.THREAD_ID));
    }

    protected disconnectRequest(
        response: DebugProtocol.DisconnectResponse,
        args: DebugProtocol.DisconnectArguments
    ): void {
        if (this._auroraProcess) {
            this._auroraProcess.kill();
            this._auroraProcess = null;
        }
        this.sendResponse(response);
    }

    protected terminateRequest(
        response: DebugProtocol.TerminateResponse,
        args: DebugProtocol.TerminateArguments
    ): void {
        if (this._auroraProcess) {
            this._auroraProcess.kill();
            this._auroraProcess = null;
        }
        this.sendResponse(response);
    }
}

// Start the debug adapter when run directly
if (require.main === module) {
    AuroraDebugSession.run(AuroraDebugSession);
}

