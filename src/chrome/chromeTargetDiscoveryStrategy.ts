/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as logger from '../logger';
import * as utils from '../utils';

import * as chromeUtils from './chromeUtils';
import * as Chrome from './chromeDebugProtocol';

import {ITargetDiscoveryStrategy, ITargetFilter} from './chromeConnection';

export const getChromeTargetWebSocketURL: ITargetDiscoveryStrategy = (address: string, port: number, targetFilter?: ITargetFilter, targetUrl?: string): Promise<string> => {
    // Take the custom targetFilter, default to taking all targets
    targetFilter = targetFilter || (target => true);

    return _getTargets(address, port, targetFilter).then(targets => {
        const target = _selectTarget(targets, targetUrl);
        const wsUrl = target.webSocketDebuggerUrl;
        logger.verbose(`WebSocket Url: ${wsUrl}`);
        return wsUrl;
    });
};

function _getTargets(address: string, port: number, targetFilter: ITargetFilter): Promise<Chrome.ITarget[]> {
    const url = `http://${address}:${port}/json`;
    logger.log(`Discovering targets via ${url}`);
    return utils.getURL(url).then(jsonResponse => {
        try {
            const responseArray = JSON.parse(jsonResponse);
            if (Array.isArray(responseArray)) {
                // Filter out some targets as specified by the extension
                return responseArray.filter(targetFilter);
            }
        } catch (e) {
            // JSON.parse can throw
        }

        return utils.errP(`Response from the target seems invalid: ${jsonResponse}`);
    },
    e => {
        return utils.errP('Cannot connect to the target: ' + e.message);
    });
}

function _selectTarget(targets: Chrome.ITarget[], targetUrl?: string): Chrome.ITarget {
    if (targetUrl) {
        // If a url was specified, try to filter to that url
        const filteredTargets = chromeUtils.getMatchingTargets(targets, targetUrl);
        if (filteredTargets.length) {
            targets = filteredTargets;
        } else {
            logger.error(`Warning: Can't find a target that matches: ${targetUrl}. Available pages: ${JSON.stringify(targets.map(target => target.url))}`);
        }
    }

    if (targets.length) {
        if (targets.length > 1) {
            logger.log('Warning: Found more than one valid target page. Attaching to the first one. Available pages: ' + JSON.stringify(targets.map(target => target.url)));
        }

        return targets[0];
    } else {
        logger.log('Got a response from the target app, but no target pages found');
        return null;
    }
}
