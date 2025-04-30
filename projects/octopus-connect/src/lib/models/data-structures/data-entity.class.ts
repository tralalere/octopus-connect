import {take} from 'rxjs/operators';
import {DataConnector} from '../data-connector.class';
import {Observable} from 'rxjs';
import {EntityDataSet} from '../types';

type Embeddings<T, K extends keyof T = keyof T> = { [key in K]: DataEntity<T[key]>[] | DataEntity<T[key]> };

/**
 * Data entity unit object
 */
export class DataEntity<T extends { [key: string]: any } = any> {

    /**
     * Entity attributes
     */
    attributes: T = {} as T;

    /**
     * Nested entities
     */
    nesting: T = {} as T;


    // embeddings: {[key: string]: DataEntity[]} = {};

    relationship: { [key: string]: DataEntity<any> } = {};

    /**
     * Reference object for diff
     */
    private attributesRef: T;

    /**
     *
     */
    private embeddings: Embeddings<any> = {} as Embeddings<any>;

    /**
     * Create the data entity
     * @param type Type of the entity
     * @param data Entity data
     * @param connector Reference to the connector
     * @param id Entity id
     * @param embeddingsConf Embeddings configuration
     */
    constructor(
        public type: string,
        data: EntityDataSet<{ [key: string]: any }>,
        private connector: DataConnector = null,
        public id: number | string = null,
        private embeddingsConf: { [key: string]: string } = null
    ) {
        for (const key in data) {
            if (data.hasOwnProperty(key) && key !== 'id') {
                (this.attributes as any)[key] = data[key];

                if (embeddingsConf && embeddingsConf[key] !== undefined && this.attributes[key]) {
                    if (Array.isArray(this.attributes[key])) {
                        (this.embeddings as any)[key] = [];

                        this.attributes[key].forEach((elem: EntityDataSet) => {
                            (this.embeddings[key] as DataEntity[])
                                .push(new DataEntity(embeddingsConf[key], elem, connector, elem.id, embeddingsConf));
                        });
                    } else {
                    (this.embeddings as any)[key] = new DataEntity(
                            embeddingsConf[key],
                            this.attributes[key],
                            connector,
                            this.attributes[key].id,
                            embeddingsConf
                        );
                    }
                }
            }
        }

        if (data.id) {
            this.id = data.id;
        }

        this.generateReferenceObject();
    }

    /**
     * Set an attribute by key
     * @param key Key name
     * @param value New value
     */
    set<U = any>(key: keyof (T | U), value: any) {
        this.attributes[key] = value;
    }

    /**
     * Get an attribute by key
     * @param key Key name
     * @returns Value
     */
    get<U extends keyof T>(key: U) {
        return this.attributes[key];
    }

    get hasChanges(): boolean {

        if (Object.keys(this.attributes).length === 0) {
            return false;
        }

        for (const key in this.attributes) {
            if (this.attributes[key] !== this.attributesRef[key]) {
                return true;
            }
        }

        return false;
    }

    getEmbed<U extends {[key: string]: any} = any, V = DataEntity<U>>(name: string) {
        return this.embeddings[name] as V | V[];
    }

    /**
     * Save the entity
     * @returns The observable associated to the entity in connector stores
     */
    save(forceReload: boolean = false, dispatchBeforeResponse: boolean = false) {
        return this.saveAction(forceReload, dispatchBeforeResponse);
    }

    saveAction(forceReload: boolean = false, dispatchBeforeResponse: boolean = false) {
        let obs: Observable<DataEntity<T>>;

        if (this.id !== -1) {
            obs = this.connector.saveEntity(this, forceReload, dispatchBeforeResponse);
        } else {
            // temporary entity deletion
            this.remove();
            obs = this.connector.createEntity(this.type, this.attributes);
        }

        obs.pipe(take(1)).subscribe(() => {
            this.generateReferenceObject();
        });

        return obs;
    }

    /**
     * Delete the entity
     * @returns True if deletion success
     */
    remove(): Observable<boolean> {
        return this.connector.deleteEntity(this);
    }

    /**
     * Copy the attributes to generate the new reference object (for diff)
     */
    private generateReferenceObject() {
        const ref: T = {} as T;

        const keys: (keyof T)[] = Object.keys(this.attributes);

        keys.forEach((key) => {
            ref[key] = this.attributes[key];
        });

        this.attributesRef = ref;
    }

    /**
     * Get an attributes cloned object
     * @returns The cloned attributes object
     */
    getClone(): EntityDataSet<T> {
        const clone: EntityDataSet = {};

        const keys: string[] = Object.keys(this.attributes);

        keys.forEach((key: string) => {
            clone[key] = this.attributes[key];
        });

        return clone as EntityDataSet<T>;
    }

    /**
     * Return the diff (only updated properties since last save action)
     * @returns Diff object
     */
    getDiff(): EntityDataSet<T> {
        const diff: EntityDataSet<T> = {} as EntityDataSet<T>;

        const keys = Object.keys(this.attributes);

        keys.forEach((key: string) => {
            if (this.attributes[key] !== undefined &&
                this.attributesRef[key] !== this.attributes[key]) {
                (diff as any)[key] = this.attributes[key];
            }
        });

        return diff;
    }
}
