import {combineLatest as observableCombineLatest, Observable, ReplaySubject} from 'rxjs';

import {map} from 'rxjs/operators';
import {ExternalInterface} from '../abstract-external-interface.class';
import {DataConnector} from '../../data-connector.class';
import {HttpConfiguration} from '../http/http-configuration.interface';
import {CollectionDataSet, EntityDataSet} from '../../types';
import {Drupal8Configuration} from './drupal8-configuration.interface';

/**
 * Http external interface
 */
export class Drupal8<T extends { [key: string]: any }> extends ExternalInterface<T> {

    /**
     *
     */
    // authenticated:ReplaySubject<EntityDataSet<T>>;

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
     * @param configuration Configuration object
     * @param connector Reference to the connector
     */
    constructor(
        private configuration: Drupal8Configuration,
        private connector: DataConnector,
        private interfaceName: string
    ) {
        super();
        this.useDiff = true;

        if (configuration.headers) {
            for (const header in configuration.headers) {
                if (configuration.headers.hasOwnProperty(header)) {
                    this.headers[header] = configuration.headers[header];
                }
            }
        }

        this.dataStore = {
            user: undefined
        };


    }

    /**
     * Is the user authenticated on this service ?
     * @returns {Observable<EntityDataSet<T>>}
     */
    get authenticated(): Observable<EntityDataSet<T>> {
        const value: ReplaySubject<EntityDataSet<T>> = new ReplaySubject<EntityDataSet<T>>(1);

        this.dataStore.user = JSON.parse(localStorage.getItem(`${this.interfaceName}_currentUser`));
        const expire: number = JSON.parse(localStorage.getItem(`${this.interfaceName}_expires_in`));
        if (expire > Date.now()) {
            this.dataStore.user = JSON.parse(localStorage.getItem(`${this.interfaceName}_currentUser`));
            this.setToken(JSON.parse(localStorage.getItem(`${this.interfaceName}_accessToken`))).subscribe((data: EntityDataSet<T>) => {
                value.next(data);
            });
        } else if (expire && expire < Date.now()) {
            value.error(null);
            this.logOut();
        } else {
            value.error(null);
        }

        return value;
    }

