import { IComponent } from '../features/feature';
import { Protocol as CDTP } from 'devtools-protocol';

import { injectable } from 'inversify';

export interface SupportedDomainsDependencies {
    getTargetDebuggerDomainsSchemas(): Promise<CDTP.Schema.Domain[]>;
}

export interface ISupportedDomains {
    isSupported(domainName: string): boolean;
}

@injectable()
export class SupportedDomains implements IComponent, ISupportedDomains {
    private readonly _domains = new Map<string, CDTP.Schema.Domain>();

    public isSupported(domainName: string): boolean {
        return this._domains.has(domainName);
    }

    public async install(): Promise<this> {
        await this.initSupportedDomains();
        return this;
    }

    private async initSupportedDomains(): Promise<void> {
        try {
            const domains = await this._dependencies.getTargetDebuggerDomainsSchemas();
            domains.forEach(domain => this._domains.set(domain.name, domain));
        } catch (e) {
            // If getDomains isn't supported for some reason, skip this
        }
    }

    constructor(private readonly _dependencies: SupportedDomainsDependencies) { }
}