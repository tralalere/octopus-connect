import {Observable} from 'rxjs';
import {DataCollection} from './data-structures/data-collection.class';
import {CollectionPaginator} from './collection-paginator.class';

export interface PaginatedCollection<T extends { [key: string]: any } = any> {
    collectionObservable: Observable<DataCollection<T>>;
    paginator: CollectionPaginator<T>;
}
