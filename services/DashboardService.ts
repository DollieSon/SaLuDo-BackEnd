import { Db } from 'mongodb';
import { PersonalInfoRepository } from '../repositories/CandidateRepository';
import { JobRepository } from '../repositories/JobRepository';
import { UserRepository } from '../repositories/UserRepository';
import { CommentRepository } from '../repositories/CommentRepository';
import { CandidateStatus } from '../Models/Candidate';

export interface DashboardStats {
  totalCandidates: number;
  totalJobs: number;
  totalEmployees: number;
  pendingApplications: number;
  approvedCandidates: number;
  rejectedCandidates: number;
  activeJobs: number;
  closedJobs: number;
  averageMatchScore: number;
  recentCandidates: RecentCandidate[];
  topJobs: TopJob[];
  recentActivity: Activity[];
}

export interface RecentCandidate {
  id: string;
  name: string;
  role: string;
  score: number;
  date: string;
}

export interface TopJob {
  id: string;
  name: string;
  applicants: number;
  avgScore: number;
}

export interface Activity {
  id: string;
  type: 'application' | 'approval' | 'job' | 'rejection' | 'comment';
  message: string;
  time: string;
}

export class DashboardService {
  private db: Db;
  private personalInfoRepo: PersonalInfoRepository;
  private jobRepo: JobRepository;
  private userRepo: UserRepository;
  private commentRepo: CommentRepository;

  constructor(db: Db) {
    this.db = db;
    this.personalInfoRepo = new PersonalInfoRepository(db);
    this.jobRepo = new JobRepository();
    this.userRepo = new UserRepository(db);
    this.commentRepo = new CommentRepository(db);
  }

  async getStats(): Promise<DashboardStats> {
    try {
      await this.jobRepo.init();
      await this.commentRepo.init();

      // Run aggregations in parallel for performance
      const [
        totalCandidates,
        approvedCandidates,
        rejectedCandidates,
        allJobs,
        allUsers,
        recentCandidates,
        topJobs,
        recentComments
      ] = await Promise.all([
        this.getTotalCandidates(),
        this.getCandidatesByStatus(CandidateStatus.HIRED),
        this.getCandidatesByStatus(CandidateStatus.REJECTED),
        this.getAllJobs(),
        this.getAllUsers(),
        this.getRecentCandidates(10),
        this.getTopJobs(5),
        this.getRecentComments(10)
      ]);

    // Calculate derived statistics
    const totalJobs = allJobs.length;
    const activeJobs = allJobs.length; // Assuming all jobs are active (no 'closed' field in schema)
    const closedJobs = 0; // No closed status in current schema
    const totalEmployees = allUsers.filter((u: any) => u.role !== 'candidate' && !u.isDeleted).length;
    const pendingApplications = await this.getCandidatesByStatus(CandidateStatus.APPLIED);
    
    // Calculate average match score (if available)
    const averageMatchScore = this.calculateAverageMatchScore(recentCandidates);

    // Build activity feed from comments and candidate status changes
    const recentActivity = this.buildActivityFeed(recentCandidates, recentComments);

      return {
        totalCandidates,
        totalJobs,
        totalEmployees,
        pendingApplications,
        approvedCandidates,
        rejectedCandidates,
        activeJobs,
        closedJobs,
        averageMatchScore,
        recentCandidates: this.formatRecentCandidates(recentCandidates),
        topJobs: this.formatTopJobs(topJobs),
        recentActivity: recentActivity.slice(0, 10)
      };
    } catch (error: any) {
      console.error('Error in DashboardService.getStats:', error);
      throw new Error(`Failed to get dashboard stats: ${error.message}`);
    }
  }

  private async getTotalCandidates(): Promise<number> {
    const candidates = await this.personalInfoRepo.findAll();
    return candidates.length;
  }

  private async getCandidatesByStatus(status: CandidateStatus): Promise<number> {
    const candidates = await this.personalInfoRepo.findByStatus(status);
    return candidates.length;
  }

  private async getAllJobs() {
    return await this.jobRepo.findAll();
  }

  private async getAllUsers() {
    return await this.userRepo.findAll();
  }

  private async getRecentCandidates(limit: number) {
    const allCandidates = await this.personalInfoRepo.findAll();
    
    // Sort by dateCreated (most recent first)
    return allCandidates
      .sort((a, b) => b.dateCreated.getTime() - a.dateCreated.getTime())
      .slice(0, limit);
  }

