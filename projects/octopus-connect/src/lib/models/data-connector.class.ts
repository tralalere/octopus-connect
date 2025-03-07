import {take, map} from 'rxjs/operators';
import {DataConnectorConfig} from './data-connector-config.interface';
import {DataEntity} from './data-structures/data-entity.class';
import {Observable, ReplaySubject, combineLatest, Subject} from 'rxjs';
import {DataCollection} from './data-structures/data-collection.class';
import {ExternalInterface} from './data-interfaces/abstract-external-interface.class';
import {LocalStorage} from './data-interfaces/local-storage/local-storage.class';
import {CollectionDataSet, EntityDataSet, FilterData} from './types';
import {Http} from './data-interfaces/http/http.class';
import {Nodejs} from './data-interfaces/nodejs/nodejs.class';
import {CollectionStore} from './stores/collection-store.class';
import {EntityStore} from './stores/entity-store.class';
import {EndpointConfig} from './endpoint-config.interface';
import {ModelSchema} from 'octopus-model';
import {InterfaceError} from './data-interfaces/interface-error.class';
import {Drupal8} from './data-interfaces/drupal8/drupal8.class';
import {CollectionOptionsInterface} from './collection-options.interface';
import {PaginatedCollection} from './paginated-collection.interface';
import {CollectionPaginator} from './collection-paginator.class';
import {CordovaLocal} from './data-interfaces/cordova-local/cordova-local.class';


/**
 * Data connector class
 */
export class DataConnector {

    /**
     * Available interfaces
     * @type {{}} External interfaces, indexed by name
     */
    private interfaces: { [key: string]: ExternalInterface<any> } = {};

    /**
     * Entities store
     * @type {{}} Entities stores, indexed by endpoint name
     */
    private entitiesLiveStore: { [key: string]: EntityStore<any> } = {};

    /**
     * Collections store
     * @type {{}} Collections stores, indexed by endpoint name
     */
    private collectionsLiveStore: { [key: string]: CollectionStore<any> } = {};

    /**
     * Server push listeners
     * @type {{}} Listeners, indexed by endpoint name
     */
    private pushListeners: { [key: string]: Observable<DataEntity<any>> } = {};

    /**
     *
     */
    currentLanguage: string;

    /**
     * Built-in external interfaces
     */
    private builtInFactories: { [key: string]: any } = {
        localstorage: LocalStorage,
        http: Http,
        nodejs: Nodejs,
        drupal8: Drupal8,
        cordova: CordovaLocal
    };


    globalMessageSubject: ReplaySubject<InterfaceError> = new ReplaySubject<InterfaceError>(1);

    /**
     * Delay before action retry
     */
    private retryTimeout: number;

    /**
     * Max attempts number
     */
    private maxRetry: number;

    /**
     * Create a dataConnector
     * @param configuration Data connector configuration
     */
    constructor(
        public configuration: DataConnectorConfig
    ) {
        if (this.configuration.declarations) {
            for (const declarationKey in this.configuration.declarations) {
                if (this.configuration.declarations.hasOwnProperty(declarationKey)) {
                    this.builtInFactories[declarationKey] = this.builtInFactories[this.configuration.declarations[declarationKey]];
                }
            }
        }

        for (const interfaceName in configuration.configuration) {
            if (configuration.configuration.hasOwnProperty(interfaceName)) {
                this.interfaces[interfaceName] = new this.builtInFactories[interfaceName](configuration.configuration[interfaceName], this, interfaceName);
            }
        }

        this.retryTimeout = this.configuration.retryTimeout || 50000;
        this.maxRetry = this.configuration.maxRetry || 5;

        if (typeof this.configuration.language === 'string') {
            this.currentLanguage = this.configuration.language;
        } else if (this.configuration.language instanceof Observable) {
            this.configuration.language.subscribe((language: string) => {
                this.currentLanguage = language;
            });
        }
    }

    private sendMessage(error: InterfaceError = null) {
        this.globalMessageSubject.next(error);
    }

    getRetryTimeout(type: string): number {
        return this.retryTimeout;
    }

    getMaxRetry(type: string): number {
        return this.retryTimeout;
    }

    setLanguage(language: string) {
        if (typeof this.configuration.language === 'string' || !this.configuration.language) {
            this.currentLanguage = language;
        }
    }

    globalCallback(code: number) {
        const callbackId = '';
        this.configuration.globalCallback(callbackId);
    }

    /**
     * Get data interface by endpoint name
     * @param type Endpoint name
     * @returns External interface
     */
    private getInterface<T extends { [key: string]: any }>(type: string): ExternalInterface<T> {
        const conf: string | EndpointConfig = this.getEndpointConfiguration(type);

        if (typeof conf === 'string') {
            return this.interfaces[conf];
        } else if (conf && conf.type) {
            return this.interfaces[conf.type];
        } else {
            return this.interfaces[this.configuration.defaultInterface];
        }
    }

