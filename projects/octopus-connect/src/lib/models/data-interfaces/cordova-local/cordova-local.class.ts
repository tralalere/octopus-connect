import {ExternalInterface} from '../abstract-external-interface.class';
import {CordovaLocalConfiguration} from './cordova-local-configuration.interface';
import {DataConnector} from '../../data-connector.class';
import {CollectionDataSet, EntityDataSet, FilterData} from '../../types';
import {Observable, ReplaySubject} from 'rxjs';

declare var window: any;
declare var cordova: any;
declare var device: any;
declare var LocalFileSystem: any;

export class CordovaLocal<T extends { [key: string]: any }> extends ExternalInterface<T> {

    fileSystem: any;
    private dataStore: CollectionDataSet<T> = {};

    constructor(
        private configuration: CordovaLocalConfiguration,
        private connector: DataConnector,
        private interfaceName: string
    ) {
        super();

        // this.loadPointFromStorage("ideaswall");
    }

    private createFile(
        dirEntry,
        fileName: string,
        text: string,
        isAppend: boolean,
        success: Function,
        fail: Function
    ) {
        dirEntry.getFile(fileName, {create: true, exclusive: false}, fileEntry => {

            this.writeFile(fileEntry, text, e => {
                success(e);
            }, e => fail(e));

        }, e => {
            fail(e);
        });
    }

    private writeFile(
        fileEntry,
        dataObj,
        success: Function,
        fail: Function
    ) {
        fileEntry.createWriter(function(fileWriter) {

            fileWriter.onwriteend = function() {
                success();
            };

            fileWriter.onerror = function(e) {
                fail(e);
            };

            fileWriter.write(dataObj);
        });
    }

    private readFile(
        fileEntry,
        success: Function,
        fail: Function
    ) {

        fileEntry.file(function(file) {
            const reader = new FileReader();

            reader.onloadend = function() {
                success(this.result);
            };

            reader.readAsText(file);

        }, e => {
            fail(e);
        });
    }


    private createFileInPersistentStorage(
        fileName: string,
        textContent: string,
        success: Function,
        fail: Function
    ) {
        this.createFileInSpace('persistent', fileName, textContent, success, fail);
    }

