import {ModelSchema} from 'octopus-model';
import {HttpEndpointConfiguration} from './data-interfaces/http/http-endpoint-configuration.interface';

/**
 * Individual endpoint config
 */
export interface EndpointConfig {

    /**
     * Service used by this endpoint
     */
    type: string;

    /**
     * Model structure associated to this endpoint
     */
    structure?: ModelSchema;

    /**
     * Does the endpoint use the connector cache ?
     */
    cached?: boolean;

    /**
     *
     */
    useLanguage?: boolean;

    /**
     * List of data attributes keys excluded in save and create actions, used in some services
     */
    exclusions?: string[];

    /**
     * List of nested attributes: key is attributeName, value is endpoint name
     */
    nesting?: { [key: string]: string };

    /**
     *
     */
    embeddings?: { [key: string]: string };

    /**
     * Optional data
     */
    datas?: HttpEndpointConfiguration;

    /**
     * Is automatic refresh enabled
     */
    refreshEnabled?: boolean;

    /**
     * If true, no authentication data need on this endpoint
     */
    authenticationFree?: boolean;
}
