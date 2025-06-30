import { Db, Collection } from 'mongodb';
import { SkillMaster, SkillMasterData, CreateSkillMasterData } from '../Models/SkillMaster';

/**
 * Repository for SkillMaster collection operations
 * Handles all database operations for the skills master data
 */
export class SkillMasterRepository {
    private collection: Collection<SkillMasterData>;

    constructor(db: Db) {
        this.collection = db.collection<SkillMasterData>('skills_master');
        this.createIndexes();
    }

    /**
     * Create database indexes for performance
     */
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

    /**
     * Create a new skill in the master collection
     */
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

    /**
     * Find skill by exact name (case-insensitive)
     */
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

    /**
     * Find skill by ID
     */
    async findById(skillId: string): Promise<SkillMaster | null> {
        try {
            const result = await this.collection.findOne({ skillId });
            return result ? SkillMaster.fromObject(result) : null;
        } catch (error) {
            console.error('Error finding skill by ID:', error);
            throw new Error('Failed to find skill by ID');
        }
    }

    /**
     * Search skills by partial name match
     */
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

    /**
     * Get all skills with optional filtering
     */
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

    /**
     * Update skill master
     */
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

    /**
     * Approve skill (set isAccepted = true)
     */
    async approve(skillId: string): Promise<void> {
        try {
            await this.update(skillId, { isAccepted: true });
        } catch (error) {
            console.error('Error approving skill:', error);
            throw new Error('Failed to approve skill');
        }
    }

    /**
     * Get skills that need approval (isAccepted = false)
     */
    async getPendingSkills(): Promise<SkillMaster[]> {
        return this.findAll({ isAccepted: false });
    }

    /**
     * Get accepted skills only
     */
    async getAcceptedSkills(): Promise<SkillMaster[]> {
        return this.findAll({ isAccepted: true });
    }

    /**
     * Delete skill (soft delete by setting inactive)
     * Note: We don't physically delete to maintain referential integrity
     */
    async delete(skillId: string): Promise<void> {
        try {
            await this.update(skillId, { isAccepted: false });
        } catch (error) {
            console.error('Error deleting skill:', error);
            throw new Error('Failed to delete skill');
        }
    }

    /**
     * Get skills count
     */
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

    /**
     * Get or create skill by name
     * If skill exists, return it. If not, create new one.
     */
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
