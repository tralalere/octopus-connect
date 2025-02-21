import {Observable, ReplaySubject, Subject} from 'rxjs';
import {DataCollection} from '../data-structures/data-collection.class';
import { sha1 as ObjectHash} from 'object-hash';
import {DataEntity} from '../data-structures/data-entity.class';
import {FilterData} from '../types';

/**
 * Collection store: where the collections and the collection observables are stored for an endpoint
 */
export class CollectionStore<T extends { [key: string]: any }> {

    /**
     * Stored collection observables, indexed by filter hash
     */
    private collectionObservables: { [key: string]: Subject<DataCollection<T>> } = {};

    /**
     * Filters indexed by their hash
     */
    public filters: FilterData = {};

    /**
     * Stored collections, indexed by filter hash
     */
    public collections: { [key: string]: DataCollection<T> } = {};

    /**
     * Creates the store
     */
    constructor() {
    }


    /**
     *
     */
    clearEntities(filter: FilterData): void {
        const hash: string = ObjectHash(filter);

        if (this.collections[hash]) {
            this.collections[hash].entities.length = 0;
        }
    }

    /**
     * Registers the collection in store and update associated subject. If the subject does not exists, creates it
     * @param collection Collection to register
     * @param filter Collection filter
     * @returns Observable associated to the collection
     */
    registerCollection(collection: DataCollection<T>, filter: FilterData): Observable<DataCollection<T>> {

        const hash: string = ObjectHash(filter);
        this.filters[hash] = filter;
        this.collections[hash] = collection;

        let collectionSubject: Subject<DataCollection<T>>;

        if (this.collectionObservables[hash]) {
            collectionSubject = this.collectionObservables[hash];
        } else {
            collectionSubject = new Subject<DataCollection<T>>();
            this.collectionObservables[hash] = collectionSubject;
        }

        // collectionSubject.next(collection);
        return collectionSubject;
    }

    /**
     * Register entity in collection in store if entity match collection filter
     * @param entity Entity to register
     * @param entityObservable Entity observable to register
     * @param refreshCollection If true, the collection observable is refreshed
     */
    registerEntityInCollections(entity: DataEntity<T>, entityObservable: Observable<DataEntity<T>>, refreshCollection: boolean = true) {
        const collectionKeys: string[] = Object.keys(this.collections);

        collectionKeys.forEach((key: string) => {
            if (this.entityMatchFilter(entity, this.filters[key])) {
                this.collections[key].registerEntity(entity, entityObservable);

                if (refreshCollection) {
                    this.collectionObservables[key].next(this.collections[key]);
                }
            }
        });
    }

    /**
     * Refresh collection observable by filter
     * @param filter Filter object
     */
    refreshCollections(filter: FilterData) {
        const filterKeys: string[] = Object.keys(this.collectionObservables);

        filterKeys.forEach((hash: string) => {
            if (this.filters[hash] && this.collections[hash] && this.filterMatching(filter, this.filters[hash])) {
                this.collectionObservables[hash].next(this.collections[hash]);
            }
        });
    }

    /**
     * Delete entity from stored collections
     * @param entity Entity to delete
     */
    deleteEntityFromCollection(entity: DataEntity<T>) {

        const collectionKeys: string[] = Object.keys(this.collections);

        collectionKeys.forEach((key: string) => {
            if (this.entityMatchFilter(entity, this.filters[key])) {
                this.collections[key].deleteEntity(entity.id);
                this.collectionObservables[key].next(this.collections[key]);
            }
        });
    }

    /**
     * Delete all data for a specific filter
     * @param filter The filter used to delete data
     */
    unregister(filter: FilterData) {

        const hash: string = ObjectHash(filter);

        if (this.collections[hash]) {
            delete this.collections[hash];
        }

        if (this.collectionObservables[hash]) {
            delete this.collectionObservables[hash];
        }

        if (this.filters[hash]) {
            delete this.filters[hash];
        }
    }

    /**
     * Test if the entity matches the filter
     * @param entity Entity to test
     * @param filter Filter object
     * @returns True if the entity matches the filter
     */
    entityMatchFilter(entity: DataEntity<T>, filter: FilterData): boolean {
        const filterKeys: string[] = Object.keys(filter);

        for (const key of filterKeys) {
            if (entity.attributes[key] !== undefined && filter[key] !== entity.attributes[key]) {
                return false;
            }
        }

        return true;
    }

    /**
     *
     * @param filter1
     * @param filter2
     * @returns {boolean}
     */
    filterMatching(filter1: FilterData = {}, filter2: FilterData = {}): boolean {

        if (!filter1 || !filter2) {
            return false;
        }

        // must have the same keys
        const filter1Keys: string[] = Object.keys(filter1);
        const filter2Keys: string[] = Object.keys(filter2);

        if (filter1Keys.length !== filter2Keys.length) {
            return false;
        }

        for (const key of filter1Keys) {
            if (filter2Keys.indexOf(key) === -1) {
                return false;
            }
        }

        for (const key of filter1Keys) {
            if (filter1[key] !== filter2[key]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Returns the observable associated to the specified filter
     * @param filter Filter object
     * @returns The observable associated to the filter object
     */
    getCollectionSubject(filter: FilterData, useCache = false): Subject<DataCollection<T>> {

        const hash: string = ObjectHash(filter);

        if (this.collectionObservables[hash]) {
            return this.collectionObservables[hash];
        } else {
            let subject: Subject<DataCollection<T>>;

            if (useCache) {
                subject = new ReplaySubject<DataCollection<T>>();
            } else {
                subject = new Subject<DataCollection<T>>();
            }
            this.collectionObservables[hash] = subject;
            return subject;
        }
    }

    /**
     * Returns true if collection is defined in store
     * @param filter Collection filter object
     */
    isInStore(filter: FilterData): boolean {
        const hash: string = ObjectHash(filter);
        return !!this.collections[hash];
    }
}