    /**
     * Get endpoint configuration
     * @param type Endpoint name
     * @returns Type of the endpoint, or endpoint configuration object
     */
    getEndpointConfiguration(type: string): string | EndpointConfig {
        return this.configuration.map[type];
    }

    /**
     * Get model schema used by the endpoint
     * @param type Endpoint name
     * @returns The model schema
     */
    private getEndpointStructureModel(type: string): ModelSchema {
        const conf: string | EndpointConfig = this.getEndpointConfiguration(type);

        if (conf && typeof conf === 'object') {
            return conf.structure;
        }
    }

    /**
     * Get nesting attributes types
     * @param type Endpoint name
     * @returns The nested attributes types
     */
    private getNesting(type: string): { [key: string]: string } {
        const conf: string | EndpointConfig = this.getEndpointConfiguration(type);

        if (conf && typeof conf === 'object') {
            return conf.nesting || null;
        }
    }

    private getDatas(type: string): { [key: string]: any } {
        const conf: string | EndpointConfig = this.getEndpointConfiguration(type);

        if (conf && typeof conf === 'object') {
            return conf.datas || null;
        }
    }

    private getEmbeddings(type: string): { [key: string]: string } {
        const conf: string | EndpointConfig = this.getEndpointConfiguration(type);

        if (conf && typeof conf === 'object') {
            return conf.embeddings || null;
        }
    }

    /**
     * Is this endpoint using connector cache
     * @param type Name of the endpoint
     * @returns True if the endpoint use cache
     */
    private useCache(type: string): boolean {
        const conf: string | EndpointConfig = this.getEndpointConfiguration(type);

        if (conf && typeof conf === 'object') {
            return !!conf.cached;
        }

        return false;
    }

    /**
     * Get optional keys excluded for saving entities in this endpoint
     * @param type Endpoint name
     * @returns A list of string keys
     */
    private getExclusions(type: string): string[] {
        const conf: string | EndpointConfig = this.getEndpointConfiguration(type);

        if (conf && typeof conf === 'object') {
            return conf.exclusions ? conf.exclusions : [];
        }

        return [];
    }

    /**
     * Get the observable associated to an entity from the store
     * @param type Endpoint name
     * @param id Id of the entity
     * @returns The observable associated to the entity
     */
    private getEntityObservableInStore<T extends { [key: string]: any }>(type: string, id: number | string): Observable<DataEntity<T>> {

        if (this.entitiesLiveStore[type]) {
            return this.entitiesLiveStore[type].getEntityObservable(id);
        }

        return null;
    }

    /**
     * Get the observable associated to the collection from the store
     * @param type Endpoint name
     * @param filter Filter object
     * @param useCache Store the result in cache or retrieve it from cache
     * @param createIfNotExisted Create the observable if not existed
     * @returns The observable associated to the collection
     */
    private getCollectionObservableInStore<T extends { [key: string]: any }>(type: string, filter: FilterData, useCache = false, createIfNotExisted = true): Observable<DataCollection<T>> {
        const isExisted: boolean = this.collectionsLiveStore[type] && this.collectionsLiveStore[type].isInStore(filter);

        if (isExisted || createIfNotExisted) {
            return this.collectionsLiveStore[type].getCollectionSubject(filter, useCache);
        }

        return null;
    }

    /**
     * Get the observable associated to an entity from the store, if the store is undefined, create it
     * @param type Endpoint name
     * @param id Id of the entity
     * @param createObservable
     * @returns The observable associated to the entity
     */
    private getEntitySubject<T extends { [key: string]: any }>(type: string, id: number | string, createObservable: boolean = false): ReplaySubject<DataEntity<T>> {

        if (!this.entitiesLiveStore[type]) {
            this.entitiesLiveStore[type] = new EntityStore<T>();
        }

        return this.entitiesLiveStore[type].getEntityObservable<T>(id, createObservable);
    }

    /**
     * Register entity in the stores
     * @param type Endpoint name
     * @param id Id of the entity
     * @param entity Entity
     * @param entityObservable Observable to register
     * @returns The observable associated to the entity
     */
    registerEntity<T extends { [key: string]: any }>(type: string, id: number | string, entity: DataEntity<T>, entityObservable: Observable<DataEntity<T>>): Observable<DataEntity<T>> {

        if (!this.entitiesLiveStore[type]) {
            this.entitiesLiveStore[type] = new EntityStore();
        }

        if (!this.collectionsLiveStore[type]) {
            this.collectionsLiveStore[type] = new CollectionStore();
        }

        this.collectionsLiveStore[entity.type].registerEntityInCollections(entity, entityObservable);
        return this.entitiesLiveStore[type].registerEntity(entity, id);
    }


