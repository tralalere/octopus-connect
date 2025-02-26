import {LocalStorageConfiguration} from './local-storage-configuration.interface';
import {DataConnector} from '../../data-connector.class';
import {ExternalInterface} from '../abstract-external-interface.class';
import {CollectionDataSet, EntityDataSet, FilterData} from '../../types';

/**
 * Local storage data interface
 */
export class LocalStorage<T extends { [key: string]: any }> extends ExternalInterface<T> {

    /**
     * Where are stored the entities
     */
    private dataStore: CollectionDataSet<T> = {};

    /**
     * Create a local storage data interface
     * @param configuration Configuration object
     * @param connector Reference to the connector
     */
    constructor(
        private configuration: LocalStorageConfiguration,
        private connector: DataConnector
    ) {
        super();
        this.useDiff = false;
    }


    /**
     *
     */
    clear(): void {
        this.dataStore = {};
    }

    /**
     * If a prefix is defined in the configuration, returns a concatenation of prefix and endpoint name
     * @param type Name of the endpoint
     * @returns The prefixed endpoint name
     */
    private getPrefixedType(type: string): string {
        if (this.configuration.prefix) {
            return this.configuration.prefix + '-' + type;
        } else {
            return type;
        }
    }

    /**
     * Load an endpoint from the local storage
     * @param pointName The endpoint name
     */
    private loadPointFromStorage(pointName: string) {
        if (!localStorage[pointName] || localStorage[pointName] === '') {
            this.dataStore[pointName] = {};
        } else {
            this.dataStore[pointName] = JSON.parse(localStorage[pointName]);
        }
    }

    /**
     * Load an endpoint from the local storage if storage object is empty for that name
     * @param type Name of the endpoint
     */
    private loadPointFromStorageIfEmpty(type: string) {
        const pointName: string = this.getPrefixedType(type);

        if (!this.dataStore[pointName]) {
            this.loadPointFromStorage(pointName);
        }
    }

    /**
     * Set entity data in local store
     * @param type Name of the endpoint
     * @param id Id of the entity
     * @param data Entity Data
     */
    private setEntityInStore(type: string, id: number, data: EntityDataSet) {
        const pointName: string = this.getPrefixedType(type);
        this.loadPointFromStorageIfEmpty(type);
        this.dataStore[pointName][id] = data;
        this.savePointToStorage(type);
    }

    /**
     * Get entity data from local store
     * @param type Name of the endpoint
     * @param id Id of the entity
     * @returns Data of the entity
     */
    private getEntityFromStore(type: string, id: number) {
        const pointName: string = this.getPrefixedType(type);
        this.loadPointFromStorageIfEmpty(type);
        return this.dataStore[pointName][id];
    }

    /**
     * Delete entity from local store
     * @param type Name of the endpoint
     * @param id Id of the entity
     * @returns True if deletion success
     */
    private deleteEntityFromStore(type: string, id: number): boolean {
        const pointName: string = this.getPrefixedType(type);
        this.loadPointFromStorageIfEmpty(type);

        if (this.dataStore[pointName][id]) {
            delete this.dataStore[pointName][id];
            this.savePointToStorage(type);
            return true;
        }

        return false;
    }

    /**
     * Get collection data from local store
     * @param type Name of the endpoint
     * @param filter Filter data
     * @returns Collection data
     */
    private getCollectionFromStore(type: string, filter: FilterData = {}) {

        const pointName: string = this.getPrefixedType(type);
        this.loadPointFromStorageIfEmpty(type);

        const dataSet: CollectionDataSet<T> = {};

        const keys: string[] = Object.keys(this.dataStore[pointName]);
        const filterKeys: string[] = Object.keys(filter);

        keys.forEach((key: string) => {
            let matching = true;

            filterKeys.forEach((filterKey: string) => {
                if (filter[filterKey] !== this.dataStore[pointName][+key][filterKey]) {
                    matching = false;
                }
            });

            if (matching) {
                dataSet[+key] = this.dataStore[pointName][+key];
            }
        });

        return dataSet;
    }

    /**
     * Save local store to localStorage, for a specified endpoint
     * @param type Name of the endpoint
     */
    private savePointToStorage(type: string) {
        const pointName: string = this.getPrefixedType(type);

        if (this.dataStore[pointName]) {
            localStorage[pointName] = JSON.stringify(this.dataStore[pointName]);
        }
    }

    /**
     * Set last used id to localStorage
     * @param value The value to set to
     */
    private set lastUsedId(value: number) {
        const lastUsedIdKey: string = this.getPrefixedType('lastusedid');

        localStorage[lastUsedIdKey] = value;
    }

    /**
     * Get last used id from localStorage
     * @returns The value
     */
    private get lastUsedId(): number {
        const lastUsedIdKey: string = this.getPrefixedType('lastusedid');

        if (localStorage[lastUsedIdKey] === undefined || localStorage[lastUsedIdKey] === '') {
            return 0;
        } else {
            return +localStorage[lastUsedIdKey];
        }
    }

    /**
     * Load an entity from local storage service
     * @param type Name of the endpoint
     * @param id Id of the entity
     * @returns The entity raw datas
     */
    loadEntity(type: string, id: number) {
        this.loadPointFromStorageIfEmpty(type);
        const data = this.getEntityFromStore(type, id);

        return data ? data : null;
    }

    /**
     * Load a collection from local storage service
     * @param type Name of the endpoint
     * @param filter Filter data
     * @returns The collection raw data
     */
    loadCollection(type: string, filter: FilterData = {}) {
        this.loadPointFromStorageIfEmpty(type);
        const data = this.getCollectionFromStore(type, filter);

        return data ? data : null;
    }

    /**
     * Save an entity to the local storage service
     * @param entity Entity data to save
     * @param type Name of the endpoint
     * @param id Id of the entity
     * @returns Saved raw data
     */
    saveEntity(entity: EntityDataSet<T>, type: string, id: number) {
        this.loadPointFromStorageIfEmpty(type);
        this.setEntityInStore(type, id, entity);

        return entity;
    }

    /**
     * Create an entity on the local storage service
     * @param type Name of the endpoint
     * @param data Entity Data
     * @returns The saved raw dats
     */
    createEntity(type: string, data: EntityDataSet<any>) {
        const newId: number = ++this.lastUsedId;
        data.id = newId;
        this.setEntityInStore(type, newId, data);
        return data as EntityDataSet<T>;
    }

    /**
     * Delete an entity from the local storage service
     * @param type Name of the endpoint
     * @param id Id of the entity
     * @returns True if deletion success
     */
    deleteEntity(type: string, id: number): boolean {
        this.loadPointFromStorageIfEmpty(type);
        return this.deleteEntityFromStore(type, id);
    }
}
