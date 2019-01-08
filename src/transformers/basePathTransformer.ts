/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { DebugProtocol } from 'vscode-debugprotocol';

import { IResourceIdentifier } from '../chrome/internal/sources/resourceIdentifier';
import { StackTracePresentation } from '../chrome/internal/stackTraces/stackTracePresentation';
import { IComponent } from '../chrome/internal/features/feature';
import { injectable } from 'inversify';

/**
 * Converts a local path from Code to a path on the target.
 */
@injectable()
export class BasePathTransformer implements IComponent {
    public async install(): Promise<void> {
    }

    public clearTargetContext(): void {
    }

    public scriptParsed(scriptPath: IResourceIdentifier): Promise<IResourceIdentifier> {
        return Promise.resolve(scriptPath);
    }

    public breakpointResolved(_bp: DebugProtocol.Breakpoint, targetPath: IResourceIdentifier): IResourceIdentifier {
        return this.getClientPathFromTargetPath(targetPath) || targetPath;
    }

    public stackTraceResponse(_response: StackTracePresentation): void {
    }

    public async fixSource(_source: DebugProtocol.Source): Promise<void> {
    }

    public getTargetPathFromClientPath(clientPath: IResourceIdentifier): IResourceIdentifier {
        return clientPath;
    }

    public getClientPathFromTargetPath(targetPath: IResourceIdentifier): IResourceIdentifier {
        return targetPath;
    }
}
