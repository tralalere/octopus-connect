/**
 * Entity raw data
 */
export type EntityDataSet<T = { [key: string]: any }> = T & { id?: number };

/**
 * Collection raw data
 */
export interface CollectionDataSet<T extends { [key: string]: any }> {

    /**
     * Entities data, indexed by id
     */
    [key: number]: EntityDataSet<T>;
}

/**
 * Filter object
 */
export interface FilterData {

    /**
     * Filter properties, indexed by string key name
     */
    [key: string]: any;
}
