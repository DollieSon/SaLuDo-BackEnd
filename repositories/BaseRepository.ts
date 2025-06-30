import { Db } from 'mongodb';

/**
 * Base repository interface that's absolutely GOATED
 * This is the blueprint for all our database operations bestie
 * Like literally the foundation that's holding everything together fr fr
 */
export interface IBaseRepository<T, CreateT, UpdateT> {
    create(data: CreateT): Promise<T>;
    findById(id: string): Promise<T | null>;
    update(id: string, data: Partial<UpdateT>): Promise<void>;
    delete(id: string): Promise<void>;
    findAll(): Promise<T[]>;
}

/**
 * Abstract base repository class that's serving database energy
 * This bad boy has all the common functionality locked and loaded
 * Like bestie, inheritance is about to be iconic with this one
 */
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

    /**
     * Get the collection instance
     * Getting that MongoDB collection like we're collecting infinity stones
     */
    protected getCollection() {
        return this.db.collection(this.collectionName);
    }

    /**
     * Generate a new ObjectId string
     * Manifesting unique IDs out of thin air, we love to see it
     */
    protected generateId(): string {
        const { ObjectId } = require('mongodb');
        return new ObjectId().toString();
    }
}
