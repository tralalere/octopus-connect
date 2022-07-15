import {Observable, Subject} from 'rxjs';
import {CollectionDataSet, EntityDataSet, FilterData} from '../types';
import {InterfaceError} from './interface-error.class';
import {CollectionOptionsInterface} from '../collection-options.interface';
import {CollectionPaginator} from '../collection-paginator.class';

/**
 * Base external interface
 */
export abstract class ExternalInterface {

    get authenticated(): Observable<EntityDataSet> {return undefined}
    public unexpectedLogoutSubject: Subject<null> = new Subject<null>();

    /**
     * if true, the save method will only send the modified properties to the service
     * @type {boolean}
     */
    useDiff: boolean = false;

    retryTimeout: number;

    maxRetry: number;

    /**
     * Load an entity from the service
     * @param {string} type Name of the endpoint
     * @param {number} id Id of the entity
     * @param {Function} errorHandler Function used to handle errors
     * @returns {EntityDataSet | Observable<EntityDataSet>} A set of data, or an observable
     */
    loadEntity(type: string, id: number | string, errorHandler: Function = null): EntityDataSet | Observable<EntityDataSet> {
        console.warn('LoadEntity not implemented in interface');
        return null;
    }

    /**
     * Load an entity collection from the service
     * @param {string} type Name of the endpoint
     * @param {FilterData} filter Collection filter object
     * @param {Function} errorHandler Function used to handle errors
     * @returns {CollectionDataSet | Observable<CollectionDataSet>} A collection set of data, or an observable
     */
    loadCollection(type: string, filter: FilterData, errorHandler: Function = null): CollectionDataSet | Observable<CollectionDataSet> {
        console.warn('LoadCollection not implemented in interface');
        return null;
    }


    /**
     *
     */
    clear(): void {
        console.warn('LoadCollection not implemented in interface');
    }


    /**
     *
     * @param {string} type
     * @param {CollectionOptionsInterface} options
     * @returns {CollectionDataSet | Observable<CollectionDataSet>}
     */
    paginatedLoadCollection(type: string, options: CollectionOptionsInterface, paginator: CollectionPaginator, errorHandler: Function = null): CollectionDataSet | Observable<CollectionDataSet> {
        console.warn('PaginatedLoadCollection not implemented in interface');
        return null;
    }

    /**
     * Create an entity on the service
     * @param {string} type Endpoint name
     * @param {EntityDataSet} data Base data used to create the entity
     * @param {Function} errorHandler Function used to handle errors
     * @returns {EntityDataSet | Observable<EntityDataSet>} A set of data, or an observable
     */
    createEntity(type: string, data: EntityDataSet, errorHandler: Function = null): EntityDataSet | Observable<EntityDataSet> {
        console.warn('CreateEntity not implemented in interface');
        return null;
    }

    /**
     * Delete an entity from the service
     * @param {string} type Name of the endpoint
     * @param {number} id Id of the entity
     * @param {Function} errorHandler Function used to handle errors
     * @returns {boolean | Observable<boolean>} True if deletion success
     */
    deleteEntity(type: string, id: number | string, errorHandler: Function = null): boolean | Observable<boolean> {
        console.warn('DeleteEntity not implemented in interface');
        return null;
    }

    /**
     * Save an entity on the service
     * @param {EntityDataSet} data Data to Save
     * @param {string} type Name of the endpoint
     * @param {number} id Id of the entity
     * @param {Function} errorHandler Function used to handle errors
     * @returns {EntityDataSet | Observable<EntityDataSet>} The saved data
     */
    saveEntity(data: EntityDataSet, type: string, id: number | string, errorHandler: Function = null): EntityDataSet | Observable<EntityDataSet> {
        console.warn('SaveEntity not implemented in interface');
        return null;
    }

    /**
     * Authenticating to the service
     * @param {string} login User login
     * @param {string} password User password
     * @param {Function} errorHandler Function used to handle errors
     * @returns {Observable<boolean>}
     */
    authenticate(login: string, password: string, errorHandler: Function = null): Observable<EntityDataSet> {
        console.warn('Authenticate not implemented in interface');
        return null;
    }

    logout(): Observable<boolean> {
        return null;
    }

    /**
     * Release an endpoint if not useful anymore
     * @param {string} type Name of the endpoint
     */
    release(type: string) {
        console.warn('Release not implemented in interface');
    }

    /**
     * Sends an error message
     * @param {number} code Error code
     * @param {string} originalMessage Error original text message
     * @param {Function} errorHandler Error handler Function
     */
    sendError(code: number, originalMessage: string, errorHandler: Function, data: Object = {}) {
        let error: InterfaceError = new InterfaceError(code, '', originalMessage, data);
        errorHandler(error);
    }

}
