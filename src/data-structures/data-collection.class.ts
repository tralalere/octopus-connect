/**
 * Created by Christophe on 10/10/2017.
 */
import {DataConnector} from "../data-connector.class";
import {DataEntity} from "./data-entity.class";
import {CollectionDataSet, EntityDataSet} from "../types";
import {Observable} from "rxjs";
import {ModelSchema} from "octopus-model";

/**
 * Data collection object
 */
export class DataCollection {

    paginated = false;

    count: number;

    /**
     * Entities contained by the collection
     * @type {any[]}
     */
    entities:DataEntity[] = [];

    /**
     * Observables of entities contained by the collection
     * @type {any[]}
     */
    entitiesObservables:Observable<DataEntity>[] = [];

    /**
     * Creates the collection
     * @param {string} type
     * @param {CollectionDataSet | EntityDataSet[]} data
     * @param {DataConnector} connector
     * @param {ModelSchema} structure
     */
    constructor(
        public type:string,
        data:CollectionDataSet|EntityDataSet[],
        private connector:DataConnector = null,
        structure:ModelSchema = null,
        embeddings: {[key: string]: string} = null
    ) {

        if (Array.isArray(data)) {
            data.forEach((elem:Object) => {

                if (structure) {
                    elem = structure.filterModel(elem);
                }

                this.entities.push(new DataEntity(type, elem, connector, elem["id"], embeddings));
            });
        } else {
            let keys:string[] = Object.keys(data);
            keys.forEach((key:string) => {

                if (structure) {
                    data[key] = structure.filterModel(data[key]);
                }

                this.entities.push(new DataEntity(type, data[key], connector, key, embeddings));
            });
        }

    }

    /**
     * Remove entity from collection
     * @param {number} id Id of the entity to delete
     */
    deleteEntity(id:number|string) {
        this.entities.forEach((entity:DataEntity, index:number) => {
            if (entity.id === id) {
                this.entities.splice(index, 1);
                this.entitiesObservables.splice(index, 1);
            }
        });
    }

    /**
     * Register entity in collection, if not already contained by the collection
     * @param {DataEntity} entity Entity to register
     * @param {Observable<DataEntity>} entityObservable Entity observable to register
     */
    registerEntity(entity:DataEntity, entityObservable:Observable<DataEntity>) {
        let count = 0;
        for (let collectionEntity of this.entities) {
            if (entity.id && entity.id === collectionEntity.id) {
                this.entities[count] = entity;
                this.entitiesObservables[count] = entityObservable;
                return;
            }

            count++;
        }

        this.entities.push(entity);
        this.entitiesObservables.push(entityObservable);
    }
}