    registerEntityByData<T extends { [key: string]: any }>(type: string, id: number | string, entityData: EntityDataSet<T>) {

        if (!this.entitiesLiveStore[type]) {
            this.entitiesLiveStore[type] = new EntityStore();
        }

        if (!this.collectionsLiveStore[type]) {
            this.collectionsLiveStore[type] = new CollectionStore();
        }

        const entity = new DataEntity<T>(type, entityData, this, id);
        const obs = this.getEntitySubject<T>(type, id);

        this.collectionsLiveStore[entity.type].registerEntityInCollections(entity, obs);
        this.entitiesLiveStore[type].registerEntity(entity, id);

        if (this.pushListeners[type]) {
            (this.pushListeners[type] as Subject<DataEntity<T>>).next(entity);
        }
    }

    private registerCollectionEntities<T extends { [key: string]: any }>(type: string, collection: DataCollection<T>): Observable<DataEntity<T>>[] {

        if (!this.entitiesLiveStore[type]) {
            this.entitiesLiveStore[type] = new EntityStore();
        }

        if (!this.collectionsLiveStore[type]) {
            this.collectionsLiveStore[type] = new CollectionStore();
        }

        const entitiesObservables: Observable<DataEntity<T>>[] = [];

        collection.entities.forEach((entity) => {

            const entityObservable = this.getEntitySubject(type, entity.id);

            this.collectionsLiveStore[entity.type].registerEntityInCollections(entity, entityObservable, false);
            entitiesObservables.push(this.entitiesLiveStore[type].registerEntity(entity, entity.id));
        });

        return entitiesObservables;
    }


    private replaceCollectionEntities<T extends { [key: string]: any }>(type: string, collection: DataCollection<T>, filter: FilterData): Observable<DataEntity<T>>[] {

        if (!this.entitiesLiveStore[type]) {
            this.entitiesLiveStore[type] = new EntityStore();
        }

        if (!this.collectionsLiveStore[type]) {
            this.collectionsLiveStore[type] = new CollectionStore();
        }

        this.collectionsLiveStore[type].clearEntities(filter);

        const entitiesObservables: Observable<DataEntity<T>>[] = [];

        collection.entities.forEach((entity) => {

            const entityObservable = this.getEntitySubject(type, entity.id);

            this.collectionsLiveStore[entity.type].registerEntityInCollections(entity, entityObservable, false);
            entitiesObservables.push(this.entitiesLiveStore[type].registerEntity(entity, entity.id));
        });

        return entitiesObservables;
    }

    /**
     * Associate an entity suject the the entity in the entity store
     * @param type Endpoint name
     * @param id Id of the entity
     * @param subject Subject to associate
     */
    private registerEntitySubject<T extends { [key: string]: any }>(type: string, id: number, subject: ReplaySubject<DataEntity<T>>) {

        if (!this.entitiesLiveStore[type]) {
            this.entitiesLiveStore[type] = new EntityStore();
        }

        this.entitiesLiveStore[type].registerEntitySubject(id, subject);
    }

    /**
     * Get observable associated to the collection from the store. If store is undefined, create it
     * @param type Endpoint name
     * @param filter Filter object
     * @param useCache
     * @returns Observable associated to the collection
     */
    private getCollectionObservable<T extends { [key: string]: any }>(type: string, filter: FilterData, useCache = false): Subject<DataCollection<T>> {

        if (!this.collectionsLiveStore[type]) {
            this.collectionsLiveStore[type] = new CollectionStore();
        }

        return this.collectionsLiveStore[type].getCollectionSubject(filter, useCache);
    }

    /**
     * Register the collection and collection entities in the store
     * @param type Endpoint name
     * @param filter Filter object
     * @param collection Collection to register
     * @param refresh
     * @returns The observable associated to the collection
     */
    private registerCollection<T extends { [key: string]: any }>(type: string, filter: FilterData, collection: DataCollection<T>, refresh: boolean = true): Observable<DataCollection<T>> {

        if (!this.collectionsLiveStore[type]) {
            this.collectionsLiveStore[type] = new CollectionStore();
        }

        if (!collection.paginated) {
            collection.entitiesObservables = this.registerCollectionEntities(type, collection);
        } else {
            collection.entitiesObservables = this.replaceCollectionEntities(type, collection, filter);
        }


        const obs: Observable<DataCollection<T>> = this.collectionsLiveStore[type].registerCollection(collection, filter);

        // refresh de la collection
        if (refresh) {
            this.collectionsLiveStore[type].refreshCollections(filter);
        }

        return obs;
    }


    private paginatedRegisterCollection<T extends { [key: string]: any }>(type: string, filter: FilterData, collection: DataCollection<T>, refresh: boolean = true): Observable<DataCollection<T>> {
        if (!this.collectionsLiveStore[type]) {
            this.collectionsLiveStore[type] = new CollectionStore();
        }

        collection.entitiesObservables = this.registerCollectionEntities(type, collection);

        const obs = this.collectionsLiveStore[type].registerCollection(collection, filter);

        // refresh de la collection
        if (refresh) {
            this.collectionsLiveStore[type].refreshCollections(filter);
        }

        return obs;
    }

