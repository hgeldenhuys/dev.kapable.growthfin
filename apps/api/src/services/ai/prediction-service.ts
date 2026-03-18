/**
 * Prediction Service
 * US-LEAD-AI-010: Predictive Conversion Scoring
 */

import { and, eq, sql, desc } from 'drizzle-orm';
import {
  db,
  predictionModels,
  leadPredictions,
  predictionHistory,
  predictionTrainingData,
  crmLeads,
  crmActivities,
  leadScores,
  type PredictionModel,
  type NewPredictionModel,
  type NewLeadPrediction,
  type NewPredictionHistory,
  type NewPredictionTrainingData,
} from '@agios/db';
import { SimplePredictionModel, type PredictionFeatures, type TrainingData } from './prediction-model';

export interface PredictionResult {
  lead_id: string;
  prediction_score: number;
  confidence_interval: number;
  prediction_category: 'high_probability' | 'medium_probability' | 'low_probability';
  top_factors: Array<{
    factor: string;
    contribution: number;
    description: string;
  }>;
  model_accuracy: number;
  predicted_at: string;
}

export class PredictionService {
  /**
   * Train a new prediction model for a workspace
   */
  async trainModel(workspaceId: string, minSamples: number = 50): Promise<PredictionModel> {
    console.log(`[PredictionService] Training model for workspace ${workspaceId}...`);

    // 1. Fetch historical leads with conversion data (last 180 days)
    const historicalLeads = await db.query.crmLeads.findMany({
      where: and(
        eq(crmLeads.workspaceId, workspaceId),
        sql`${crmLeads.createdAt} >= NOW() - INTERVAL '180 days'`
      ),
      with: {
        scores: true,
        activities: {
          where: sql`${crmActivities.createdAt} >= NOW() - INTERVAL '30 days'`,
        },
      },
    });

    console.log(`[PredictionService] Found ${historicalLeads.length} historical leads`);

    if (historicalLeads.length < minSamples) {
      throw new Error(
        `Insufficient training data: ${historicalLeads.length} leads found, minimum ${minSamples} required`
      );
    }

    // 2. Extract features and labels
    const trainingData: TrainingData[] = historicalLeads
      .filter((lead) => lead.lifecycleStage !== 'new') // Need some activity
      .map((lead) => ({
        features: this.extractFeatures(lead),
        converted: lead.convertedAt !== null,
      }));

    console.log(`[PredictionService] Prepared ${trainingData.length} training samples`);

    if (trainingData.length < minSamples) {
      throw new Error(
        `Insufficient qualified training data: ${trainingData.length} samples, minimum ${minSamples} required`
      );
    }

    // 3. Train model
    const model = new SimplePredictionModel();
    await model.train(trainingData, 0.01, 1000);

    // 4. Calculate model metrics
    const metrics = this.calculateMetrics(model, trainingData);

    console.log(`[PredictionService] Model metrics:`, metrics);

    // 5. Deactivate old models
    await db
      .update(predictionModels)
      .set({ isActive: false })
      .where(
        and(
          eq(predictionModels.workspaceId, workspaceId),
          eq(predictionModels.modelType, 'conversion'),
          eq(predictionModels.isActive, true)
        )
      );

    // 6. Save model to database
    const [modelRecord] = await db
      .insert(predictionModels)
      .values({
        workspaceId,
        modelType: 'conversion',
        modelVersion: '1.0',
        algorithm: 'logistic_regression',
        trainingSamples: trainingData.length,
        trainingStartedAt: new Date(),
        trainingCompletedAt: new Date(),
        accuracy: metrics.accuracy.toString(),
        precision: metrics.precision.toString(),
        recall: metrics.recall.toString(),
        f1Score: metrics.f1Score.toString(),
        featureImportance: model.getFeatureImportance(),
        modelWeights: model.serializeWeights(),
        isActive: true,
      } as NewPredictionModel)
      .returning();

    // 7. Store training data for future reference
    const trainingDataRecords: NewPredictionTrainingData[] = historicalLeads
      .filter((lead) => lead.lifecycleStage !== 'new')
      .map((lead) => ({
        workspaceId,
        modelId: modelRecord.id,
        leadId: lead.id,
        features: this.extractFeatures(lead),
        converted: lead.convertedAt !== null,
        convertedAt: lead.convertedAt || undefined,
      }));

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < trainingDataRecords.length; i += batchSize) {
      const batch = trainingDataRecords.slice(i, i + batchSize);
      await db.insert(predictionTrainingData).values(batch);
    }