    private createFileInSpace(
        space: string,
        fileName: string,
        textContent: string,
        success: Function,
        fail: Function
    ) {
        window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, () => {

            window.resolveLocalFileSystemURL('cdvfile://localhost/' + space + '/', dirEntry => {
                this.createFile(dirEntry, fileName, textContent, false, e => {
                    success(e);
                }, e => fail(e));
            }, e => {
                fail(e);
            });

        }, e => {
            fail(e);
        });
    }

    private readFileInPersistentStorage(
        fileName: string,
        success: Function,
        fail: Function
    ) {
        this.readFileInSpace('persistent', fileName, success, fail);
    }

    private readFileInAppDirectory(
        fileName: string,
        success: Function,
        fail: Function
    ) {
        let space: string;

        if (device.platform === 'Android') {
            space = 'assets';
        } else if (device.platform === 'iOS') {
            space = 'bundle';
        }

        this.readFileInSpace(space, fileName, success, fail);
    }


    authenticate(): Observable<EntityDataSet<T>> {
        const obs = new ReplaySubject<EntityDataSet<T>>(1);

        /*obs.next({
            "id":"5",
            "label":"christophe",
            "role":[2,3],
            "email":"christophe.vimbert@tralalere.com",
            "you_are":null,
            "type":null,
            "contact_email":null,
            "find_us":null,
            "email_status":null,
            "newsletter":false,
            "picture":"https:\/\/preprod.lms.tralalere.com\/assets\/images\/avatars\/profile.jpg",
            "access":"1543576103",
            "groups":["234","270","271"]
        });*/

        return obs;
    }

    get authenticated(): Observable<EntityDataSet<T>> {
        const obs = new ReplaySubject<EntityDataSet<T>>(1);

        /*obs.next({
            "id":"5",
            "label":"christophe",
            "role":[2,3],
            "email":"christophe.vimbert@tralalere.com",
            "you_are":null,
            "type":null,
            "contact_email":null,
            "find_us":null,
            "email_status":null,
            "newsletter":false,
            "picture":"https:\/\/preprod.lms.tralalere.com\/assets\/images\/avatars\/profile.jpg",
            "access":"1543576103",
            "groups":["234","270","271"]
        });*/

        return obs;
    }


    private readEndpoint(endpointName: string, success: Function, fail: Function) {
        // si le fichier n'existe pas dans le dossier de stockage, on copie celui qui se trouve dans le dossier de l'appli
        // sinon on lit celui-ci

        this.readFileInPersistentStorage(endpointName + '.json', text => {
            success(text);
            console.log('Fichier lu depuis persistant');
        }, e => {
            // le fichier doit être copié dans le stockage persistant
            this.readFileInAppDirectory('www/assets/endpoints/' + endpointName + '.json', oText => {

                /*const cdata: Object = JSON.parse(oText);
                let newObj: Object = {};

                cdata["data"].forEach(elem => {
                    newObj[elem["id"]] = elem;
                });

                oText = JSON.stringify({
                    data: newObj
                });*/

                this.createFileInPersistentStorage(endpointName + '.json', oText, () => {
                    success(oText);
                    console.log('Fichier copié dans persistant');
                }, () => {
                    console.log('erreur de copie dans le dossier');
                });

            }, e => {
                console.log('Erreur bizarre', e);
            });
        });
    }


    private saveToEndPoint(endpointName: string, content: string, success: Function, fail: Function) {
        this.createFileInPersistentStorage(endpointName + '.json', content, () => {
            success();
        }, e => {
            fail(e);
        });
    }


    private readFileInSpace(
        space: string,
        fileName: string,
        success: Function,
        fail: Function
    ) {
        window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, () => {

            window.resolveLocalFileSystemURL('cdvfile://localhost/' + space + '/' + fileName, fileEntry => {

                this.readFile(fileEntry, text => success(text), e => fail(e));

            }, e => {
                fail(e);
            });

        }, e => {
            fail(e);
        });
    }


    private getCollectionFromStore(type: string, filter: FilterData = {}, callback: Function) {

        const pointName: string = type;
        this.loadPointFromStorageIfEmpty(type, () => {
            const dataSet: CollectionDataSet<T> = {};


            let obj: Object = {};

            /*if (Array.isArray(this.dataStore[pointName])) {
                this.dataStore[pointName].forEach(elem => {
                    obj[elem["id"]] = elem;
                });*/
            // } else {
            obj = this.dataStore[pointName];
            // }


            const keys: string[] = Object.keys(obj);
            const filterKeys: string[] = Object.keys(filter);

            keys.forEach((key: string) => {
                let matching = true;

                filterKeys.forEach((filterKey: string) => {
                    if (filter[filterKey] !== obj[+key][filterKey]) {
                        matching = false;
                    }
                });

                if (matching) {
                    dataSet[+key] = obj[+key];
                }
            });

            callback(dataSet);
        });
    }


    private getEntityFromStore(type: string, id: number, callback: Function) {
        const pointName: string = type;
        this.loadPointFromStorageIfEmpty(type, () => {
            callback(this.dataStore[pointName][String(id)]);
        });
    }


    private deleteEntityFromStore(type: string, id: number, callback: Function) {
        const pointName: string = type;
        this.loadPointFromStorageIfEmpty(type, () => {
            if (this.dataStore[pointName][String(id)]) {
                delete this.dataStore[pointName][String(id)];
                this.savePointToStorage(type);
                return true;
            }

            callback(false);
        });
    }


    // TODO
    private set lastUsedId(value: number) {
        const lastUsedIdKey = 'lastusedid';

        localStorage[lastUsedIdKey] = value;
    }

    /**
     * Get last used id from localStorage
     * @returns The value
     */

    // TODO
    private get lastUsedId(): number {
        const lastUsedIdKey = 'lastusedid';

        if (localStorage[lastUsedIdKey] === undefined || localStorage[lastUsedIdKey] === '') {
            return 0;
        } else {
            return +localStorage[lastUsedIdKey];
        }
    }


    private savePointToStorage(type: string) {
        const pointName: string = type;

        console.log('77', this.dataStore[pointName]);

        if (this.dataStore[pointName]) {

            const tobj = {};

            for (const key in this.dataStore[pointName]) {
                if (this.dataStore[pointName].hasOwnProperty(key)) {
                    tobj[key] = this.dataStore[pointName][key];
                }
            }

            const obj = {
                data: tobj
            };

            const str = JSON.stringify(obj);

            console.log('save point ts', str, obj);

            this.saveToEndPoint(type, str, () => {
                console.log('Succès de l\'enregistrement du endpoint');
            }, () => {
                console.log('Echec de l\'enregistrement du endpoint');
            });
        }
    }


    private loadPointFromStorage(pointName: string, success: Function) {
        console.log('3');
        this.readEndpoint(pointName, text => {
            console.log(JSON.parse(text));
            this.dataStore[pointName] = JSON.parse(text).data;
            success();
        }, () => {
            this.dataStore[pointName] = {};
        });
    }


    private loadPointFromStorageIfEmpty(type: string, success: Function) {
        const pointName: string = type;
        console.log('2');

        if (!this.dataStore[pointName]) {
            this.loadPointFromStorage(pointName, () => {
                success();
            });
        } else {
            success();
        }
    }

    loadEntity(type: string, id: number): Observable<EntityDataSet<T>> {
        const subject = new ReplaySubject<EntityDataSet<T>>(1);

        this.loadPointFromStorageIfEmpty(type, () => {
            this.getEntityFromStore(type, id, (data) => {
                subject.next(data ? data : null);
            });

        });

        return subject;
    }

    loadCollection(type: string, filter: FilterData = {}): Observable<CollectionDataSet<T>> {
        const subject = new ReplaySubject<CollectionDataSet<T>>(1);

        this.loadPointFromStorageIfEmpty(type, () => {
            this.getCollectionFromStore(type, filter, (data) => {
                subject.next(data ? data : null);
            });
        });

        return subject;
    }

    saveEntity(entity: EntityDataSet<T>, type: string, id: number) {
        const subject = new ReplaySubject<EntityDataSet<T>>(1);

        this.loadPointFromStorageIfEmpty(type, () => {
            this.setEntityInStore(type, id, entity);

            subject.next(entity);
        });


        return subject.asObservable();
    }

    createEntity(type: string, data: EntityDataSet<any>) {
        const subject: ReplaySubject<EntityDataSet<T>> = new ReplaySubject<EntityDataSet<T>>(1);

        const newId: number = ++this.lastUsedId;
        data.id = newId;
        this.setEntityInStore(type, newId, data);

        subject.next(data as EntityDataSet<T>);

        return subject.asObservable();
    }

    deleteEntity(type: string, id: number) {
        const subject: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);

        this.loadPointFromStorageIfEmpty(type, () => {
            this.deleteEntityFromStore(type, id, (val: boolean) => {
                subject.next(val);
            });
        });

        return subject.asObservable();
    }

    private setEntityInStore(type: string, id: number, data: EntityDataSet) {
        const pointName: string = type;

        this.loadPointFromStorageIfEmpty(type, () => {
            if (!this.dataStore[pointName]) {
                this.dataStore[pointName] = {};
            }


            this.dataStore[pointName][String(id)] = data;

            this.savePointToStorage(type);
        });
    }
}
