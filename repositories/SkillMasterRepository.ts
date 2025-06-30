import { Db, Collection } from 'mongodb';
import { SkillMaster, SkillMasterData, CreateSkillMasterData } from '../Models/SkillMaster';
export class SkillMasterRepository {
    private collection: Collection<SkillMasterData>;
    constructor(db: Db) {
        this.collection = db.collection<SkillMasterData>('skills_master');
        this.createIndexes();
    }
    private async createIndexes(): Promise<void> {
        try {
            // Create unique index on skillName (case-insensitive)
            await this.collection.createIndex(
                { skillName: 1 },
                { 
                    unique: true,
                    collation: { locale: 'en', strength: 2 } // Case-insensitive
                }
            );
            // Create index on isAccepted for filtering
            await this.collection.createIndex({ isAccepted: 1 });
            // Create compound index for search and filtering
            await this.collection.createIndex({ 
                skillName: 'text',
                isAccepted: 1 
            });
            console.log('SkillMaster indexes created successfully');
        } catch (error) {
            console.error('Error creating SkillMaster indexes:', error);
        }
    }
    async create(skillData: CreateSkillMasterData): Promise<SkillMaster> {
        try {
            const skillMaster = SkillMaster.create(skillData.skillName);
            const result = await this.collection.insertOne(skillMaster.toObject());
            if (result.acknowledged) {
                return skillMaster;
            } else {
                throw new Error('Failed to create skill master');
            }
        } catch (error) {
            // Handle duplicate key error
            if ((error as any).code === 11000) {
                throw new Error(`Skill "${skillData.skillName}" already exists`);
            }
            throw error;
        }
    }
    async findByName(skillName: string): Promise<SkillMaster | null> {
        try {
            const result = await this.collection.findOne(
                { skillName: { $regex: new RegExp(`^${skillName}$`, 'i') } }
            );
            return result ? SkillMaster.fromObject(result) : null;
        } catch (error) {
            console.error('Error finding skill by name:', error);
            throw new Error('Failed to find skill by name');
        }
    }
    async findById(skillId: string): Promise<SkillMaster | null> {
        try {
            const result = await this.collection.findOne({ skillId });
            return result ? SkillMaster.fromObject(result) : null;
        } catch (error) {
            console.error('Error finding skill by ID:', error);
            throw new Error('Failed to find skill by ID');
        }
    }
    async searchByName(query: string, limit: number = 10): Promise<SkillMaster[]> {
        try {
            const results = await this.collection
                .find({
                    skillName: { $regex: query, $options: 'i' }
                })
                .sort({ isAccepted: -1, skillName: 1 }) // Accepted first, then alphabetical
                .limit(limit)
                .toArray();
            return results.map(result => SkillMaster.fromObject(result));
        } catch (error) {
            console.error('Error searching skills:', error);
            throw new Error('Failed to search skills');
        }
    }
    async findAll(options: {
        isAccepted?: boolean;
        limit?: number;
        skip?: number;
    } = {}): Promise<SkillMaster[]> {
        try {
            const filter: any = {};
            if (options.isAccepted !== undefined) {
                filter.isAccepted = options.isAccepted;
            }
            const query = this.collection.find(filter)
                .sort({ skillName: 1 });
            if (options.skip) {
                query.skip(options.skip);
            }
            if (options.limit) {
                query.limit(options.limit);
            }
            const results = await query.toArray();
            return results.map(result => SkillMaster.fromObject(result));
        } catch (error) {
            console.error('Error finding all skills:', error);
            throw new Error('Failed to find skills');
        }
    }
    async update(skillId: string, updateData: Partial<SkillMasterData>): Promise<void> {
        try {
            updateData.updatedAt = new Date();
            const result = await this.collection.updateOne(
                { skillId },
                { $set: updateData }
            );
            if (result.matchedCount === 0) {
                throw new Error('Skill not found');
            }
        } catch (error) {
            console.error('Error updating skill:', error);
            throw new Error('Failed to update skill');
        }
    }
    async approve(skillId: string): Promise<void> {
        try {
            await this.update(skillId, { isAccepted: true });
        } catch (error) {
            console.error('Error approving skill:', error);
            throw new Error('Failed to approve skill');
        }
    }
    async getPendingSkills(): Promise<SkillMaster[]> {
        return this.findAll({ isAccepted: false });
    }
    async getAcceptedSkills(): Promise<SkillMaster[]> {
        return this.findAll({ isAccepted: true });
    }
    async delete(skillId: string): Promise<void> {
        try {
            await this.update(skillId, { isAccepted: false });
        } catch (error) {
            console.error('Error deleting skill:', error);
            throw new Error('Failed to delete skill');
        }
    }
    async getCount(isAccepted?: boolean): Promise<number> {
        try {
            const filter: any = {};
            if (isAccepted !== undefined) {
                filter.isAccepted = isAccepted;
            }
            return await this.collection.countDocuments(filter);
        } catch (error) {
            console.error('Error getting skills count:', error);
            throw new Error('Failed to get skills count');
        }
    }
    async getOrCreate(skillName: string): Promise<SkillMaster> {
        try {
            // First try to find existing skill
            let skill = await this.findByName(skillName);
            if (!skill) {
                // Create new skill if it doesn't exist
                skill = await this.create({ skillName });
            }
            return skill;
        } catch (error) {
            // If error is duplicate key (race condition), try to find again
            if ((error as any).code === 11000) {
                const existingSkill = await this.findByName(skillName);
                if (existingSkill) {
                    return existingSkill;
                }
            }
            throw error;
        }
    }
}