    /**
     * Authenticate to the service
     * @param serviceName Name of service on which we authenticate
     * @param login User login
     * @param password User password
     */
    authenticate<T extends { [key: string]: any }>(serviceName: string, login: string, password: string): Observable<DataEntity<T>> {
        const selectedInterface= this.interfaces[serviceName];

        const subject = new ReplaySubject<DataEntity<T>>(1);

        const errorHandler = (error: InterfaceError) => {
            this.sendMessage(error);
            subject.error(error);
        };

        selectedInterface.authenticate(login, password, errorHandler).pipe(map((data) => {
            this.sendMessage();
            return new DataEntity<T>('users', data, this, data.id);
        })).subscribe((entity) => {
            subject.next(entity);
        });

        return subject;
    }

    authenticated<T extends { [key: string]: any }>(serviceName: string) {
        const selectedInterface = this.interfaces[serviceName];
        return selectedInterface.authenticated.pipe(map((data) => {
            return new DataEntity<T>('users', data, this, data.id);
        }));
    }

    logout(serviceName: string): Observable<boolean> {
        const selectedInterface= this.interfaces[serviceName];
        this.clear();
        return selectedInterface.logout();
    }

    /**
     * Release endpoint if not used
     * @param type Endpoint name
     */
    release(type: string) {

    }

    clear(): void {
        this.entitiesLiveStore = {};
        this.collectionsLiveStore = {};
        this.pushListeners = {};

        for (const key in this.interfaces) {
            this.interfaces[key].clear();
        }
    }

    /**
     * Listen for an endpoint to be notified when data is pushed from the backend
     * @param type Endpoint name
     * @returns DataEntity observable associated to this entity
     */
    public listen<T extends { [key: string]: any }>(type: string) {
        if (!this.pushListeners[type]) {
            this.pushListeners[type] = new Subject<DataEntity<T>>();
        }

        return this.pushListeners[type];
    }

    /**
     * Load entity in specified endpoint
     * @param type Endpoint name
     * @param id Entity id
     * @returns DataEntity observable associated to this entity
     */
    loadEntity<T extends { [key: string]: any }>(type: string, id: number | string): Observable<DataEntity<T>> {

        if (this.useCache(type)) {
            const obs = this.getEntityObservableInStore<T>(type, id);

            if (obs) {
                return obs;
            }
        }

        const selectedInterface= this.getInterface<T>(type);

        let count = 0;

        let entityData: EntityDataSet<T> | Observable<EntityDataSet<T>>;

        if (selectedInterface) {

            const entitySubject: ReplaySubject<DataEntity<T>> = this.getEntitySubject(type, id, true);
            const structure: ModelSchema = this.getEndpointStructureModel(type);

            const embeddings: { [key: string]: string } = this.getEmbeddings(type);

            const checkResponse = () => {

                this.sendMessage();

                if (entityData instanceof Observable) {
                    entityData.subscribe((entity) => {

                        if (entity) {
                            if (structure) {
                                entity = structure.filterModel(entity) as EntityDataSet<T>;
                            }

                            // hasNesting ?
                            // let nested:{[key:string]:string} = this.getNesting(type);

                            this.registerEntity(type, id, new DataEntity<T>(type, entity, this, id, embeddings), entitySubject);
                        }

                    });
                } else {

                    if (entityData) {
                        if (structure) {
                            entityData = structure.filterModel(entityData) as EntityDataSet<T>;
                        }

                        const newEntity = new DataEntity<T>(type, entityData, this, id, embeddings);

                        // hasNesting ?
                        /*let nested:{[key:string]:string} = this.getNesting(type);

                        if (nested) {
                            let nestedKeys:string[] = Object.keys(nested);

                            nestedKeys.forEach((key:string) => {
                                let nestedObservables:Observable<DataEntity>[] = [];

                                if (entityData[key] !== undefined && typeof entityData[key] === "number") {
                                    this.loadEntity(nested[key], entityData[key]).subscribe((loadedEntity:DataEntity) => {
                                        newEntity.nesting[key] = loadedEntity;
                                    });
                                }

                                if (entityData[key] !== undefined && Array.isArray(entityData[key])) {
                                    this.loadEntities(nested[key], entityData[key]).subscribe((loadedEntities:DataEntity[]) => {
                                        newEntity.nesting[key] = loadedEntities;
                                    });
                                }
                            });
                        }*/

                        this.registerEntity(type, id, newEntity, entitySubject);
                    }

                }
            };

            const errorHandler: Function = (error: InterfaceError) => {
                const msg = `Error loading entity of type '${type}' with id ${id}. Error ${error.code}`;
                console.warn(msg);
                error.message = msg;

                this.sendMessage(error);

                if (error.code > 0) {
                    entitySubject.error(error);
                    this.entitiesLiveStore[type].unregister(id);
                } else {

                    if (count < this.getMaxRetry(type) || this.getMaxRetry(type) === -1) {
                        setTimeout(() => {
                            entityData = selectedInterface.loadEntity(type, id, errorHandler);
                            checkResponse();
                        }, this.getRetryTimeout(type));

                        count++;
                    } else {
                        entitySubject.error(error);
                        this.entitiesLiveStore[type].unregister(id);
                    }
                }

            };

            entityData = selectedInterface.loadEntity(type, id, errorHandler);
            checkResponse();

            return entitySubject;
        }
    }

