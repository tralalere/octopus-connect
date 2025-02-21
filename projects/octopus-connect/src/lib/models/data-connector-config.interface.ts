import {LocalStorageConfiguration} from './data-interfaces/local-storage/local-storage-configuration.interface';
import {ExternalInterface} from './data-interfaces/abstract-external-interface.class';
import {EndpointConfig} from './endpoint-config.interface';
import {HttpConfiguration} from './data-interfaces/http/http-configuration.interface';
import {NodejsConfiguration} from './data-interfaces/nodejs/nodejs-configuration.interface';
import {Drupal8Configuration} from './data-interfaces/drupal8/drupal8-configuration.interface';
import {Observable} from 'rxjs';
import {CordovaLocalConfiguration} from './data-interfaces/cordova-local/cordova-local-configuration.interface';

/**
 * Connector main configuration
 */
export interface DataConnectorConfig {

    /**
     * Interface used when no interface name specified for an endpoint
     */
    defaultInterface: string;

    language?: string | Observable<string>;

    /**
     * Delay before action retry
     */
    retryTimeout?: number;

    /**
     * Max attempts number
     */
    maxRetry?: number;

    /**
     * Base configurations for each service type
     */
    configuration: {
        [key: string]: HttpConfiguration | LocalStorageConfiguration | NodejsConfiguration | Drupal8Configuration | CordovaLocalConfiguration
    };

    // currently not used
    declarations?: {
        [key: string]: string
    };

    /**
     * Individual endpoint configuration
     */
    map?: {
        [key: string]: string | EndpointConfig
    };

    // currently not used
    interfaces?: {
        [key: string]: ExternalInterface<any>
    };

    globalCallback?: Function;

    liveRefreshService?: string;
}
