import {Observable, Subject} from 'rxjs';
import {CollectionDataSet, EntityDataSet, FilterData} from '../types';
import {InterfaceError} from './interface-error.class';
import {CollectionOptionsInterface} from '../collection-options.interface';
import {CollectionPaginator} from '../collection-paginator.class';

/**
 * Base external interface
 */
export abstract class ExternalInterface<T extends { [key: string]: any }> {

    get authenticated(): Observable<EntityDataSet<T>> {return undefined}
    public unexpectedLogoutSubject: Subject<void> = new Subject<void>();

    /**
     * if true, the save method will only send the modified properties to the service
     */
    useDiff = false;

    retryTimeout: number;

    maxRetry: number;

    /**
     * Load an entity from the service
     * @param type Name of the endpoint
     * @param id Id of the entity
     * @param errorHandler Function used to handle errors
     * @returns A set of data, or an observable
     */
    loadEntity(type: string, id: number | string, errorHandler: Function = null): EntityDataSet<T> | Observable<EntityDataSet<T>> {
        console.warn('LoadEntity not implemented in interface');
        return null;
    }

    /**
     * Load an entity collection from the service
     * @param type Name of the endpoint
     * @param filter Collection filter object
     * @param errorHandler Function used to handle errors
     * @returns A collection set of data, or an observable
     */
    loadCollection(type: string, filter: FilterData, errorHandler: Function = null): CollectionDataSet<T> | Observable<CollectionDataSet<T>> {
        console.warn('LoadCollection not implemented in interface');
        return null;
    }


    /**
     *
     */
    clear(): void {
        console.warn('LoadCollection not implemented in interface');
    }

    paginatedLoadCollection(type: string, options: CollectionOptionsInterface, paginator: CollectionPaginator<T>, errorHandler: Function = null): CollectionDataSet<T> | Observable<CollectionDataSet<T>> {
        console.warn('PaginatedLoadCollection not implemented in interface');
        return null;
    }

    /**
     * Create an entity on the service
     * @param type Endpoint name
     * @param data Base data used to create the entity
     * @param errorHandler Function used to handle errors
     * @returns A set of data, or an observable
     */
    createEntity(type: string, data: EntityDataSet<any>, errorHandler: Function = null): EntityDataSet<T> | Observable<EntityDataSet<T>> {
        console.warn('CreateEntity not implemented in interface');
        return null;
    }

    /**
     * Delete an entity from the service
     * @param type Name of the endpoint
     * @param id Id of the entity
     * @param errorHandler Function used to handle errors
     * @returns True if deletion success
     */
    deleteEntity(type: string, id: number | string, errorHandler: Function = null): boolean | Observable<boolean> {
        console.warn('DeleteEntity not implemented in interface');
        return null;
    }

    /**
     * Save an entity on the service
     * @param data Data to Save
     * @param type Name of the endpoint
     * @param id Id of the entity
     * @param errorHandler Function used to handle errors
     * @returns The saved data
     */
    saveEntity(data: EntityDataSet<T>, type: string, id: number | string, errorHandler: Function = null): EntityDataSet<T> | Observable<EntityDataSet<T>> {
        console.warn('SaveEntity not implemented in interface');
        return null;
    }

    /**
     * Authenticating to the service
     * @param login User login
     * @param password User password
     * @param errorHandler Function used to handle errors
     */
    authenticate(login: string, password: string, errorHandler: Function = null): Observable<EntityDataSet<T>> {
        console.warn('Authenticate not implemented in interface');
        return null;
    }

    logout(): Observable<boolean> {
        return null;
    }

    /**
     * Release an endpoint if not useful anymore
     * @param type Name of the endpoint
     */
    release(type: string) {
        console.warn('Release not implemented in interface');
    }

    /**
     * Sends an error message
     * @param code Error code
     * @param originalMessage Error original text message
     * @param errorHandler Error handler Function
     */
    sendError(code: number, originalMessage: string, errorHandler: Function, data: Object = {}) {
        let error: InterfaceError = new InterfaceError(code, '', originalMessage, data);
        errorHandler(error);
    }

}