    console.log(
      `[PredictionService] Model trained successfully: ${(metrics.accuracy * 100).toFixed(2)}% accuracy`
    );

    return modelRecord;
  }

  /**
   * Predict conversion probability for a lead
   */
  async predictConversion(leadId: string, workspaceId: string): Promise<PredictionResult> {
    // 1. Get active model
    const model = await db.query.predictionModels.findFirst({
      where: and(
        eq(predictionModels.workspaceId, workspaceId),
        eq(predictionModels.modelType, 'conversion'),
        eq(predictionModels.isActive, true)
      ),
    });

    if (!model) {
      throw new Error('No trained model available for workspace');
    }

    // 2. Fetch lead data
    const lead = await db.query.crmLeads.findFirst({
      where: and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)),
      with: {
        scores: true,
        activities: {
          where: sql`${crmActivities.createdAt} >= NOW() - INTERVAL '30 days'`,
          orderBy: desc(crmActivities.createdAt),
        },
      },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    // 3. Extract features
    const features = this.extractFeatures(lead);

    // 4. Load model and predict
    const predictor = new SimplePredictionModel();
    predictor.loadWeights(model.modelWeights as any);

    const score = predictor.predict(features);
    const confidenceInterval = 15; // ±15 points for simple model

    // 5. Get top contributing factors
    const topContributions = predictor.getTopContributingFeatures(features, 3);
    const topFactors = topContributions.map((contrib) => ({
      factor: contrib.feature,
      contribution: Math.round(contrib.contribution * 100),
      description: this.getFactorDescription(contrib.feature, contrib.featureValue),
    }));

    // 6. Save prediction to database (upsert)
    await db
      .insert(leadPredictions)
      .values({
        leadId,
        workspaceId,
        modelId: model.id,
        predictionScore: score.toString(),
        confidenceInterval: confidenceInterval.toString(),
        topFactors,
        predictedAt: new Date(),
      } as NewLeadPrediction)
      .onConflictDoUpdate({
        target: leadPredictions.leadId,
        set: {
          modelId: model.id,
          predictionScore: score.toString(),
          confidenceInterval: confidenceInterval.toString(),
          topFactors,
          predictedAt: new Date(),
        },
      });

    // 7. Save to prediction history for accuracy tracking
    await db.insert(predictionHistory).values({
      workspaceId,
      leadId,
      modelId: model.id,
      predictionScore: score.toString(),
      predictedAt: new Date(),
      actualConverted: lead.convertedAt ? true : null,
      actualConvertedAt: lead.convertedAt || null,
    } as NewPredictionHistory);

    return {
      lead_id: leadId,
      prediction_score: score,
      confidence_interval: confidenceInterval,
      prediction_category:
        score >= 70 ? 'high_probability' : score >= 40 ? 'medium_probability' : 'low_probability',
      top_factors: topFactors,
      model_accuracy: parseFloat(model.accuracy || '0'),
      predicted_at: new Date().toISOString(),
    };
  }

  /**
   * Extract normalized features from lead data
   */
  private extractFeatures(lead: any): PredictionFeatures {
    const now = Date.now();
    const createdAt = new Date(lead.createdAt).getTime();
    const daysSinceCreated = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

    const activities = lead.activities || [];
    const emailOpens = activities.filter((a: any) => a.type === 'email_open').length;
    const emailClicks = activities.filter((a: any) => a.type === 'email_click').length;
    const websiteVisits = activities.filter((a: any) => a.type === 'website_visit').length;

    // Lifecycle stage mapping
    const lifecycleMap: Record<string, number> = {
      lead: 0.25,
      qualified: 0.5,
      opportunity: 0.75,
      won: 1.0,
      lost: 0,
    };

    // Get scores (default to 50 if not available)
    const scores = lead.scores || {};
    const engagementScore = scores.engagementScore || 50;
    const fitScore = scores.fitScore || 50;
    const propensityScore = scores.propensityScore || 50;

    return {
      // Normalize scores to 0-1
      engagement_score: engagementScore / 100,
      fit_score: fitScore / 100,
      propensity_score: propensityScore / 100,

      // Normalize lead age (cap at 90 days)
      days_since_created: Math.min(daysSinceCreated, 90) / 90,

      // Normalize activity counts
      activities_count_30d: Math.min(activities.length, 50) / 50,
      email_opens_30d: Math.min(emailOpens, 20) / 20,
      email_clicks_30d: Math.min(emailClicks, 10) / 10,
      website_visits_30d: Math.min(websiteVisits, 30) / 30,

      // Lifecycle stage
      lifecycle_stage_numeric: lifecycleMap[lead.lifecycleStage] || 0.25,

      // Data completeness
      has_phone: lead.phone ? 1 : 0,
      has_company: lead.companyName ? 1 : 0,
    };
  }

  /**
   * Calculate model performance metrics
   */
  private calculateMetrics(
    model: SimplePredictionModel,
    trainingData: TrainingData[]
  ): {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  } {
    let tp = 0; // True positives
    let fp = 0; // False positives
    let tn = 0; // True negatives
    let fn = 0; // False negatives

    for (const sample of trainingData) {
      const prediction = model.predict(sample.features);
      const predicted = prediction >= 50;
      const actual = sample.converted;

      if (predicted && actual) tp++;
      else if (predicted && !actual) fp++;
      else if (!predicted && actual) fn++;
      else tn++;
    }

    const accuracy = (tp + tn) / (tp + tn + fp + fn);
    const precision = tp > 0 ? tp / (tp + fp) : 0;
    const recall = tp > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return { accuracy, precision, recall, f1Score };
  }

  /**
   * Get human-readable description for a factor
   */
  private getFactorDescription(factor: string, value: number): string {
    // Convert normalized value back to interpretable format
    const percentage = Math.round(value * 100);

    const descriptions: Record<string, string> = {
      engagement_score: `${percentage >= 70 ? 'High' : percentage >= 40 ? 'Medium' : 'Low'} email and website engagement`,
      fit_score: `${percentage >= 80 ? 'Perfect' : percentage >= 60 ? 'Good' : 'Poor'} ICP match`,
      propensity_score: `${percentage >= 70 ? 'High' : percentage >= 40 ? 'Medium' : 'Low'} buying propensity`,
      activities_count_30d: `${Math.round(value * 50)} activities in last 30 days`,
      email_opens_30d: `${Math.round(value * 20)} email opens`,
      email_clicks_30d: `${Math.round(value * 10)} email clicks`,
      website_visits_30d: `${Math.round(value * 30)} website visits`,
      days_since_created: `Lead age: ${Math.round(value * 90)} days`,
      lifecycle_stage_numeric: this.getLifecycleDescription(value),
      has_phone: value > 0 ? 'Phone number provided' : 'No phone number',
      has_company: value > 0 ? 'Company information complete' : 'Missing company information',
    };

    return descriptions[factor] || `${factor}: ${percentage}%`;
  }

  /**
   * Get lifecycle stage description from numeric value
   */
  private getLifecycleDescription(value: number): string {
    if (value >= 0.9) return 'Won customer';
    if (value >= 0.7) return 'Opportunity stage';
    if (value >= 0.4) return 'Qualified lead';
    if (value >= 0.2) return 'New lead';
    return 'Lost/unqualified';
  }
}
