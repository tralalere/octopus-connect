import {map} from 'rxjs/operators';
import {ExternalInterface} from '../abstract-external-interface.class';
import {DataConnector} from '../../data-connector.class';
import {HttpConfiguration} from './http-configuration.interface';
import {BehaviorSubject, Observable, ReplaySubject, combineLatest} from 'rxjs';
import {CollectionDataSet, EntityDataSet} from '../../types';
import {EndpointConfig} from '../../endpoint-config.interface';
import {CollectionOptionsInterface} from '../../collection-options.interface';
import {CollectionPaginator} from '../../collection-paginator.class';
import {OrderDirection} from '../../order-direction.enum';

/**
 * Http external interface
 */
export class Http extends ExternalInterface {

    /**
     *
     * @type {boolean}
     */
    //authenticated:ReplaySubject<EntityDataSet>;

    /**
     *
     */
    private dataStore: {
        user
    };

    /*
    Headers sent with each request
     */
    private headers: { [key: string]: string } = {};

    /**
     * Creates the http interface
     * @param {HttpConfiguration} configuration Configuration object
     * @param {DataConnector} connector Reference to the connector
     */
    constructor(
        private configuration: HttpConfiguration,
        private connector: DataConnector,
        private interfaceName: string
    ) {
        super();
        this.useDiff = true;

        this.clear();

        window.addEventListener('storage', (event) => this.OnUnexpectedStorageChange(event));
    }

    /**
     *
     */
    clear(): void {

        if (this.configuration.headers) {
            for (let header in this.configuration.headers) {
                if (this.configuration.headers.hasOwnProperty(header)) {
                    this.headers[header] = this.configuration.headers[header];
                }
            }
        }

        this.dataStore = {
            user: undefined
        };
    }


    /**
     * Is the user authenticated on this service ?
     * @returns {Observable<EntityDataSet>}
     */
    get authenticated(): Observable<EntityDataSet> {
        let value: ReplaySubject<EntityDataSet> = new ReplaySubject<EntityDataSet>(1);

        this.dataStore.user = JSON.parse(localStorage.getItem(`${this.interfaceName}_currentUser`));
        let expire: number = JSON.parse(localStorage.getItem(`${this.interfaceName}_expires_in`));
        if (expire > Date.now()) {
            this.dataStore.user = JSON.parse(localStorage.getItem(`${this.interfaceName}_currentUser`));
            this.setToken(JSON.parse(localStorage.getItem(`${this.interfaceName}_accessToken`))).subscribe((data: EntityDataSet) => {
                value.next(data);
            }, (err) => {
                value.error(err);
            });
        } else if (expire && expire < Date.now()) {
            value.error(null);
            this.logout();
        } else {
            value.error(null);
        }

        return value;
    }

    /**
     * Add headers to the request
     * @param {XMLHttpRequest} request A xhr request
     */
    private addHeaders(request: XMLHttpRequest) {

        for (let headerName in this.headers) {
            if (this.headers.hasOwnProperty(headerName)) {
                request.setRequestHeader(headerName, this.headers[headerName]);
            }
        }
    }

    private apiUrl(endpointName: string): string {

        let useApi: boolean = !this.configuration.useApiExtension === false;

        let ext: string = useApi ? 'api/' : '';

        let endPointConf: string | EndpointConfig = this.connector.getEndpointConfiguration(endpointName);

        let useLanguage: boolean = false;

        if (endPointConf && typeof endPointConf === 'object') {
            useLanguage = endPointConf.useLanguage;
        }

        if (typeof this.configuration.apiUrl === 'string') {

            if (!useLanguage) {
                return this.configuration.apiUrl + ext;
            } else {
                return this.configuration.apiUrl + this.connector.currentLanguage + '/' + ext;
            }
        }
    }

