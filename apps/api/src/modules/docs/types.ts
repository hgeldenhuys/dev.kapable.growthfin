/**
 * Type definitions for Feature Documentation system
 */

export interface FeatureDocumentation {
  type: 'feature-documentation';
  version: string;
  feature: {
    id: string;
    name: string;
    icon: string;
    order: number;
    category: 'core' | 'communication' | 'automation' | 'analytics';
    status: 'planning' | 'development' | 'beta' | 'stable';
  };
  metadata: {
    lastUpdated: string;
    owners: string[];
    relatedFeatures: string[];
    dependencies: string[];
    estimatedDemoTime: number;
  };
  overview: {
    headline: string;
    description: string;
    businessValue: Array<{
      metric: string;
      impact: string;
      explanation: string;
    }>;
    targetUsers: Array<{
      role: string;
      useCase: string;
    }>;
  };
  capabilities: Array<{
    id: string;
    name: string;
    description: string;
    workflow: {
      steps: Array<{
        action: string;
        expectedResult: string;
        screenshot?: string;
      }>;
    };
    demoTalkingPoints: Array<{
      point: string;
      emphasis: 'key' | 'supporting' | 'optional';
    }>;
    technicalDetails: {
      api: string;
      realtime: boolean;
      permissions: string[];
    };
  }>;
  quickStart: {
    prerequisites: Array<{
      requirement: string;
      checkCommand?: string;
    }>;
    steps: Array<{
      title: string;
      code: string;
      explanation: string;
      verifyCommand?: string;
    }>;
  };
  workflows: Array<{
    id: string;
    name: string;
    scenario: string;
    steps: Array<{
      description: string;
      action: string;
      screenshot?: string;
      notes?: string[];
    }>;
    outcomes: Array<{
      result?: string;
      metric?: string;
    }>;
  }>;
  integrations: Array<{
    feature: string;
    touchpoint: string;
    dataFlow: 'reads' | 'writes' | 'bidirectional';
  }>;
  faq: Array<{
    question: string;
    answer: string;
    category: 'usage' | 'technical' | 'business';
    relatedWorkflow: string | null;
  }>;
  demoScript: {
    introduction: string;
    transitions: {
      from: string;
      narrative: string;
    };
    keyMoments: Array<{
      timing: string;
      action: string;
      impact: string;
      pause: boolean;
    }>;
    closingPoints: string[];
  };
  assets: {
    screenshots: Array<{
      id: string;
      path: string;
      caption: string;
      feature: string;
    }>;
    videos: Array<{
      id: string;
      path: string;
      duration: number;
      transcript: string;
    }>;
    diagrams: Array<{
      id: string;
      type: 'architecture' | 'flow' | 'erd';
      source: string;
    }>;
  };
  testData: {
    setup: Array<{
      entity: string;
      count: number;
      template: string;
    }>;
    scenarios: Array<{
      name: string;
      description: string;
      data: Record<string, any>;
    }>;
  };
  metrics: {
    documentation: {
      completeness: number;
      lastReviewed: string;
      missingElements: string[];
    };
    demo: {
      rehearsals: number;
      averageTime: number;
      feedbackScore: number;
    };
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  completenessScore: number;
}

export interface GenerationResult {
  featuresProcessed: number;
  outputs: string[];
  errors?: string[];
}
