import { Collection, Db } from 'mongodb';
import {
  GeminiModelSettings,
  GeminiModelUpdate,
  buildDefaultSettings,
  validateFeatureKey,
  validateModelName,
  DEFAULT_GEMINI_MAPPING
} from '../Models/GeminiModelSettings';
import { DEPRECATED_GEMINI_MODELS, GEMINI_PRICING } from '../Models/AIMetrics';

const COLLECTION_NAME = 'geminiModelSettings';

export class GeminiModelSettingsRepository {
  private collection: Collection;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection(COLLECTION_NAME);
  }

  private generateId(): string {
    const { ObjectId } = require('mongodb');
    return new ObjectId().toString();
  }

  async getCurrentSettings(): Promise<GeminiModelSettings | null> {
    return (await this.collection.findOne({ settingsId: 'global' })) as GeminiModelSettings | null;
  }

  async getOrCreateGlobalSettings(createdBy: string): Promise<GeminiModelSettings> {
    let settings = await this.getCurrentSettings();
    if (!settings) {
      const toInsert = buildDefaultSettings(createdBy);
      await this.collection.insertOne(toInsert);
      settings = toInsert;
    }
    return settings;
  }

  async updateSettings(updates: GeminiModelUpdate, lastModifiedBy: string): Promise<GeminiModelSettings | null> {
    const current = await this.getOrCreateGlobalSettings(lastModifiedBy);

    // Validate keys and model names
    for (const key of Object.keys(updates)) {
      if (!validateFeatureKey(key)) {
        throw new Error(`Unknown feature key: ${key}`);
      }
      const model = (updates as any)[key];
      if (typeof model !== 'string' || !validateModelName(model)) {
        throw new Error(`Unsupported model name for ${key}: ${model}`);
      }
    }

    const merged = {
      ...current.mapping,
      ...(updates as Record<string, string>)
    } as Record<string, string>;

    const updateData = {
      mapping: merged,
      updatedAt: new Date(),
      lastModifiedBy
    };

    const result = await this.collection.findOneAndUpdate(
      { settingsId: 'global' },
      { $set: updateData },
      { returnDocument: 'after', upsert: true }
    );

    if (result && result.value) {
      return result.value as unknown as GeminiModelSettings;
    }

    // Fallback: read current settings from DB
    return await this.getCurrentSettings();
  }

  async resetToDefaults(lastModifiedBy: string): Promise<GeminiModelSettings | null> {
    const updateData = {
      mapping: { ...DEFAULT_GEMINI_MAPPING },
      updatedAt: new Date(),
      lastModifiedBy
    };

    const result = await this.collection.findOneAndUpdate(
      { settingsId: 'global' },
      { $set: updateData },
      { returnDocument: 'after', upsert: true }
    );

    if (result && result.value) {
      return result.value as unknown as GeminiModelSettings;
    }

    return await this.getCurrentSettings();
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ settingsId: 1 }, { unique: true });
  }
}