    /**
     * Load many entities
     * @param type Endpoint name
     * @param ids Entities ids array
     * @returns The data entities
     */
    loadEntities<T extends { [key: string]: any }>(type: string, ids: number[]): Observable<DataEntity<T>[]> {

        // TODO: check si une méthode loadEntities optimisée existe dans l'interface

        // TODO: Pourrait retourner un objet indexé par id plutôt qu'un Array

        const observables: Observable<DataEntity<T>>[] = [];

        ids.forEach((id: number) => {
            observables.push(this.loadEntity(type, id));
        });

        return combineLatest(...observables);
    }


    paginatedLoadCollection<T extends { [key: string]: any }>(type: string, options: CollectionOptionsInterface): PaginatedCollection<T> {
        const paginator = new CollectionPaginator<T>(this, type, options, options.filter);
        return this.paginatedLoadCollectionExec(type, options.filter || {}, paginator);
    }


    paginatedLoadCollectionExec<T extends { [key: string]: any }>(type: string, filter: { [key: string]: any }, paginator: CollectionPaginator<T>): PaginatedCollection<T> {

        const selectedInterface = this.getInterface<T>(type);
        const structure: ModelSchema = this.getEndpointStructureModel(type);

        let count = 0;

        const embeddings: { [key: string]: string } = this.getEmbeddings(type);

        if (selectedInterface) {
            const collectionSubject = this.getCollectionObservable<T>(type, filter);
            let collection: CollectionDataSet<T> | Observable<CollectionDataSet<T>>;

            const checkResponse = () => {

                this.sendMessage();

                if (collection instanceof Observable) {

                    collection.subscribe((newCollection) => {
                        // ici ?
                        const coll = new DataCollection<T>(type, newCollection, this, structure, embeddings);
                        coll.paginated = true;
                        this.registerCollection(type, filter, coll);
                    });
                } else {
                    // et là ??
                    const coll = new DataCollection<T>(type, collection, this, structure, embeddings);
                    coll.paginated = true;
                    this.registerCollection(type, filter, coll);
                }
            };

            const errorHandler = (error: InterfaceError) => {
                const msg = `Error loading collection of type '${type}' with data ${JSON.stringify(filter)}`;
                console.warn(msg);
                error.message = msg;

                this.sendMessage(error);

                if (error.code > 0) {
                    collectionSubject.error(error);
                    this.collectionsLiveStore[type].unregister(filter);
                } else {
                    if (count < this.getMaxRetry(type) || this.getMaxRetry(type) === -1) {
                        setTimeout(() => {
                            collection = selectedInterface.paginatedLoadCollection(type, {
                                filter,
                                page: paginator.page,
                                range: paginator.range,
                                offset: paginator.offset,
                                urlExtension: paginator.urlExtension,
                                orderOptions: paginator.orderOptions
                            }, paginator, errorHandler);
                            checkResponse();
                        }, this.getRetryTimeout(type));

                        count++;
                    } else {
                        collectionSubject.error(error);
                        this.collectionsLiveStore[type].unregister(filter);
                    }
                }

            };

            collection = selectedInterface.paginatedLoadCollection(type, {
                filter,
                page: paginator.page,
                range: paginator.range,
                offset: paginator.offset,
                urlExtension: paginator.urlExtension,
                orderOptions: paginator.orderOptions
            }, paginator, errorHandler);
            checkResponse();

            return {
                collectionObservable: collectionSubject,
                paginator
            };
        }

        return null;
    }


