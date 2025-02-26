import {map} from 'rxjs/operators';
import {ExternalInterface} from '../abstract-external-interface.class';
import {DataConnector} from '../../data-connector.class';
import {HttpConfiguration} from './http-configuration.interface';
import {BehaviorSubject, combineLatest, Observable, ReplaySubject} from 'rxjs';
import {CollectionDataSet, EntityDataSet} from '../../types';
import {EndpointConfig} from '../../endpoint-config.interface';
import {CollectionOptionsInterface} from '../../collection-options.interface';
import {CollectionPaginator} from '../../collection-paginator.class';
import {OrderDirection} from '../../order-direction.enum';

/**
 * Http external interface
 */
export class Http<T extends { [key: string]: any }> extends ExternalInterface<T> {

    private dataStore: {
        user
    };

    /**
     * Headers sent with each request
     */
    private headers: { [key: string]: string } = {};

    /**
     * Creates the http interface
     * @param configuration Configuration object
     * @param connector Reference to the connector
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
            for (const header in this.configuration.headers) {
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
     */
    get authenticated(): Observable<EntityDataSet<T>> {
        const value: ReplaySubject<EntityDataSet<T>> = new ReplaySubject<EntityDataSet<T>>(1);

        this.dataStore.user = JSON.parse(localStorage.getItem(`${this.interfaceName}_currentUser`));
        const expire: number = JSON.parse(localStorage.getItem(`${this.interfaceName}_expires_in`));
        if (expire > Date.now()) {
            this.dataStore.user = JSON.parse(localStorage.getItem(`${this.interfaceName}_currentUser`));
            this.setToken(JSON.parse(localStorage.getItem(`${this.interfaceName}_accessToken`))).subscribe((data: EntityDataSet<T>) => {
                value.next(data);
            }, (err) => {
                value.error(err);
            });
        } else if (expire && expire < Date.now()) {
            value.error('Token expired');
            this.logout();
        } else {
            value.error('Not authenticated');
        }

        return value;
    }

    /**
     * Add headers to the request
     * @param request A xhr request
     * @param type the endpoint use to find a specific header configuration about the endpoint
     * @param method used to determine if we can do a preflight proof request
     */
    private addHeaders(request: XMLHttpRequest, type: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE') {
        const endPointConf: string | EndpointConfig = this.connector.getEndpointConfiguration(type);
        const isAuthFree = !!endPointConf && typeof endPointConf !== 'string' && !!endPointConf.authenticationFree;
        const availableForPreflightProofContentType = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];
        const isShouldBePreflightProof = isAuthFree && method === 'GET';
        const isItPreflightProofHeader = (headerValue: string) => availableForPreflightProofContentType.includes(headerValue);

