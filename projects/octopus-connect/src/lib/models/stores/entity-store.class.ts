import {DataEntity} from '../data-structures/data-entity.class';
import {Observable, ReplaySubject} from 'rxjs';

/**
 * Entity store: where the entities and the entities observables are stored for an endpoint
 */
export class EntityStore<T extends { [key: string]: any }> {

    /**
     * Stores entities subjects, indexed by entity id
     */
    private entitiesObservables: { [key: number]: ReplaySubject<DataEntity<T>> } = {};

    /**
     * Creates the store
     */
    constructor() {
    }


    clear(): void {

    }

    /**
     * Registers the entity in store and update associated subject. If the subject does not exists, creates it
     * @param entity Entity to register
     * @param id Entity id
     * @returns Observable associated to the entity
     */
    registerEntity(entity: DataEntity<T>, id: number | string): Observable<DataEntity<T>> {

        if (id !== -1 && this.entitiesObservables[id]) {
            this.entitiesObservables[id].next(entity);
            return this.entitiesObservables[id];
        } else {
            const subject: ReplaySubject<DataEntity<T>> = new ReplaySubject<DataEntity<T>>(1);
            subject.next(entity);

            if (id !== -1) {
                this.entitiesObservables[id] = subject;
            }

            return subject;
        }

    }

    /**
     * Register an entity subject to a specified id
     * @param id Id used for registration
     * @param subject Subject to register
     */
    registerEntitySubject(id: number, subject: ReplaySubject<DataEntity<T>>) {
        if (id !== -1) {
            this.entitiesObservables[id] = subject;
        }
    }

    /**
     * Delete all data for a specific entity id
     * @param id Entity id
     */
    unregister(id: number | string) {
        if (this.entitiesObservables[id]) {
            delete this.entitiesObservables[id];
        }
    }

    /**
     * Delete entity from store
     * @param entity Entity to delete
     */
    unregisterEntity(entity: DataEntity<T>) {
        delete this.entitiesObservables[entity.id];
    }

    /**
     * Returns the observable associated to the specified id
     * @param id Id used in registration
     * @returns Entity subject associated to the id
     */
    getEntityObservable<T extends { [key: string]: any }>(id: number | string, createObservable: boolean = false): ReplaySubject<DataEntity<T>> {

        if (this.entitiesObservables[id] && createObservable === false) {
            return this.entitiesObservables[id];
        } else {
            const subject: ReplaySubject<DataEntity<T>> = new ReplaySubject<DataEntity<T>>(1);
            this.entitiesObservables[id] = subject;
            return subject;
        }
    }

    /**
     * Returns true if entity is defined in store
     * @param entityId Entity id
     * @returns {boolean}
     */
    isInStore(entityId: number): boolean {
        return !!this.entitiesObservables[entityId];
    }
}