    /**
     * Add headers to the request
     * @param request A xhr request
     */
    private addHeaders(request: XMLHttpRequest) {
        for (const headerName in this.headers) {
            request.setRequestHeader(headerName, this.headers[headerName]);
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
        const url = `${this.configuration.apiUrl as string}${type}/${id}`;
        request.open('GET', url, true);

        const subject: ReplaySubject<EntityDataSet<T>> = new ReplaySubject<EntityDataSet<T>>(1);

        this.addHeaders(request);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    subject.next(this.extractEntity(request.responseText));
                } else {
                    this.sendError(request.status, request.statusText, errorHandler);
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

        let url = `${this.configuration.apiUrl as string}${type}`;

        const filterKeys: string[] = Object.keys(filter);

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

        request.open('GET', url, true);

        this.addHeaders(request);

        const subject: ReplaySubject<CollectionDataSet<T>> = new ReplaySubject<CollectionDataSet<T>>(1);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    subject.next(this.extractCollection(request.responseText));
                } else {
                    this.sendError(request.status, request.statusText, errorHandler);
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
        const url = `${this.configuration.apiUrl as string}${type}/${id}`;
        request.open('PATCH', url, true);

        this.addHeaders(request);

        const subject = new ReplaySubject<EntityDataSet<T>>(1);

        const saveObject = {
            data: {
                id,
                type,
                attributes: entity
            }
        };

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    subject.next(this.extractEntity(request.responseText));
                } else {
                    this.sendError(request.status, request.statusText, errorHandler);
                }
            }
        };

        request.send(JSON.stringify(saveObject));

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
        const url = `${this.configuration.apiUrl as string}${type}`;
        request.open('POST', url, true);

        this.addHeaders(request);

        const addObject = {
            data: {
                attributes: data,
                type
            }
        };

        const subject = new ReplaySubject<EntityDataSet<T>>(1);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 201) {
                    subject.next(this.extractEntity(request.responseText));
                } else {
                    this.sendError(request.status, request.statusText, errorHandler);
                }
            }
        };

        request.send(JSON.stringify(addObject));

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
        const url = `${this.configuration.apiUrl as string}${type}/${id}`;
        request.open('DELETE', url, true);

        this.addHeaders(request);

        const subject: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 204) {
                    subject.next(true);
                } else {
                    this.sendError(request.status, request.statusText, errorHandler);
                }
            }
        };

        request.send();

        return subject;
    }


    getOauthToken(login: string, password: string): Observable<Object> {
        const subject: ReplaySubject<Object> = new ReplaySubject<Object>(1);

        const req: XMLHttpRequest = new XMLHttpRequest();
        const url = `${this.configuration.apiUrl as string}oauth/token`;

        req.open('POST', url, true);

        req.onreadystatechange = () => {
            if (req.readyState === XMLHttpRequest.DONE) {
                if (req.status === 200) {
                    subject.next(JSON.parse(req.responseText));
                } else {
                    subject.error(req.responseText);
                }
            }
        };

        const data: any = {
            grant_type: 'password',
            client_id: this.configuration.clientId,
            userName: login,
            password,
            scope: this.configuration.scope || 'administrator angular'
        };

        if (this.configuration.clientSecret) {
            data.client_secret = this.configuration.clientSecret;
        }

        req.send(data);

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

        const url = `${this.configuration.apiUrl as string}oauth/token`;
        request.open('POST', url, true);

        request.setRequestHeader('content-type', 'application/x-www-form-urlencoded');


        // request.setRequestHeader("Authorization", 'Basic ' + btoa(login.trim() + ':' + password));

        const observables: Observable<any>[] = [];

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {

                    localStorage[`${this.interfaceName}_userName`] = login;

                    const loginData = JSON.parse(request.responseText);
                    const expire: number = +loginData.expires_in - 3600;
                    if (expire < 3600) {
                        if (localStorage.getItem(`${this.interfaceName}_accessToken`)) {
                            observables.push(this.setToken(loginData.access_token, errorHandler));
                            this.setExpireDate(expire);
                            this.setRefreshToken(loginData.refresh_token);
                        }
                        observables.push(this.refreshToken(loginData.refresh_token, errorHandler));
                    } else {
                        observables.push(this.setToken(loginData.access_token, errorHandler));
                        this.setExpireDate(expire);
                        this.setRefreshToken(loginData.refresh_token);
                    }
                } else {
                    this.sendError(request.status, request.statusText, errorHandler);
                }

                observableCombineLatest(...observables).pipe(map((values: any[]) => {
                    return values[0];
                })).subscribe((data: EntityDataSet<T>) => {
                    subject.next(data);
                });
            }
        };

        const data = {
            grant_type: 'password',
            client_id: this.configuration.clientId,
            username: login,
            password,
            scope: this.configuration.scope || 'administrator angular',
            client_secret: undefined
        };

        if (this.configuration.clientSecret) {
            data.client_secret = this.configuration.clientSecret;
        } else {
            delete data.client_secret;
        }

        let dataStr = '';

        for (const id in data) {
            dataStr += id + '=' + data[id] + '&';
        }

        request.send(dataStr);

        return subject;
    }

    logOut() {

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
    }


    /**
     *
     * @param accessToken
     * @param errorHandler
     */
    private setToken(accessToken: string, errorHandler: Function = null): Observable<EntityDataSet<T>> {
        if (accessToken && accessToken != '') {
            localStorage.setItem(`${this.interfaceName}_accessToken`, JSON.stringify(accessToken));
            this.headers.Authorization = 'Bearer ' + accessToken;

            return this.getMe(true, errorHandler);
        }
    }

    /**
     *
     * @param expire
     */
    private setExpireDate(expire: number) {
        const date: number = Date.now();
        localStorage.setItem(`${this.interfaceName}_expires_in`, JSON.stringify(date + (expire * 1000)));
    }

    /**
     *
     * @param refreshToken
     * @param errorHandler
     */
    private refreshToken(refreshToken: string, errorHandler: Function): Observable<Object> {

        const subject: ReplaySubject<Object> = new ReplaySubject<Object>(1);

        const request: XMLHttpRequest = new XMLHttpRequest();

        const url = `${this.configuration.apiUrl as string}refresh-token/${refreshToken}`;
        request.open('GET', url, true);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    const userData = JSON.parse(request.responseText);
                    this.setToken(userData.access_token, errorHandler);
                    this.setExpireDate(+userData.expires_in - 3600);
                    this.setRefreshToken(userData.refresh_token);
                    subject.next(userData);
                } else {
                    this.sendError(request.status, request.statusText, errorHandler);
                }
            }
        };

        request.send();

        return subject;
    }

    /**
     *
     * @param refreshToken
     */
    private setRefreshToken(refreshToken: string) {
        localStorage.setItem(`${this.interfaceName}_refreshToken`, JSON.stringify(refreshToken));
    }


    /**
     *
     * @param complete
     * @param errorHandler
     * @returns {Observable<EntityDataSet<T>>}
     */
    getMe(complete: boolean = true, errorHandler: Function = null): Observable<EntityDataSet<T>> {

        const subject: ReplaySubject<EntityDataSet<T>> = new ReplaySubject<EntityDataSet<T>>(1);

        const request: XMLHttpRequest = new XMLHttpRequest();

        const url = `${this.configuration.apiUrl as string}user?filter[name][value]=${localStorage[`${this.interfaceName}_userName`]}`;
        request.open('GET', url, true);
        this.addHeaders(request);

        request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    const userData = JSON.parse(request.responseText).data[0].attributes;
                    userData.id = userData.uuid;
                    subject.next(userData);
                    this.setMe(userData, complete);
                } else {
                    if (errorHandler) {
                        this.sendError(request.status, request.statusText, errorHandler);
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
     * @param userData
     * @param complete
     */
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
        const data = JSON.parse(responseText).data.attributes;
        data.id = data.uuid;
        return data;
    }

    /**
     * Extract collection data from raw data
     * @param responseText Response text from server
     * @returns Collection data
     */
    protected extractCollection(responseText: string): CollectionDataSet<T> {
        const data = JSON.parse(responseText);

        const collectionData: CollectionDataSet<T> = {};

        data.data.forEach((entityData: EntityDataSet<T>) => {
            entityData.attributes.id = entityData.attributes.uuid;
            collectionData[entityData.attributes.uuid] = entityData.attributes;
        });

        return collectionData;
    }
}