        for (const headerName in this.headers) {
            if (this.headers.hasOwnProperty(headerName)) {
                if (headerName.toLocaleLowerCase() === 'access-token' && isAuthFree) {
                    // do nothing to avoid access-token header
                } else if (headerName.toLocaleLowerCase() === 'content-type'
                    && isShouldBePreflightProof
                    && isItPreflightProofHeader(this.headers[headerName]) === false) {
                    // replace the content-type to a preflight proof content-type
                    request.setRequestHeader('content-type', 'text/plain');
                } else {
                    request.setRequestHeader(headerName, this.headers[headerName]);
                }
            }
        }
    }

    private apiUrl(endpointName: string): string {

        const useApi: boolean = !this.configuration.useApiExtension === false;

        const ext: string = useApi ? 'api/' : '';

        const endPointConf: string | EndpointConfig = this.connector.getEndpointConfiguration(endpointName);

        let useLanguage = false;

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
     * @param type Endpoint name
     * @param id Id of the entity
     * @param errorHandler Function used to handle errors
     * @returns Observable returning the data
     */
    loadEntity(type: string, id: number, errorHandler: Function = null): Observable<EntityDataSet<T>> {
        const request: XMLHttpRequest = new XMLHttpRequest();
        const url = `${this.apiUrl(type)}${type}/${id}`;
        request.open('GET', url, true);

        const subject: ReplaySubject<EntityDataSet<T>> = new ReplaySubject<EntityDataSet<T>>(1);

        this.addHeaders(request, type, 'GET');

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


    paginatedLoadCollection(type: string, options: CollectionOptionsInterface, paginator: CollectionPaginator<T>, errorHandler: Function = null): Observable<CollectionDataSet<T>> {
        const request: XMLHttpRequest = new XMLHttpRequest();
        let url = `${this.apiUrl(type)}${type}`;

        if (options.urlExtension) {
            if (options.urlExtension.charAt(0) !== '/') {
                url += '/';
            }

            url += options.urlExtension;
        }

        const orderOptionsLength: number = options.orderOptions ? options.orderOptions.length : 0;

        const filtersLength: number = options.filter ? Object.keys(options.filter).length : 0;

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

            const keys: string[] = Object.keys(options.filter);

            keys.forEach((key: string, index: number) => {
                const val: any = options.filter[key];

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

        this.addHeaders(request, type, 'GET');

        const subject = new ReplaySubject<CollectionDataSet<T>>(1);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    const promise = this.extractCollection(request.responseText, paginator);
                    promise.then((rest) => {
                        subject.next(rest);
                    }).catch((error: any) => {
                        console.error(error);
                    });
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
     * @param type Endpoint name
     * @param filter Filter Object
     * @param errorHandler Function used to handle errors
     * @returns Observable returning the collection data
     */
    loadCollection(type: string, filter: { [key: string]: any } = {}, errorHandler: Function = null): Observable<CollectionDataSet<T>> {
        const request: XMLHttpRequest = new XMLHttpRequest();

        let url = `${this.apiUrl(type)}${type}`;

        const filterKeys: string[] = Object.keys(filter);


        if (filterKeys.length === 1 && filterKeys[0] === 'id') {
            url += '/' + filter.id;
        } else {
            if (filterKeys.length > 0) {
                url += '?';
            }

            filterKeys.forEach((key: string, index: number) => {
                const val: any = filter[key];
                url += `filter[${key}]=${val}`;

                if (index < filterKeys.length - 1) {
                    url += '&';
                }
            });
        }

        request.open('GET', url, true);

        this.addHeaders(request, type, 'GET');

        const subject = new ReplaySubject<CollectionDataSet<T>>(1);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    const promise = this.extractCollection(request.responseText);
                    promise.then((rest) => {
                        subject.next(rest);
                    }).catch((error: any) => {
                        console.error(error);
                    });
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
     * @param entity Entity data to save
     * @param type Endpoint name
     * @param id Id of the entity
     * @param errorHandler Function used to handle errors
     * @returns Observable returning the entity data
     */
    saveEntity(entity: EntityDataSet, type: string, id: number, errorHandler: Function = null): Observable<EntityDataSet<T>> {
        const request: XMLHttpRequest = new XMLHttpRequest();
        const url = `${this.apiUrl(type)}${type}/${id}`;
        request.open('PATCH', url, true);

        this.addHeaders(request, type, 'PATCH');

        const subject = new ReplaySubject<EntityDataSet<T>>(1);

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
     * @param type Endpoint name
     * @param data Data used to create the entity
     * @param errorHandler Function used to handle errors
     * @returns Observable returning the entity data
     */
    createEntity(type: string, data: EntityDataSet<any>, errorHandler: Function = null): Observable<EntityDataSet<T>> {
        const request: XMLHttpRequest = new XMLHttpRequest();
        const url = `${this.apiUrl(type)}${type}`;
        request.open('POST', url, true);

        this.addHeaders(request, type, 'POST');

        const subject = new ReplaySubject<EntityDataSet<T>>(1);

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
     * @param type Endpoint type
     * @param id Entity id
     * @param errorHandler Function used to handle errors
     * @returns True if deletion success
     */
    deleteEntity(type: string, id: number, errorHandler: Function = null): Observable<boolean> {
        const request: XMLHttpRequest = new XMLHttpRequest();
        const url = `${this.apiUrl(type)}${type}/${id}`;
        request.open('DELETE', url, true);

        this.addHeaders(request, type, 'DELETE');

        const subject: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);

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
     * @param login User login
     * @param password User password
     * @param errorHandler Function used to handle errors
     * @returns True if authentication success
     */
    authenticate(login: string, password: string, errorHandler: Function = null): Observable<EntityDataSet<T>> {
        const subject: ReplaySubject<EntityDataSet<T>> = new ReplaySubject<EntityDataSet<T>>(1);

        const request: XMLHttpRequest = new XMLHttpRequest();

        const url = `${this.configuration.apiUrl as string}api/login-token`;
        console.log('http.class::460::authenticate', url)
        request.open('GET', url, true);

        request.setRequestHeader('Authorization', 'Basic ' + btoa(login.trim() + ':' + password));
        console.log('http.class::464::authenticate', login, password, btoa(login.trim() + ':' + password))
        const observables: Observable<any>[] = [];

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    const loginData: any = JSON.parse(request.responseText);
                    console.log('http.class::471::onreadystatechange', request);
                    const expire: number = +loginData.expires_in - 3600;
                    if (expire < 3600) {
                        console.log('http.class::474::onreadystatechange', 'expire < 3600', expire)
                        if (localStorage.getItem(`${this.interfaceName}_accessToken`)) {
                            observables.push(this.setToken(loginData.access_token, errorHandler));
                            this.setExpireDate(expire);
                            this.setRefreshToken(loginData.refresh_token);
                        }
                        observables.push(this.refreshToken(loginData.refresh_token, errorHandler));
                    } else {
                        console.log('http.class::482::onreadystatechange', 'expire > 3600', expire)
                        observables.push(this.setToken(loginData.access_token, errorHandler));
                        this.setExpireDate(expire);
                        this.setRefreshToken(loginData.refresh_token);
                    }
                } else {
                    console.log('http.class::488::onreadystatechange', 'error', request.status, request.statusText, JSON.parse(request.responseText))
                    this.sendError(request.status, request.statusText, errorHandler, {
                        response: JSON.parse(request.responseText)
                    });
                }

                combineLatest(...observables).pipe(map((values: any[]) => {
                    return values[0];
                })).subscribe(
                    (data: EntityDataSet<T>) => {
                        subject.next(data);
                    },
                    (err) => {
                        subject.error(err);
                    }
                );
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
        if (this.headers.hasOwnProperty('access-token')) {
            delete this.headers['access-token'];
        }

        this.dataStore.user = null;

        return new BehaviorSubject(true);
    }


    private setToken(accessToken: string, errorHandler: Function = null): Observable<EntityDataSet<T>> {
        if (accessToken && accessToken != '') {
            localStorage.setItem(`${this.interfaceName}_accessToken`, JSON.stringify(accessToken));
            this.headers['access-token'] = accessToken;

            return this.getMe(true, errorHandler);
        }
    }

    private setExpireDate(expire: number) {
        const date: number = Date.now();
        localStorage.setItem(`${this.interfaceName}_expires_in`, JSON.stringify(date + (expire * 1000)));
    }

    private refreshToken(refreshToken: string, errorHandler: Function): Observable<Object> {

        const subject: ReplaySubject<Object> = new ReplaySubject<Object>(1);

        const request: XMLHttpRequest = new XMLHttpRequest();

        const url = `${this.configuration.apiUrl as string}api/refresh-token/${refreshToken}`;
        request.open('GET', url, true);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    const userData: any = JSON.parse(request.responseText);
                    this.setToken(userData.access_token, errorHandler);
                    this.setExpireDate(+userData.expires_in - 3600);
                    this.setRefreshToken(userData.refresh_token);
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

    private setRefreshToken(refreshToken: string) {
        localStorage.setItem(`${this.interfaceName}_refreshToken`, JSON.stringify(refreshToken));
    }


    getMe(complete: boolean = true, errorHandler: Function = null): Observable<EntityDataSet<T>> {
        const subject: ReplaySubject<EntityDataSet<T>> = new ReplaySubject<EntityDataSet<T>>(1);

        const request: XMLHttpRequest = new XMLHttpRequest();

        const url = `${this.configuration.apiUrl as string}api/users/me`;
        request.open('GET', url, true);
        this.addHeaders(request, 'users/me', 'GET');

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    const userData: any = JSON.parse(request.responseText).data[0];
                    subject.next(userData);
                    this.setMe(userData, complete);
                } else if (request.status === 401) {
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

    setMe(userData: EntityDataSet, complete: boolean = true) {

        if (complete) {
            this.dataStore.user = userData;
            // this.data.next(this.dataStore.user);
            localStorage.setItem(`${this.interfaceName}_currentUser`, JSON.stringify(userData));
        }

        // this.currentUserData = userData;
    }

    /**
     * Extract entity data from raw data
     * @param responseText Response text from server
     * @returns Entity data
     */
    protected extractEntity(responseText: string): EntityDataSet<T> {
        const data: any = JSON.parse(responseText);

        // pas sûr que ce code serve
        if (data.data[0] && data.data[0].id !== undefined) {
            data.data[0].id = data.data[0].id;
        }

        if (data.data && data.data.id !== undefined) {
            data.data.id = data.data.id;
        }

        if (data.data[0]) {
            return data.data[0];
        } else {
            return data.data;
        }

    }

    /**
     * Extract collection data from raw data
     * @param responseText Response text from server
     * @returns Collection data
     */
    protected extractCollection(responseText: string, paginator: CollectionPaginator<T> = null): Promise<CollectionDataSet<T>> {
        const data: any = JSON.parse(responseText);
        const collectionData: CollectionDataSet<T> = {};

        data.data.forEach((entityData: EntityDataSet<T>) => {
            collectionData['_' + entityData.id] = entityData;
        });

        if (paginator) {
            return paginator.updateCount(+data.count).then(() => {
                return collectionData;
            });
        } else {
            return Promise.resolve(collectionData);
        }
    }



    /**
     * Callback appelé lors du déclanchement d'un event de type StorageEvent. Cela n'a lieu que si le localstorage a été modifié depuis une autre page.
     * Dans ce cas, nous controllons s'il s'agit d'une déconnexion pour notifier ensuite les abonnées a OnUnexpectedLogout
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
