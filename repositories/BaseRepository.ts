import { Db } from 'mongodb';
export interface IBaseRepository<T, CreateT, UpdateT> {
    create(data: CreateT): Promise<T>;
    findById(id: string): Promise<T | null>;
    update(id: string, data: Partial<UpdateT>): Promise<void>;
    delete(id: string): Promise<void>;
    findAll(): Promise<T[]>;
}
export abstract class BaseRepository<T, CreateT, UpdateT> implements IBaseRepository<T, CreateT, UpdateT> {
    protected db: Db;
    protected collectionName: string;
    constructor(db: Db, collectionName: string) {
        this.db = db;
        this.collectionName = collectionName;
    }
    abstract create(data: CreateT): Promise<T>;
    abstract findById(id: string): Promise<T | null>;
    abstract update(id: string, data: Partial<UpdateT>): Promise<void>;
    abstract delete(id: string): Promise<void>;
    abstract findAll(): Promise<T[]>;
    protected getCollection() {
        return this.db.collection(this.collectionName);
    }
    protected generateId(): string {
        const { ObjectId } = require('mongodb');
        return new ObjectId().toString();
    }
}
