
import {map} from 'rxjs/operators';
import {ExternalInterface} from "../abstract-external-interface.class";
import {DataConnector} from "../../data-connector.class";
import {NodejsConfiguration} from "./nodejs-configuration.interface";
import {Observable, ReplaySubject} from "rxjs";
import {CollectionDataSet, EntityDataSet, FilterData} from "../../types";
import * as ObjectHash from "object-hash";
import * as io from 'socket.io-client';

/**
 * Nodejs interface
 */
export class Nodejs extends ExternalInterface {

    private messagePrefix:string;
    private retrieveEvent:string;
    private connectionCommand:string;
    private socket:any;

    private errorsStore:{[key:number]:Function} = {};
    private collectionsErrorStore:{[key:number]:Function} = {};

    private connected:boolean = true;

    private collectionSubjects:{[key:string]:{[key:string]:ReplaySubject<CollectionDataSet>}} = {};
    private dataCollections:{[key:string]:{[key:string]:CollectionDataSet}} = {};
    private collectionFilters:{[key:string]:{[key:string]:FilterData}} = {};

    //private temporaryCollectionsStore:{[key:string]:ReplaySubject<CollectionDataSet>} = {};

    /**
     * Create the nodejs interface
     * @param {NodejsConfiguration} configuration Interface configuration object
     * @param {DataConnector} connector Reference to the connector
     */
    constructor(
      private configuration:NodejsConfiguration,
      private connector:DataConnector
    ) {
        super();
        this.messagePrefix = this.configuration.messagePrefix || "message";
        this.retrieveEvent = this.configuration.retrievePrefix || "retrieve_";
        this.connectionCommand = this.configuration.connectionCommand || "connexion";

        this.maxRetry = 1000;

        this.initializeSocket();
    }


    clear(): void {
        this.errorsStore = {};
        this.collectionsErrorStore = {};

        this.collectionSubjects = {};
        this.dataCollections = {};
        this.collectionFilters = {};
    }

    private initializeSocket(forced:boolean = false) {

        if (this.socket && !forced) {
            return;
        }

        if (this.socket) {
            this.socket.disconnect();
            this.socket.close();
        }

        this.socket = io(this.configuration.socketUrl);

        this.socket.on('connect_failed', function(){
            console.log('Connection Failed');
        });

        this.socket.on('connect_error', (e) => {
            console.log('Connection Error');
        });

        this.socket.on('connect', () => {
            console.log('Connected');
            this.connected = true;
        });

        this.socket.on('reconnecting', () => {
            console.log('reconnecting');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected');
            this.connected = false;
            this.dispatchErrors();
        });

        this.socket.on(this.messagePrefix, (data:Object[]) => {
            if (data["id"] && data["data"]) {
                data["data"]["id"] = data["id"];
            }

            if (data['command'] === "put") {
                this.connector.registerEntityByData(data["type"], data["id"] || data["data"]["id"] , data['data']);

                if (data["type"] === this.connector.configuration.liveRefreshService) {
                    this.connector.refreshCollectionWithData(data["data"]["myType"], data["data"]);
                }
            }

            if (data['command'] === "update") {
                this.connector.registerEntityByData(data["type"], data["id"] || data["data"]["id"], data['data']);
            }

            if (data['command'] === "delete") {
                this.connector.unregisterEntityTypeAndId(data["type"], data["id"]);
            }
        });
    }

    /**
     * Send interface errors
     */
    private dispatchErrors() {
        // error managing
        for (let id in this.errorsStore) {
            if (this.errorsStore.hasOwnProperty(id)) {
                this.sendError(0, "", this.errorsStore[id]);
                delete this.errorsStore[id];
            }
        }

        for (let id in this.collectionsErrorStore) {
            if (this.collectionsErrorStore.hasOwnProperty(id)) {
                this.sendError(0, "", this.collectionsErrorStore[id]);
                //delete this.collectionsErrorStore[id];
            }
        }
    }

    /**
     * Load entity in nodejs service
     * @param {string} type Endpoint name
     * @param {number} id Id of the entity
     * @param {Function} errorHandler Function used to handle errors
     * @returns {Observable<EntityDataSet>} Observable returning the data
     */
    loadEntity(type:string, id:number, errorHandler:Function):Observable<EntityDataSet> {
        if (!this.connected) {
            this.sendError(0, '', errorHandler);
        }

        return this.loadCollection(type, {
            id: id
        }).pipe(map((data: CollectionDataSet) => {
            return data[0];
        }))
    }