  private async getTopJobs(limit: number) {
    const jobs = await this.jobRepo.findAll();
    
    // Get candidate counts and scores for each job
    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const jobId = job._id?.toString();
        
        // Count candidates in interviews for this job
        const interviews = await this.db.collection('interviews').find({
          jobId: jobId
        }).toArray();
        
        // Get candidates who have scores for this job
        const candidatesForJob = await this.personalInfoRepo.findAll();
        const candidatesWithJobScores = candidatesForJob.filter(candidate => 
          candidate.scoreHistory && candidate.scoreHistory.some((score: any) => score.jobId === jobId)
        );
        
        // Calculate average score for this job
        let avgScore = 0;
        if (candidatesWithJobScores.length > 0) {
          const jobScores = candidatesWithJobScores.map(candidate => {
            // Find the most recent score for this specific job
            const jobScore = candidate.scoreHistory!
              .filter((score: any) => score.jobId === jobId)
              .sort((a: any, b: any) => new Date(b.calculatedAt).getTime() - new Date(a.calculatedAt).getTime())[0];
            return jobScore ? jobScore.overallScore : 0;
          }).filter((score: number) => score > 0);
          
          if (jobScores.length > 0) {
            avgScore = Math.round((jobScores.reduce((sum, score) => sum + score, 0) / jobScores.length) * 10) / 10;
          }
        }
        
        return {
          job,
          applicantCount: interviews.length,
          avgScore
        };
      })
    );

    // Sort by applicant count
    return jobsWithCounts
      .sort((a, b) => b.applicantCount - a.applicantCount)
      .slice(0, limit);
  }

  private async getRecentComments(limit: number) {
    const comments = await this.commentRepo.findWithFilter(
      { includeDeleted: false },
      {
        limit,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }
    );
    
    return comments;
  }

  private formatRecentCandidates(candidates: any[]): RecentCandidate[] {
    return candidates.map(candidate => ({
      id: candidate.candidateId,
      name: candidate.name || 'Unknown',
      role: this.extractRole(candidate),
      score: this.extractMatchScore(candidate),
      date: candidate.dateCreated.toISOString()
    }));
  }

  private formatTopJobs(jobsWithCounts: any[]): TopJob[] {
    return jobsWithCounts.map(({ job, applicantCount, avgScore }) => ({
      id: job._id?.toString() || '',
      name: job.jobName,
      applicants: applicantCount,
      avgScore: avgScore // Use calculated score (0 if no scores available)
    }));
  }

  private extractRole(candidate: any): string {
    // Try to get role from experience or default to 'Candidate'
    if (candidate.experience && candidate.experience.length > 0) {
      return candidate.experience[0].jobTitle || 'Candidate';
    }
    return 'Candidate';
  }

  private extractMatchScore(candidate: any): number {
    // Get the most recent score from scoreHistory
    if (candidate.scoreHistory && candidate.scoreHistory.length > 0) {
      // Sort by calculatedAt to get the most recent score
      const sortedScores = [...candidate.scoreHistory].sort((a, b) => {
        const dateA = new Date(a.calculatedAt).getTime();
        const dateB = new Date(b.calculatedAt).getTime();
        return dateB - dateA; // Most recent first
      });
      
      return Math.round(sortedScores[0].overallScore * 10) / 10; // Round to 1 decimal
    }
    
    // If no score history exists, return 0 or null indicator
    return 0;
  }

  private calculateAverageMatchScore(candidates: any[]): number {
    if (candidates.length === 0) return 0;
    
    // Only count candidates that have scores (non-zero)
    const candidatesWithScores = candidates.filter(candidate => {
      const score = this.extractMatchScore(candidate);
      return score > 0;
    });
    
    if (candidatesWithScores.length === 0) return 0;
    
    const total = candidatesWithScores.reduce((sum, candidate) => {
      return sum + this.extractMatchScore(candidate);
    }, 0);
    
    return Math.round((total / candidatesWithScores.length) * 10) / 10;
  }

  private buildActivityFeed(recentCandidates: any[], recentComments: any[]): Activity[] {
    const activities: Activity[] = [];

    // Add candidate activities
    recentCandidates.slice(0, 5).forEach((candidate, index) => {
      const status = candidate.status;
      
      if (status === CandidateStatus.APPLIED) {
        activities.push({
          id: `candidate-${candidate.candidateId}-${index}`,
          type: 'application',
          message: `New application from ${candidate.name}`,
          time: this.getRelativeTime(candidate.dateCreated)
        });
      } else if (status === CandidateStatus.HIRED) {
        activities.push({
          id: `candidate-${candidate.candidateId}-${index}`,
          type: 'approval',
          message: `${candidate.name} hired`,
          time: this.getRelativeTime(candidate.dateUpdated)
        });
      } else if (status === CandidateStatus.REJECTED) {
        activities.push({
          id: `candidate-${candidate.candidateId}-${index}`,
          type: 'rejection',
          message: `${candidate.name} rejected`,
          time: this.getRelativeTime(candidate.dateUpdated)
        });
      }
    });

    // Add comment activities
    recentComments.slice(0, 5).forEach((comment, index) => {
      // Handle both Comment objects and plain data
      const commentData = comment.toObject ? comment.toObject() : comment;
      const text = commentData.text || '';
      const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
      
      activities.push({
        id: `comment-${commentData.commentId}-${index}`,
        type: 'comment',
        message: `New comment on ${commentData.entityType}: ${preview}`,
        time: this.getRelativeTime(commentData.createdAt)
      });
    });

    // Sort by time (most recent first)
    return activities.sort((a, b) => {
      const timeA = this.parseRelativeTime(a.time);
      const timeB = this.parseRelativeTime(b.time);
      return timeA - timeB;
    });
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return diffMins <= 1 ? '1 minute ago' : `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else {
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    }
  }

  private parseRelativeTime(relativeTime: string): number {
    // Convert relative time back to milliseconds for sorting
    const match = relativeTime.match(/(\d+)\s+(minute|hour|day)/);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'minute': return value * 60000;
      case 'hour': return value * 3600000;
      case 'day': return value * 86400000;
      default: return 0;
    }
  }
}