    /**
     * Load collection from specified endpoint
     * @param type Endpoint name
     * @param filter Filter object
     * @returns Observable associated to this collection
     */
    loadCollection<T extends { [key: string]: any }>(type: string, filter: FilterData = {}): Observable<DataCollection<T>> {
        const useCache = this.useCache(type);

        if (useCache) {
            const obs = this.getCollectionObservableInStore<T>(type, filter, useCache);

            if (obs) {
                return obs;
            }
        }

        const selectedInterface = this.getInterface<T>(type);
        const structure: ModelSchema = this.getEndpointStructureModel(type);

        let count = 0;

        const embeddings: { [key: string]: string } = this.getEmbeddings(type);

        if (selectedInterface) {
            const collectionSubject = this.getCollectionObservable<T>(type, filter, useCache);
            let collection: CollectionDataSet<T> | Observable<CollectionDataSet<T>>;

            const checkResponse = () => {

                this.sendMessage();

                if (collection instanceof Observable) {

                    // attention, dans le cas de nodeJs, on ne doit pas faire de take(1)
                    collection.subscribe((newCollection) => {
                        this.registerCollection(type, filter, new DataCollection<T>(type, newCollection, this, structure, embeddings));
                    });
                } else {
                    this.registerCollection(type, filter, new DataCollection<T>(type, collection, this, structure, embeddings));
                }
            };

            const errorHandler = (error: InterfaceError) => {
                const msg = `Error loading collection of type '${type}' with data ${JSON.stringify(filter)}`;
                console.warn(msg);
                error.message = msg;

                this.sendMessage(error);

                if (error.code > 0) {
                    collectionSubject.error(error);
                    this.collectionsLiveStore[type].unregister(filter);
                } else {
                    if (count < this.getMaxRetry(type) || this.getMaxRetry(type) === -1) {
                        setTimeout(() => {
                            collection = selectedInterface.loadCollection(type, filter, errorHandler);
                            checkResponse();
                        }, this.getRetryTimeout(type));

                        count++;
                    } else {
                        collectionSubject.error(error);
                        this.collectionsLiveStore[type].unregister(filter);
                    }
                }

            };

            collection = selectedInterface.loadCollection(type, filter, errorHandler);
            checkResponse();

            return collectionSubject;
        }

        return null;
    }

    sendReloadNotification(type: string, data: Object = null) {

        const conf: string | EndpointConfig = this.getEndpointConfiguration(type);

        // il faut supprimer les embeddings de l'objet, pour le pas surcharger le service nodejs

        if (conf && typeof conf === 'object') {
            if (conf.refreshEnabled) {

                const dataToSend = {};

                const embeddings: Object = this.getEmbeddings(type);

                for (const key in data) {
                    if (!embeddings || embeddings[key] === undefined) {
                        dataToSend[key] = data[key];
                    }
                }


                const refreshData: any = {
                    myType: type
                };

                if (data) {
                    refreshData.data = dataToSend;
                }

                this.createEntity(this.configuration.liveRefreshService, refreshData, false);
            }
        }
    }

    /**
     * Save entity
     * @param entity Entity to save
     * @param forceReload whether to reload data if nothing is saved or not
     * @param dispatchBeforeResponse register entity before save happens
     * @returns Observable associated to the entity
     */
    saveEntity<T extends { [key: string]: any }>(entity: DataEntity<T>, forceReload: boolean = false, dispatchBeforeResponse: boolean = false): Observable<DataEntity<T>> {

        const selectedInterface = this.getInterface<T>(entity.type);
        const structure: ModelSchema = this.getEndpointStructureModel(entity.type);

        let dataToSave: EntityDataSet<T>;

        if (selectedInterface.useDiff) {
            dataToSave = entity.getDiff();
        } else {
            dataToSave = entity.getClone();
        }

        const exclusions: string[] = this.getExclusions(entity.type);

        exclusions.forEach((key: string) => {
            if (dataToSave[key]) {
                delete dataToSave[key];
            }
        });

        // let entitySubject:ReplaySubject<DataEntity> = this.getEntitySubject(entity.type, entity.id);

        const entitySubject = new ReplaySubject<DataEntity<T>>(1);

        let count = 0;

        let entityData: EntityDataSet<T> | Observable<EntityDataSet<T>>;

        const embeddings: { [key: string]: string } = this.getEmbeddings(entity.type);

        if (dispatchBeforeResponse) {
            this.registerEntity(entity.type, entity.id, entity, entitySubject);
        }

        const checkResponse = () => {

            this.sendMessage();

            if (entityData instanceof Observable) {
                entityData.subscribe((saveEntity) => {

                    if (structure) {
                        saveEntity = structure.filterModel(saveEntity) as EntityDataSet<T>;
                    }


                    const ent: DataEntity<T> = new DataEntity<T>(entity.type, saveEntity, this, entity.id, embeddings);
                    entitySubject.next(ent);
                    this.registerEntity(entity.type, entity.id, ent, entitySubject);
                    this.sendReloadNotification(entity.type, saveEntity);
                });
            } else {

                if (structure) {
                    entityData = structure.filterModel(entityData) as EntityDataSet<T>;
                }

                const ent: DataEntity<T> = new DataEntity<T>(entity.type, entityData, this, entity.id, embeddings);
                entitySubject.next(ent);
                this.registerEntity(entity.type, entity.id, ent, entitySubject);
                this.sendReloadNotification(entity.type, entityData);
            }


        };

        const errorHandler = (error: InterfaceError) => {
            const msg = `Error saving entity of type '${entity.type}' with id ${entity.id}`;
            console.warn(msg);

            error.message = msg;

            this.sendMessage(error);

            if (error.code > 0) {
                entitySubject.error(error);
                this.entitiesLiveStore[entity.type].unregister(entity.id);
            } else {
                if (count < this.getMaxRetry(entity.type) || this.getMaxRetry(entity.type) === -1) {
                    setTimeout(() => {

                        if (!selectedInterface.useDiff || Object.keys(dataToSave).length > 0) {
                            entityData = selectedInterface.saveEntity(dataToSave, entity.type, entity.id, errorHandler);
                            checkResponse();
                        } else {

                        }

                    }, this.getRetryTimeout(entity.type));

                    count++;
                } else {
                    entitySubject.error(error);
                    this.entitiesLiveStore[entity.type].unregister(entity.id);
                }
            }

        };

        if (!selectedInterface.useDiff || Object.keys(dataToSave).length > 0) {
            entityData = selectedInterface.saveEntity(dataToSave, entity.type, entity.id, errorHandler);
            checkResponse();
        } else if (forceReload) {
            this.loadEntity<T>(entity.type, entity.id).pipe(
                take(1))
                .subscribe((newEntity) => {
                    entitySubject.next(newEntity);
                });
        } else {
            entitySubject.next(entity);
        }

        return entitySubject;
    }

