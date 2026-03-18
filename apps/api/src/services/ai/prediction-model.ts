/**
 * Simple Prediction Model - Logistic Regression
 * US-LEAD-AI-010: Predictive Conversion Scoring
 */

export interface PredictionFeatures {
  // Core scores (normalized 0-1)
  engagement_score: number;
  fit_score: number;
  propensity_score: number;

  // Lead age and activity (normalized)
  days_since_created: number; // normalized 0-1 (max 90 days)
  activities_count_30d: number; // normalized 0-1 (max 50 activities)

  // Email engagement (normalized)
  email_opens_30d: number; // normalized 0-1 (max 20 opens)
  email_clicks_30d: number; // normalized 0-1 (max 10 clicks)

  // Website engagement (normalized)
  website_visits_30d: number; // normalized 0-1 (max 30 visits)

  // Lifecycle stage (categorical, normalized)
  lifecycle_stage_numeric: number; // verified=0.25, engaged=0.5, opportunity=0.75, won=1.0

  // Data completeness (binary)
  has_phone: number; // 0 or 1
  has_company: number; // 0 or 1
}

export interface TrainingData {
  features: PredictionFeatures;
  converted: boolean;
}

export interface ModelWeights {
  weights: Record<keyof PredictionFeatures, number>;
  bias: number;
}

/**
 * Simple Logistic Regression Model using Gradient Descent
 */
export class SimplePredictionModel {
  private weights: Record<keyof PredictionFeatures, number> = {
    engagement_score: 0,
    fit_score: 0,
    propensity_score: 0,
    days_since_created: 0,
    activities_count_30d: 0,
    email_opens_30d: 0,
    email_clicks_30d: 0,
    website_visits_30d: 0,
    lifecycle_stage_numeric: 0,
    has_phone: 0,
    has_company: 0,
  };

  private bias: number = 0;

  /**
   * Sigmoid activation function
   */
  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }

  /**
   * Train the model using gradient descent
   */
  async train(
    trainingData: TrainingData[],
    learningRate: number = 0.01,
    iterations: number = 1000
  ): Promise<void> {
    const n = trainingData.length;

    console.log(`[SimplePredictionModel] Starting training with ${n} samples...`);

    for (let iter = 0; iter < iterations; iter++) {
      let gradients: Record<string, number> = {};
      let biasGradient = 0;

      // Calculate gradients for all samples
      for (const sample of trainingData) {
        const prediction = this.predictProbability(sample.features);
        const error = prediction - (sample.converted ? 1 : 0);

        biasGradient += error;

        for (const [feature, value] of Object.entries(sample.features)) {
          gradients[feature] = (gradients[feature] || 0) + error * value;
        }
      }

      // Update weights using gradient descent
      this.bias -= (learningRate * biasGradient) / n;

      for (const [feature, gradient] of Object.entries(gradients)) {
        this.weights[feature as keyof PredictionFeatures] -= (learningRate * gradient) / n;
      }

      // Log progress every 100 iterations
      if ((iter + 1) % 100 === 0) {
        const accuracy = this.calculateAccuracy(trainingData);
        console.log(
          `[SimplePredictionModel] Iteration ${iter + 1}/${iterations}, Accuracy: ${(accuracy * 100).toFixed(2)}%`
        );
      }
    }

    const finalAccuracy = this.calculateAccuracy(trainingData);
    console.log(
      `[SimplePredictionModel] Training complete. Final accuracy: ${(finalAccuracy * 100).toFixed(2)}%`
    );
  }

  /**
   * Predict probability (0-1) for given features
   */
  predictProbability(features: PredictionFeatures): number {
    // Calculate weighted sum
    let sum = this.bias;

    for (const [feature, value] of Object.entries(features)) {
      sum += this.weights[feature as keyof PredictionFeatures] * value;
    }

    // Apply sigmoid function to get probability
    return this.sigmoid(sum);
  }

  /**
   * Predict score (0-100) for given features
   */
  predict(features: PredictionFeatures): number {
    const probability = this.predictProbability(features);
    return Math.round(probability * 100);
  }

  /**
   * Calculate model accuracy on training data
   */
  private calculateAccuracy(trainingData: TrainingData[]): number {
    let correct = 0;

    for (const sample of trainingData) {
      const prediction = this.predict(sample.features);
      const predicted = prediction >= 50;
      const actual = sample.converted;

      if (predicted === actual) {
        correct++;
      }
    }

    return correct / trainingData.length;
  }

  /**
   * Get feature importance (normalized weights)
   */
  getFeatureImportance(): Record<string, number> {
    // Calculate total absolute weight
    const total = Object.values(this.weights).reduce((sum, w) => sum + Math.abs(w), 0);

    if (total === 0) {
      // If no training yet, return equal importance
      const numFeatures = Object.keys(this.weights).length;
      const importance: Record<string, number> = {};
      for (const feature of Object.keys(this.weights)) {
        importance[feature] = 1 / numFeatures;
      }
      return importance;
    }

    // Normalize weights to show relative importance (0-1)
    const importance: Record<string, number> = {};
    for (const [feature, weight] of Object.entries(this.weights)) {
      importance[feature] = Math.abs(weight) / total;
    }

    return importance;
  }

  /**
   * Serialize model weights for storage
   */
  serializeWeights(): ModelWeights {
    return {
      weights: { ...this.weights },
      bias: this.bias,
    };
  }

  /**
   * Load model weights from storage
   */
  loadWeights(modelWeights: ModelWeights): void {
    this.weights = { ...modelWeights.weights };
    this.bias = modelWeights.bias;
  }

  /**
   * Get top contributing features for a prediction
   */
  getTopContributingFeatures(
    features: PredictionFeatures,
    topN: number = 3
  ): Array<{ feature: string; contribution: number; featureValue: number }> {
    // Calculate contribution of each feature
    const contributions = Object.entries(features).map(([feature, value]) => ({
      feature,
      contribution: Math.abs(this.weights[feature as keyof PredictionFeatures] * value),
      featureValue: value,
    }));

    // Sort by contribution (descending) and return top N
    return contributions.sort((a, b) => b.contribution - a.contribution).slice(0, topN);
  }
}