    saveEntity(data:EntityDataSet, type:string, id:number, errorHandler:Function = null):Observable<EntityDataSet> {

        let subject: ReplaySubject<EntityDataSet> = new ReplaySubject<EntityDataSet>(1);

        let cid: number = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

        if (!this.connected) {
            this.sendError(0, '', errorHandler);
        } else {
            this.errorsStore[cid] = errorHandler;

            let requestData:Object = {
                command: "update",
                data: data,
                id: id,
                type: type,
                cid: cid
            };

            this.socket.emit("message", requestData);
        }

        return subject;
    }

    /**
     * Load a collection in nodejs service
     * @param {string} type Endpoint name
     * @param {{[p: string]: any}} filter Filter Object
     * @param {Function} errorHandler Function used to handle errors
     * @returns {Observable<CollectionDataSet>} Observable returning the collection data
     */
    loadCollection(type:string, filter:{[key:string]:any} = {}, errorHandler:Function = null):Observable<CollectionDataSet> {

        // à voir si il y a besoin d'initialiser
        //this.initializeSocket();

        let hash:string = ObjectHash(filter);
        let subject:ReplaySubject<CollectionDataSet> = new ReplaySubject<CollectionDataSet>(1);

        if (!this.dataCollections[type]) {
            this.dataCollections[type] = {};
        }

        if (!this.collectionFilters[type]) {
            this.collectionFilters[type] = {};
        }

        if (!this.collectionSubjects[type]) {
            this.collectionSubjects[type] = {};
        }

        this.collectionSubjects[type][hash] = subject;
        this.collectionFilters[type][hash] = filter;

        if (!this.connected) {
            this.sendError(0, '', errorHandler);
        } else {

            let cid:number = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

            let evtName:string = this.retrieveEvent + type;

            this.socket.emit('connexion', type, filter, cid);

            let callback:Function = (data:CollectionDataSet) => {
                let res: CollectionDataSet = {};

                for (let id in data) {
                    let mid: number = data[id]["data"]["id"] || data[id]["id"];
                    res[mid] = data[id]["data"];
                }

                this.dataCollections[type][hash] = res;

                subject.next(res);

                this.socket.off(evtName, callback);
            };

            this.socket.off(evtName, callback);

            this.collectionsErrorStore[cid] = errorHandler;
            this.socket.on(evtName, callback);
        }

        return subject;
    }

    /**
     * Create entity in nodejs service
     * @param {string} type Endpoint name
     * @param {EntityDataSet} data Data used to create the entity
     * @param {Function} errorHandler Function used to handle errors
     * @returns {Observable<EntityDataSet>} Observable returning the entity data
     */
    createEntity(type:string, data:EntityDataSet, errorHandler:Function = null):Observable<EntityDataSet> {

        let subject:ReplaySubject<EntityDataSet> = new ReplaySubject<EntityDataSet>(1);

        let cid: number = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        let id: number = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

        this.errorsStore[cid] = errorHandler;

        if (!this.connected) {
            this.sendError(0, '', errorHandler);
        } else {
            let requestData:Object = {
                command: "put",
                data: data,
                type: type,
                cid: cid,
                id: id
            };

            this.socket.emit("message", requestData);
        }

        return subject;
    }

    /**
     * Delete entity from nodejs service
     * @param {string} type Endpoint type
     * @param {number} id Entity id
     * @param {Function} errorHandler Function used to handle errors
     * @returns {Observable<boolean>} True if deletion success
     */
    deleteEntity(type:string, id:number, errorHandler:Function = null):Observable<boolean> {

        let subject:ReplaySubject<boolean> = new ReplaySubject<boolean>(1);

        let cid: number = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

        this.errorsStore[cid] = errorHandler;

        if (!this.connected) {
            this.sendError(0, '', errorHandler);
        } else {
            let requestData:Object = {
                command: "delete",
                id: id,
                type: type,
                cid: cid
            };

            this.socket.emit("message", requestData);
        }

        return subject;
    }
}