    /**
     * Create entity to the specified endpoint service
     * @param type Endpoint name
     * @param data Data used to create the entity
     * @returns The observable associated to this entity
     */
    createEntity<T = {[key: string]: any}>(type: string, data: any = {}, sendNotification = true): Observable<DataEntity<T>> {
        const selectedInterface = this.getInterface<T>(type);

        const structure: ModelSchema = this.getEndpointStructureModel(type);

        if (structure) {
            data = structure.generateModel(null, data) as T;
        }

        const exclusions: string[] = this.getExclusions(type);

        exclusions.forEach((key: string) => {
            if (data[key]) {
                delete data[key];
            }
        });

        const entitySubject: ReplaySubject<DataEntity<T>> = new ReplaySubject<DataEntity<T>>(1);
        let count = 0;

        let entity: EntityDataSet<T> | Observable<EntityDataSet<T>>;

        const embeddings = this.getEmbeddings(type);

        const checkResponse = () => {

            this.sendMessage();

            if (entity instanceof Observable) {
                entity.subscribe((createdEntity) => {
                    this.registerEntitySubject(type, createdEntity.id, entitySubject);
                    this.registerEntity(
                        type,
                        createdEntity.id,
                        new DataEntity(type, createdEntity, this, createdEntity.id, embeddings),
                        entitySubject
                    );

                    if (sendNotification) {
                        this.sendReloadNotification(type, createdEntity);
                    }
                });
            } else {
                this.registerEntitySubject(type, entity.id, entitySubject);
                this.registerEntity(type, entity.id, new DataEntity<T>(type, entity, this, entity.id, embeddings), entitySubject);

                if (sendNotification) {
                    this.sendReloadNotification(type, entity);
                }
            }


        };

        const errorHandler = (error: InterfaceError) => {
            const msg = `Error creating entity of type '${type}'`;
            console.warn(msg);

            error.message = msg;

            this.sendMessage(error);

            if (error.code > 0) {
                entitySubject.error(error);
            } else {
                if (count < this.getMaxRetry(type) || this.getMaxRetry(type) === -1) {
                    setTimeout(() => {
                        entity = selectedInterface.createEntity(type, data, errorHandler);
                        checkResponse();
                    }, this.getRetryTimeout(type));

                    count++;
                } else {
                    entitySubject.error(error);
                }
            }
        };

        entity = selectedInterface.createEntity(type, data, errorHandler);
        checkResponse();

        return entitySubject;
    }

    /**
     * Creates an entity on the front only (will be saved on the server later)
     * @param type Endpoint type
     * @param data Data used to create the entity
     * @returns The observable associated to this entity
     */
    createTemporaryEntity<T extends { [key: string]: any }>(type: string, data: EntityDataSet<T> = {} as T): Observable<DataEntity<T>> {
        const structure: ModelSchema = this.getEndpointStructureModel(type);

        if (structure) {
            data = structure.generateModel(null, data) as T;
        }

        const entitySubject: ReplaySubject<DataEntity<T>> = new ReplaySubject<DataEntity<T>>(1);

        const entity: DataEntity<T> = new DataEntity<T>(type, data, this, -1);

        // pas utile
        // entitySubject.next(entity);

        // attention, pas d'id, car pas de retour du serveur
        this.registerEntitySubject(type, null, entitySubject);
        this.registerEntity(type, null, entity, entitySubject);

        return entitySubject;
    }