    /**
     * Load entity in http service
     * @param {string} type Endpoint name
     * @param {number} id Id of the entity
     * @param {Function} errorHandler Function used to handle errors
     * @returns {Observable<EntityDataSet>} Observable returning the data
     */
    loadEntity(type: string, id: number, errorHandler: Function = null): Observable<EntityDataSet> {
        let request: XMLHttpRequest = new XMLHttpRequest();
        let url: string = `${this.apiUrl(type)}${type}/${id}`;
        request.open('GET', url, true);

        let subject: ReplaySubject<EntityDataSet> = new ReplaySubject<EntityDataSet>(1);

        this.addHeaders(request);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    subject.next(this.extractEntity(request.responseText));
                } else {
                    this.sendError(request.status, request.statusText, errorHandler, {
                        entityType: type,
                        entityId: id,
                        response: JSON.parse(request.responseText)
                    });
                }
            }
        };

        request.send();

        return subject;
    }


    paginatedLoadCollection(type: string, options: CollectionOptionsInterface, paginator: CollectionPaginator, errorHandler: Function = null): Observable<CollectionDataSet> {
        let request: XMLHttpRequest = new XMLHttpRequest();
        let url: string = `${this.apiUrl(type)}${type}`;

        if (options.urlExtension) {
            if (options.urlExtension.charAt(0) !== '/') {
                url += '/';
            }

            url += options.urlExtension;
        }

        let orderOptionsLength: number = options.orderOptions ? options.orderOptions.length : 0;

        let filtersLength: number = options.filter ? Object.keys(options.filter).length : 0;

        if (filtersLength > 0 || orderOptionsLength > 0 || options.offset || options.range || options.page) {
            url += '?';
        }

        let started = false;

        if (orderOptionsLength > 0) {
            started = true;
            url += 'sort=';

            options.orderOptions.forEach((option, index) => {
                url += (option.direction === OrderDirection.DESC ? '-' : '') + option.field;
                if (index < orderOptionsLength - 1) {
                    url += ',';
                }
            });
        }

        if (filtersLength > 0) {
            if (started) {
                url += '&';
            } else {
                started = true;
            }

            let keys: string[] = Object.keys(options.filter);

            keys.forEach((key: string, index: number) => {
                let val: any = options.filter[key];

                url += `filter[${key}]=${val}`;

                if (index < keys.length - 1) {
                    url += '&';
                }
            });
        }

        if (options.page) {
            if (started) {
                url += '&';
            } else {
                started = true;
            }

            url += 'page=' + options.page;
        }

        if (options.range) {
            if (started) {
                url += '&';
            } else {
                started = true;
            }

            url += 'range=' + options.range;
        }

        if (options.offset) {
            if (started) {
                url += '&';
            }

            url += 'offset=' + options.offset;
        }

        request.open('GET', url, true);

        this.addHeaders(request);

        let subject: ReplaySubject<CollectionDataSet> = new ReplaySubject<CollectionDataSet>(1);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    subject.next(this.extractCollection(request.responseText, paginator));
                } else {
                    this.sendError(request.status, request.statusText, errorHandler, {
                        response: JSON.parse(request.responseText)
                    });
                }
            }
        };

        request.send();

        return subject;
    }

    /**
     * Load a collection in http service
     * @param {string} type Endpoint name
     * @param {{[p: string]: any}} filter Filter Object
     * @param {Function} errorHandler Function used to handle errors
     * @returns {Observable<CollectionDataSet>} Observable returning the collection data
     */
    loadCollection(type: string, filter: { [key: string]: any } = {}, errorHandler: Function = null): Observable<CollectionDataSet> {
        let request: XMLHttpRequest = new XMLHttpRequest();

        let url: string = `${this.apiUrl(type)}${type}`;

        let filterKeys: string[] = Object.keys(filter);


        if(filterKeys.length === 1 && filterKeys[0] === 'id'){
            url += '/' + filter['id'];
        } else {
            if(filterKeys.length > 0) {
                url += '?';
            }

            filterKeys.forEach((key: string, index: number) => {
                let val: any = filter[key];
                url += `filter[${key}]=${val}`;

                if (index < filterKeys.length - 1) {
                    url += '&';
                }
            });
        }

        request.open('GET', url, true);

        this.addHeaders(request);

        let subject: ReplaySubject<CollectionDataSet> = new ReplaySubject<CollectionDataSet>(1);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    subject.next(this.extractCollection(request.responseText));
                } else {
                    this.sendError(request.status, request.statusText, errorHandler, {
                        response: JSON.parse(request.responseText)
                    });
                }
            }
        };

        request.send();

        return subject;
    }

    /**
     * Save entity to the http service
     * @param {EntityDataSet} entity Entity data to save
     * @param {string} type Endpoint name
     * @param {number} id Id of the entity
     * @param {Function} errorHandler Function used to handle errors
     * @returns {Observable<EntityDataSet>} Observable returning the entity data
     */
    saveEntity(entity: EntityDataSet, type: string, id: number, errorHandler: Function = null): Observable<EntityDataSet> {
        let request: XMLHttpRequest = new XMLHttpRequest();
        let url: string = `${this.apiUrl(type)}${type}/${id}`;
        request.open('PATCH', url, true);

        this.addHeaders(request);

        let subject: ReplaySubject<CollectionDataSet> = new ReplaySubject<EntityDataSet>(1);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    subject.next(this.extractEntity(request.responseText));
                } else {
                    this.sendError(request.status, request.statusText, errorHandler, {
                        response: JSON.parse(request.responseText)
                    });
                }
            }
        };

        request.send(JSON.stringify(entity));

        return subject;
    }

    /**
     * Create entity in http service
     * @param {string} type Endpoint name
     * @param {EntityDataSet} data Data used to create the entity
     * @param {Function} errorHandler Function used to handle errors
     * @returns {Observable<EntityDataSet>} Observable returning the entity data
     */
    createEntity(type: string, data: EntityDataSet, errorHandler: Function = null): Observable<EntityDataSet> {
        let request: XMLHttpRequest = new XMLHttpRequest();
        let url: string = `${this.apiUrl(type)}${type}`;
        request.open('POST', url, true);

        this.addHeaders(request);

        let subject: ReplaySubject<CollectionDataSet> = new ReplaySubject<EntityDataSet>(1);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    subject.next(this.extractEntity(request.responseText));
                } else {
                    this.sendError(request.status, request.statusText, errorHandler, {
                        response: JSON.parse(request.responseText)
                    });
                }
            }
        };

        request.send(JSON.stringify(data));

        return subject;
    }

    /**
     * Delete entity from http service
     * @param {string} type Endpoint type
     * @param {number} id Entity id
     * @param {Function} errorHandler Function used to handle errors
     * @returns {Observable<boolean>} True if deletion success
     */
    deleteEntity(type: string, id: number, errorHandler: Function = null): Observable<boolean> {
        let request: XMLHttpRequest = new XMLHttpRequest();
        let url: string = `${this.apiUrl(type)}${type}/${id}`;
        request.open('DELETE', url, true);

        this.addHeaders(request);

        let subject: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    subject.next(true);
                } else {
                    this.sendError(request.status, request.statusText, errorHandler, {
                        response: JSON.parse(request.responseText)
                    });
                }
            }
        };

        request.send();

        return subject;
    }

    /**
     * Authenticate in service
     * @param {string} login User login
     * @param {string} password User password
     * @param {Function} errorHandler Function used to handle errors
     * @returns {Observable<boolean>} True if authentication success
     */
    authenticate(login: string, password: string, errorHandler: Function = null): Observable<EntityDataSet> {
        let subject: ReplaySubject<EntityDataSet> = new ReplaySubject<EntityDataSet>(1);

        let request: XMLHttpRequest = new XMLHttpRequest();

        let url: string = `${<string> this.configuration.apiUrl}api/login-token`;
        request.open('GET', url, true);

        request.setRequestHeader('Authorization', 'Basic ' + btoa(login.trim() + ':' + password));

        let observables: Observable<any>[] = [];

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    let loginData: Object = JSON.parse(request.responseText);
                    let expire: number = +loginData['expires_in'] - 3600;
                    if (expire < 3600) {
                        if (localStorage.getItem(`${this.interfaceName}_accessToken`)) {
                            observables.push(this.setToken(loginData['access_token'], errorHandler));
                            this.setExpireDate(expire);
                            this.setRefreshToken(loginData['refresh_token']);
                        }
                        observables.push(this.refreshToken(loginData['refresh_token'], errorHandler));
                    } else {
                        observables.push(this.setToken(loginData['access_token'], errorHandler));
                        this.setExpireDate(expire);
                        this.setRefreshToken(loginData['refresh_token']);
                    }
                } else {
                    this.sendError(request.status, request.statusText, errorHandler, {
                        response: JSON.parse(request.responseText)
                    });
                }

                combineLatest(...observables).pipe(map((values: any[]) => {
                    return values[0];
                })).subscribe((data: EntityDataSet) => {
                    subject.next(data);
                });
            }
        };

        request.send();

        return subject;
    }

    logout(): Observable<boolean> {

        // TODO: revoir cette partie du logout
        /*let keys:string[] = Object.keys(this.headers);

        keys.forEach((headerName:string) => {
            if (headerName !== "access-token") {
                delete this.headers[headerName];
            }
        });*/

        localStorage.removeItem(`${this.interfaceName}_currentUser`);
        localStorage.removeItem(`${this.interfaceName}_accessToken`);
        localStorage.removeItem(`${this.interfaceName}_expires_in`);
        localStorage.removeItem(`${this.interfaceName}_refreshToken`);
        this.dataStore.user = null;

        return new BehaviorSubject(true);
    }


    /**
     *
     * @param {string} accessToken
     * @param {Function} errorHandler
     */
    private setToken(accessToken: string, errorHandler: Function = null): Observable<EntityDataSet> {
        if (accessToken && accessToken != '') {
            localStorage.setItem(`${this.interfaceName}_accessToken`, JSON.stringify(accessToken));
            this.headers['access-token'] = accessToken;

            return this.getMe(true, errorHandler);
        }
    }

    /**
     *
     * @param {number} expire
     */
    private setExpireDate(expire: number) {
        let date: number = Date.now();
        localStorage.setItem(`${this.interfaceName}_expires_in`, JSON.stringify(date + (expire * 1000)));
    }

    /**
     *
     * @param {string} refreshToken
     * @param {Function} errorHandler
     */
    private refreshToken(refreshToken: string, errorHandler: Function): Observable<Object> {

        let subject: ReplaySubject<Object> = new ReplaySubject<Object>(1);

        let request: XMLHttpRequest = new XMLHttpRequest();

        let url: string = `${<string> this.configuration.apiUrl}api/refresh-token/${refreshToken}`;
        request.open('GET', url, true);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    let userData: Object = JSON.parse(request.responseText);
                    this.setToken(userData['access_token'], errorHandler);
                    this.setExpireDate(+userData['expires_in'] - 3600);
                    this.setRefreshToken(userData['refresh_token']);
                    subject.next(userData);
                } else {
                    this.sendError(request.status, request.statusText, errorHandler, {
                        response: JSON.parse(request.responseText)
                    });
                }
            }
        };

        request.send();

        return subject;
    }

    /**
     *
     * @param {string} refreshToken
     */
    private setRefreshToken(refreshToken: string) {
        localStorage.setItem(`${this.interfaceName}_refreshToken`, JSON.stringify(refreshToken));
    }


    /**
     *
     * @param {boolean} complete
     * @param {Function} errorHandler
     * @returns {Observable<EntityDataSet>}
     */
    getMe(complete: boolean = true, errorHandler: Function = null): Observable<EntityDataSet> {

        let subject: ReplaySubject<EntityDataSet> = new ReplaySubject<EntityDataSet>(1);

        let request: XMLHttpRequest = new XMLHttpRequest();

        let url: string = `${<string> this.configuration.apiUrl}api/users/me`;
        request.open('GET', url, true);
        this.addHeaders(request);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    let userData: Object = JSON.parse(request.responseText)['data'][0];
                    subject.next(userData);
                    this.setMe(userData, complete);
                } if (request.status === 401) {
                    subject.error(request.status);
                } else {
                    if (errorHandler) {
                        this.sendError(request.status, request.statusText, errorHandler, {
                            response: JSON.parse(request.responseText)
                        });
                    }

                    subject.error(null);
                }
            }
        };

        request.send();

        return subject;
    }

    /**
     *
     * @param {EntityDataSet} userData
     * @param {boolean} complete
     */
    setMe(userData: EntityDataSet, complete: boolean = true) {

        if (complete) {
            this.dataStore.user = userData;
            //this.data.next(this.dataStore.user);
            localStorage.setItem(`${this.interfaceName}_currentUser`, JSON.stringify(userData));
        }

        //this.currentUserData = userData;
    }

    /**
     * Extract entity data from raw data
     * @param {string} responseText Response text from server
     * @returns {EntityDataSet} Entity data
     */
    protected extractEntity(responseText: string): EntityDataSet {
        let data: Object = JSON.parse(responseText);

        // pas sûr que ce code serve
        if (data['data'][0] && data['data'][0]['id'] !== undefined) {
            data['data'][0]['id'] = data['data'][0]['id'];
        }

        if (data['data'] && data['data']['id'] !== undefined) {
            data['data']['id'] = data['data']['id'];
        }

        if (data['data'][0]) {
            return data['data'][0];
        } else {
            return data['data'];
        }

    }

    /**
     * Extract collection data from raw data
     * @param {string} responseText Response text from server
     * @returns {CollectionDataSet} Collection data
     */
    protected extractCollection(responseText: string, paginator: CollectionPaginator = null): CollectionDataSet {
        let data: Object = JSON.parse(responseText);

        if (paginator) {
            paginator.updateCount(+data['count']);
        }


        let collectionData: CollectionDataSet = {};

        data['data'].forEach((entityData: EntityDataSet) => {

            // ?????
            entityData['id'] = entityData['id'];

            collectionData['_' + entityData['id']] = entityData;
        });

        return collectionData;
    }

    /**
     * Callback appelé lors du déclanchement d'un event de type StorageEvent. Cela n'a lieu que si le localstorage a été modifié depuis une autre page.
     * Dans ce cas, nous controllons s'il s'agit d'une déconnexion pour notifier ensuite les abonnées a OnUnexpectedLogout
     * @param event
     * @return
     */
    private OnUnexpectedStorageChange(event: StorageEvent) {
        if (
            event.key === `${this.interfaceName}_accessToken`
            && event.newValue === null
            && event.oldValue !== null
        ) {
            this.unexpectedLogoutSubject.next();
        }
    }
}
