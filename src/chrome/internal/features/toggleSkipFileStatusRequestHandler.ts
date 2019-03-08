import { ICommandHandlerDeclaration, CommandHandlerDeclaration, ICommandHandlerDeclarer } from './components';
import { SkipFilesLogic } from './skipFiles';
import { injectable, inject } from 'inversify';
import { ClientSourceParser } from '../../client/clientSourceParser';
import { HandlesRegistry } from '../../client/handlesRegistry';
import { SourcesRetriever } from '../sources/sourcesRetriever';
import { IToggleSkipFileStatusArgs } from '../../../debugAdapterInterfaces';

@injectable()
export class ToggleSkipFileStatusRequestHandler implements ICommandHandlerDeclarer {
    private readonly _clientSourceParser = new ClientSourceParser(this._handlesRegistry, this._sourcesLogic);

    public constructor(
        @inject(SkipFilesLogic) public readonly _skipFilesLogic: SkipFilesLogic,
        @inject(HandlesRegistry) private readonly _handlesRegistry: HandlesRegistry,
        private readonly _sourcesLogic: SourcesRetriever) { }

    public getCommandHandlerDeclarations(): ICommandHandlerDeclaration[] {
        return CommandHandlerDeclaration.fromLiteralObject({
            toggleSkipFileStatus: (args: IToggleSkipFileStatusArgs) => this.toggleSkipFileStatus(args),
        });
    }

    private toggleSkipFileStatus(args: IToggleSkipFileStatusArgs): unknown {
        const source = this._clientSourceParser.toSource(args);
        return this._skipFilesLogic.toggleSkipFileStatus(source);
    }
}