    /**
     * Delete an entity
     * @param entity Entity to delete
     * @returns True if deletion success
     */
    deleteEntity<T extends { [key: string]: any }>(entity: DataEntity<T>): Observable<boolean> {
        const selectedInterface = this.getInterface(entity.type);

        const subject: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);
        let count = 0;

        const checkResponse = () => {

            this.sendMessage();

            const cloned: any = Object.assign({}, entity.attributes);
            cloned.id = entity.id;

            if (result instanceof Observable) {
                result.subscribe((res: boolean) => {
                    this.unregisterEntity(entity);
                    subject.next(res);
                    this.sendReloadNotification(entity.type, entity.attributes);
                });
            } else {
                this.unregisterEntity(entity);
                subject.next(result);
                this.sendReloadNotification(entity.type, entity.attributes);
            }


        };

        let result: boolean | Observable<boolean>;

        const errorHandler = (error: InterfaceError) => {
            const msg = `Error deleting entity of type '${entity.type}' with id ${entity.id}`;
            console.warn(msg);

            error.message = msg;
            this.sendMessage(error);

            if (error.code > 0) {
                subject.error(error);
                this.entitiesLiveStore[entity.type].unregister(entity.id);
            } else {
                if (count < this.getMaxRetry(entity.type) || this.getMaxRetry(entity.type) === -1) {
                    setTimeout(() => {
                        result = selectedInterface.deleteEntity(entity.type, entity.id, errorHandler);
                        checkResponse();
                    }, this.getRetryTimeout(entity.type));

                    count++;
                } else {
                    subject.error(error);
                    this.entitiesLiveStore[entity.type].unregister(entity.id);
                }
            }

        };

        result = selectedInterface.deleteEntity(entity.type, entity.id, errorHandler);
        checkResponse();

        return subject;
    }


    /**
     * Delete entity from store
     * @param entity Entity to delete
     */
    unregisterEntity<T extends { [key: string]: any }>(entity: DataEntity<T>) {
        if (this.collectionsLiveStore[entity.type]) {
            this.collectionsLiveStore[entity.type].deleteEntityFromCollection(entity);
        }

        if (this.entitiesLiveStore[entity.type]) {
            this.entitiesLiveStore[entity.type].unregisterEntity(entity);
        }
    }

    unregisterEntityTypeAndId<T extends { [key: string]: any }>(type: string, id: number | string) {

        this.entitiesLiveStore[type].getEntityObservable<T>(id).pipe(take(1)).subscribe((entity) => {
            this.unregisterEntity(entity);
        });
    }

    /**
     * Refresh entity (from refresh service)
     * @param type Endpoint name
     * @param id Entity id
     */
    refreshEntity<T extends { [key: string]: any }>(type: string, id: number) {
        const selectedInterface = this.getInterface<T>(type);

        if (this.entitiesLiveStore[type] && this.entitiesLiveStore[type].isInStore(id)) {
            this.loadEntity(type, id);
        }
    }

    /**
     * Refresh collection (from refresh service)
     * @param type Endpoint name
     * @param filter Collection filter object
     */
    refreshCollection(type: string, filter: FilterData) {
        // let selectedInterface:ExternalInterface = this.getInterface<T>(type);

        if (this.collectionsLiveStore[type] && this.collectionsLiveStore[type].isInStore(filter)) {
            this.loadCollection(type, filter);
        }
    }

    private objectMatchFilter(object: Object, filter: FilterData): boolean {
        const filterKeys: string[] = Object.keys(filter);

        for (const key of filterKeys) {
            if (object[key] !== undefined && filter[key] !== object[key]) {
                return false;
            }
        }

        return true;
    }

    refreshCollectionWithData(type: string, data: Object) {
        const store = this.collectionsLiveStore[type];
        const conf: string | EndpointConfig = this.getEndpointConfiguration(type);

        if (conf && typeof conf === 'object' && store) {
            if (conf.refreshEnabled) {
                for (const key in store.collections) {
                    const filter: FilterData = store.filters[key];

                    if (this.objectMatchFilter(data, filter)) {
                        this.loadCollection(type, filter);
                    }
                }
            }
        }
    }

    refreshAllCollectionsOfType(type: string) {
        const store = this.collectionsLiveStore[type];
        const conf: string | EndpointConfig = this.getEndpointConfiguration(type);

        if (conf && typeof conf === 'object' && store) {
            if (conf.refreshEnabled) {
                for (const key in store.collections) {
                    const filter: FilterData = store.filters[key];
                    this.loadCollection(type, filter);
                }
            }
        }
    }

    public getUnexpectedLogoutSubject(serviceName: string) {
        const selectedInterface = this.interfaces[serviceName];
        return selectedInterface.unexpectedLogoutSubject;
    }
}
