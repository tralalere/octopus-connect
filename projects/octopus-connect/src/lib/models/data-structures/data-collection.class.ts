import {DataConnector} from '../data-connector.class';
import {DataEntity} from './data-entity.class';
import {CollectionDataSet, EntityDataSet} from '../types';
import {Observable} from 'rxjs';
import {ModelSchema} from 'octopus-model';

/**
 * Data collection object
 */
export class DataCollection<T extends { [key: string]: any } = any> {

    paginated = false;

    count: number;

    /**
     * Entities contained by the collection
     */
    entities: DataEntity<T>[] = [];

    /**
     * Observables of entities contained by the collection
     */
    entitiesObservables: Observable<DataEntity<T>>[] = [];

    /**
     * Creates the collection
     */
    constructor(
        public type: string,
        data: CollectionDataSet<T> | EntityDataSet<T>[],
        private connector: DataConnector = null,
        structure: ModelSchema = null,
        embeddings: { [key: string]: string } = null
    ) {

        if (Array.isArray(data)) {
            data.forEach((elem) => {

                if (structure) {
                    elem = structure.filterModel(elem) as EntityDataSet<T>;
                }

                this.entities.push(new DataEntity<T>(type, elem, connector, elem?.id, embeddings));
            });
        } else {
            const keys: string[] = Object.keys(data);
            keys.forEach((key: string) => {

                if (structure) {
                    data[key] = structure.filterModel(data[key]);
                }

                this.entities.push(new DataEntity(type, data[key], connector, key, embeddings));
            });
        }

    }

    /**
     * Remove entity from collection
     * @param id Id of the entity to delete
     */
    deleteEntity(id: number | string) {
        this.entities.forEach((entity, index: number) => {
            if (entity.id === id) {
                this.entities.splice(index, 1);
                this.entitiesObservables.splice(index, 1);
            }
        });
    }

    /**
     * Register entity in collection, if not already contained by the collection
     * @param entity Entity to register
     * @param entityObservable Entity observable to register
     */
    registerEntity(entity: DataEntity<T>, entityObservable: Observable<DataEntity<T>>) {
        let count = 0;
        for (const collectionEntity of this.entities) {
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
